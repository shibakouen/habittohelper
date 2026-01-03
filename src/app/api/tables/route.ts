/**
 * Tables API Route
 * Fetch all writer tables data for the dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const table = searchParams.get('table')

    // If specific table requested
    if (table) {
      const validTables = [
        'writer_projects',
        'writer_conversations',
        'writer_messages',
        'writer_files',
        'writer_nw_queries',
        'writer_scores',
        'writer_research',
        'writer_blogs',
      ]

      if (!validTables.includes(table)) {
        return NextResponse.json({ error: 'Invalid table name' }, { status: 400 })
      }

      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      return NextResponse.json({ [table]: data })
    }

    // Fetch all tables in parallel
    const [
      projects,
      conversations,
      messages,
      files,
      nwQueries,
      scores,
      research,
      blogs,
    ] = await Promise.all([
      supabase.from('writer_projects').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('writer_conversations').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('writer_messages').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('writer_files').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('writer_nw_queries').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('writer_scores').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('writer_research').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('writer_blogs').select('*').order('created_at', { ascending: false }).limit(50),
    ])

    return NextResponse.json({
      writer_projects: projects.data || [],
      writer_conversations: conversations.data || [],
      writer_messages: messages.data || [],
      writer_files: files.data || [],
      writer_nw_queries: nwQueries.data || [],
      writer_scores: scores.data || [],
      writer_research: research.data || [],
      writer_blogs: blogs.data || [],
      counts: {
        writer_projects: projects.data?.length || 0,
        writer_conversations: conversations.data?.length || 0,
        writer_messages: messages.data?.length || 0,
        writer_files: files.data?.length || 0,
        writer_nw_queries: nwQueries.data?.length || 0,
        writer_scores: scores.data?.length || 0,
        writer_research: research.data?.length || 0,
        writer_blogs: blogs.data?.length || 0,
      },
    })
  } catch (error) {
    console.error('Tables API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
