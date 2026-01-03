/**
 * Research API Route
 * Execute deep web research for blog content
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeResearch, formatResearchForPrompt } from '@/lib/research'
import {
  getConversation,
  getProject,
  getProjectFiles,
  getResearchByKeyword,
  saveResearch,
  isResearchStale,
  type ResearchData,
} from '@/lib/writer-db'

export const runtime = 'nodejs'
export const maxDuration = 60 // Research can take up to 60s

/**
 * GET - Retrieve cached research for a conversation
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversationId')
    const keyword = searchParams.get('keyword')

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      )
    }

    // Get conversation to verify it exists
    const conversation = await getConversation(conversationId)
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Use keyword from param or conversation
    const searchKeyword = keyword || conversation.keyword
    if (!searchKeyword) {
      return NextResponse.json(
        { error: 'No keyword specified' },
        { status: 400 }
      )
    }

    // Get cached research
    const research = await getResearchByKeyword(conversationId, searchKeyword)

    if (!research) {
      return NextResponse.json({ research: null, cached: false })
    }

    // Check if stale
    const stale = isResearchStale(research, 24)

    return NextResponse.json({
      research: research.research_data,
      cached: true,
      stale,
      createdAt: research.created_at,
    })
  } catch (error) {
    console.error('[Research API] GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST - Execute new research
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { conversationId, keyword, forceRefresh = false } = body

    if (!conversationId || !keyword) {
      return NextResponse.json(
        { error: 'conversationId and keyword are required' },
        { status: 400 }
      )
    }

    console.log(`[Research API] POST request for "${keyword}"`)

    // Get conversation
    const conversation = await getConversation(conversationId)
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Check for cached research (unless force refresh)
    if (!forceRefresh) {
      const cached = await getResearchByKeyword(conversationId, keyword)
      if (cached && !isResearchStale(cached, 24)) {
        console.log(`[Research API] Returning cached research`)
        return NextResponse.json({
          research: cached.research_data,
          cached: true,
          createdAt: cached.created_at,
        })
      }
    }

    // Get project context for better research queries
    const project = await getProject(conversation.project_id)
    const files = await getProjectFiles(conversation.project_id)

    // Extract context from project files
    const brandVoiceFile = files.find(f =>
      f.name.toLowerCase().includes('brand') ||
      f.name.toLowerCase().includes('voice') ||
      f.name.toLowerCase().includes('ガイド')
    )

    const context = {
      brandVoice: brandVoiceFile?.content?.substring(0, 500),
      targetAudience: '20〜40代の金融初心者、貯蓄を始めたい・増やしたい人',
      topicFocus: project?.description || undefined,
    }

    // Execute research
    console.log(`[Research API] Executing research for "${keyword}"`)
    const researchData = await executeResearch(keyword, context, {
      maxAgeMonths: 12,
      locale: 'ja',
    })

    // Save to database
    await saveResearch(conversationId, keyword, researchData)
    console.log(`[Research API] Research saved to database`)

    return NextResponse.json({
      research: researchData,
      cached: false,
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Research API] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
