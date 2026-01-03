/**
 * NeuronWriter API Route
 * Fetch keywords and score content
 */

import { NextRequest, NextResponse } from 'next/server'
import { analyzeKeyword, calculateScore, prepareContentForNW, NeuronWriterAnalysis } from '@/lib/neuronwriter'
import { getCachedNWQuery, cacheNWQuery, addScore, updateConversation } from '@/lib/writer-db'

const NEURONWRITER_API_URL = 'https://app.neuronwriter.com/neuron-api/0.5/writer'
const NEURONWRITER_API_KEY = process.env.NEURONWRITER_API_KEY

/**
 * GET - Fetch keyword analysis
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const keyword = searchParams.get('keyword')

    console.log('[NW GET] === FETCH START ===')
    console.log('[NW GET] projectId:', projectId)
    console.log('[NW GET] keyword:', keyword)

    if (!projectId || !keyword) {
      console.log('[NW GET] Missing projectId or keyword')
      return NextResponse.json({ error: 'projectId and keyword are required' }, { status: 400 })
    }

    // Check cache first
    const cached = await getCachedNWQuery(projectId, keyword)
    if (cached?.data) {
      return NextResponse.json({ ...cached.data, cached: true })
    }

    // Fetch from NeuronWriter
    const analysis = await analyzeKeyword(keyword)

    // Cache the result with the actual NeuronWriter query ID
    const queryId = analysis.queryId || `nw-${Date.now()}`
    await cacheNWQuery(projectId, keyword, queryId, analysis)

    return NextResponse.json({ ...analysis, cached: false })
  } catch (error) {
    console.error('NeuronWriter fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST - Score content or set keyword for conversation
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, projectId, conversationId, keyword, content } = body

    // Set keyword for a conversation
    if (action === 'setKeyword') {
      console.log('[NW POST] === SET KEYWORD ===')
      console.log('[NW POST] conversationId:', conversationId)
      console.log('[NW POST] keyword:', keyword)
      console.log('[NW POST] projectId:', projectId)

      if (!conversationId || !keyword) {
        console.log('[NW POST] Missing required fields')
        return NextResponse.json({ error: 'conversationId and keyword are required' }, { status: 400 })
      }

      // Update conversation keyword
      console.log('[NW POST] Updating conversation with keyword...')
      await updateConversation(conversationId, { keyword })
      console.log('[NW POST] Conversation updated successfully')

      // Fetch/cache keyword analysis
      if (projectId) {
        const cached = await getCachedNWQuery(projectId, keyword)
        if (!cached) {
          const analysis = await analyzeKeyword(keyword)
          const queryId = analysis.queryId || `nw-${Date.now()}`
          await cacheNWQuery(projectId, keyword, queryId, analysis)
          return NextResponse.json({ success: true, analysis, cached: false })
        }
        return NextResponse.json({ success: true, analysis: cached.data, cached: true })
      }

      return NextResponse.json({ success: true })
    }

    // Score content
    if (action === 'score') {
      if (!content || !keyword) {
        return NextResponse.json({ error: 'content and keyword are required' }, { status: 400 })
      }

      console.log('[NW Score] === SCORING START ===')
      console.log('[NW Score] Keyword:', keyword)
      console.log('[NW Score] Content length:', content.length)
      console.log('[NW Score] Project ID:', projectId)

      // Get keyword analysis
      let analysis: NeuronWriterAnalysis
      if (projectId) {
        const cached = await getCachedNWQuery(projectId, keyword)
        console.log('[NW Score] Cached query found:', !!cached)
        console.log('[NW Score] Cached query_id:', cached?.query_id)
        if (cached?.data) {
          analysis = cached.data
          console.log('[NW Score] Using cached analysis with', analysis.topKeywords.length, 'keywords')
        } else {
          console.log('[NW Score] No cached data, fetching fresh analysis...')
          analysis = await analyzeKeyword(keyword)
          const queryId = analysis.queryId || `nw-${Date.now()}`
          await cacheNWQuery(projectId, keyword, queryId, analysis)
        }
      } else {
        console.log('[NW Score] No project ID, fetching analysis without cache...')
        analysis = await analyzeKeyword(keyword)
      }

      // Calculate score
      console.log('[NW Score] Calculating local score...')
      const score = calculateScore(content, analysis)
      console.log('[NW Score] Local score:', JSON.stringify(score, null, 2))

      // Convert markdown to HTML and extract title/description for NeuronWriter
      const prepared = prepareContentForNW(content, keyword)

      // Try to get NeuronWriter's official score via API
      let nwScore: number | null = null
      if (NEURONWRITER_API_KEY && projectId) {
        console.log('[NW Score] Attempting NeuronWriter API scoring...')
        try {
          const cached = await getCachedNWQuery(projectId, keyword)
          if (cached?.query_id) {
            console.log('[NW Score] Sending to /import-content with query_id:', cached.query_id)
            console.log('[NW Score] Title:', prepared.title)
            console.log('[NW Score] Description:', prepared.description.substring(0, 50) + '...')
            console.log('[NW Score] HTML preview:', prepared.html.substring(0, 200))

            const response = await fetch(`${NEURONWRITER_API_URL}/import-content`, {
              method: 'POST',
              headers: {
                'X-API-KEY': NEURONWRITER_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                query: cached.query_id,
                html: prepared.html,
                title: prepared.title,
                description: prepared.description,
              }),
            })

            console.log('[NW Score] NW API response status:', response.status)
            console.log('[NW Score] NW API response ok:', response.ok)

            if (response.ok) {
              const data = await response.json()
              console.log('[NW Score] NW API response data:', JSON.stringify(data, null, 2))
              nwScore = data.content_score || null
              console.log('[NW Score] Extracted nwScore:', nwScore)
            } else {
              const errorText = await response.text()
              console.warn('[NW Score] NW API error response:', errorText)
            }
          } else {
            console.warn('[NW Score] No query_id in cache, cannot call NW API')
          }
        } catch (e) {
          console.warn('[NW Score] NeuronWriter scoring failed:', e)
          console.warn('[NW Score] Error details:', e instanceof Error ? e.message : String(e))
        }
      } else {
        console.log('[NW Score] Skipping NW API (API key exists:', !!NEURONWRITER_API_KEY, ', projectId exists:', !!projectId, ')')
      }

      console.log('[NW Score] Final score to return:', nwScore || score.percentage)
      console.log('[NW Score] nwScore:', nwScore, ', localScore.percentage:', score.percentage)

      // Save score to history if conversation provided
      if (conversationId) {
        await addScore(conversationId, content, nwScore || score.percentage, {
          localScore: score,
          nwScore,
        })
      }

      return NextResponse.json({
        score: nwScore || score.percentage,
        nwScore,
        localScore: score,
        analysis,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('NeuronWriter action error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
