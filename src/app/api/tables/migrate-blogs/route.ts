/**
 * Migrate existing blog content from messages to writer_blogs table
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseBlogFrontmatter } from '@/lib/writer-db'

export async function POST() {
  try {
    // Get all conversations with keywords (these are blog generations)
    const { data: conversations, error: convError } = await supabase
      .from('writer_conversations')
      .select('id, keyword')
      .not('keyword', 'is', null)

    if (convError) throw convError

    console.log(`[Migrate] Found ${conversations?.length || 0} conversations with keywords`)

    let migrated = 0
    let skipped = 0
    const results: Array<{ keyword: string; title: string; status: string }> = []

    for (const conv of conversations || []) {
      // Check if blog already exists for this conversation
      const { data: existingBlog } = await supabase
        .from('writer_blogs')
        .select('id')
        .eq('conversation_id', conv.id)
        .single()

      if (existingBlog) {
        skipped++
        continue
      }

      // Get the last assistant message (the blog content)
      const { data: messages } = await supabase
        .from('writer_messages')
        .select('content, created_at')
        .eq('conversation_id', conv.id)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(1)

      if (!messages || messages.length === 0) {
        skipped++
        continue
      }

      const content = messages[0].content

      // Skip if content is too short (not a real blog)
      if (content.length < 500) {
        skipped++
        continue
      }

      // Parse frontmatter
      const parsed = parseBlogFrontmatter(content)

      // Get score if exists
      const { data: scores } = await supabase
        .from('writer_scores')
        .select('score')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1)

      const score = scores?.[0]?.score || null

      // Insert into writer_blogs
      const { error: insertError } = await supabase
        .from('writer_blogs')
        .insert({
          conversation_id: conv.id,
          keyword: conv.keyword,
          title: parsed.title,
          meta_description: parsed.meta_description,
          target_service: parsed.target_service,
          content: content,
          score: score,
          status: 'draft',
        })

      if (insertError) {
        console.error(`[Migrate] Failed to insert blog for ${conv.keyword}:`, insertError)
        skipped++
        continue
      }

      migrated++
      results.push({
        keyword: conv.keyword,
        title: parsed.title,
        status: 'migrated',
      })
    }

    console.log(`[Migrate] Done: ${migrated} migrated, ${skipped} skipped`)

    return NextResponse.json({
      success: true,
      migrated,
      skipped,
      results,
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
