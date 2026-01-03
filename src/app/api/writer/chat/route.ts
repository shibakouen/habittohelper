/**
 * Chat API Route
 * Streams Claude responses via Server-Sent Events
 */

import { NextRequest } from 'next/server'
import { anthropic, MODEL, MAX_TOKENS, buildSystemPrompt } from '@/lib/anthropic'
import {
  getProject,
  getProjectFiles,
  getConversation,
  getMessages,
  addMessage,
  getCachedNWQuery,
  updateConversation,
  getResearch,
  saveBlogFromContent,
} from '@/lib/writer-db'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minute timeout for long blog generation

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { conversationId, message } = body

    if (!conversationId || !message) {
      return new Response(JSON.stringify({ error: 'Missing conversationId or message' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get conversation and project
    const conversation = await getConversation(conversationId)
    if (!conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const project = await getProject(conversation.project_id)
    if (!project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get context: files, NeuronWriter data, research, previous messages
    console.log('[Chat] === BUILDING CONTEXT ===')
    console.log('[Chat] Conversation ID:', conversationId)
    console.log('[Chat] Conversation keyword:', conversation.keyword)
    console.log('[Chat] Project ID:', project.id)
    console.log('[Chat] User message:', message)

    const [files, existingMessages, nwQuery, research] = await Promise.all([
      getProjectFiles(project.id),
      getMessages(conversationId),
      conversation.keyword ? getCachedNWQuery(project.id, conversation.keyword) : null,
      getResearch(conversationId),
    ])

    console.log('[Chat] Files count:', files.length)
    console.log('[Chat] Existing messages:', existingMessages.length)
    console.log('[Chat] NW Query found:', !!nwQuery)
    console.log('[Chat] NW Query has data:', !!nwQuery?.data)
    console.log('[Chat] NW Query top keywords count:', nwQuery?.data?.topKeywords?.length || 0)
    console.log('[Chat] Research found:', !!research)
    console.log('[Chat] Research results count:', research?.research_data?.results?.length || 0)

    // Build system prompt with all context (including research)
    // Pass keyword to get relevant crawled page content for anti-hallucination
    const systemPrompt = buildSystemPrompt(
      project.system_prompt || '',
      files.map(f => ({ name: f.name, content: f.content })),
      nwQuery?.data || undefined,
      research?.research_data || undefined,
      conversation.keyword || undefined
    )

    // Save user message
    await addMessage(conversationId, 'user', message)

    // Build messages array
    const messages = [
      ...existingMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: message },
    ]

    // Update conversation title if it's the first message
    if (existingMessages.length === 0) {
      const title = message.length > 50 ? message.slice(0, 47) + '...' : message
      await updateConversation(conversationId, { title })
    }

    // Create streaming response
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = ''

        try {
          const claudeStream = anthropic.messages.stream({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: systemPrompt,
            messages,
          })

          for await (const event of claudeStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const text = event.delta.text
              fullResponse += text
              // Send SSE format
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }

          // Save assistant message to database
          await addMessage(conversationId, 'assistant', fullResponse)

          // Auto-save to writer_blogs if this is a blog generation (has keyword)
          if (conversation.keyword && fullResponse.length > 500) {
            console.log('[Chat] Auto-saving blog for keyword:', conversation.keyword)
            await saveBlogFromContent(conversationId, conversation.keyword, fullResponse)
          }

          // Send done event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
          controller.close()
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          const errorStack = error instanceof Error ? error.stack : ''

          console.error('=== STREAM ERROR ===')
          console.error('Conversation ID:', conversationId)
          console.error('Error:', errorMessage)
          console.error('Stack:', errorStack)
          console.error('System prompt length:', systemPrompt.length)
          console.error('Messages count:', messages.length)
          console.error('Partial content length:', fullResponse.length)
          console.error('====================')

          // IMPORTANT: Save partial content if we got any before the error
          if (fullResponse.length > 100) {
            console.log('[Chat] Saving partial content:', fullResponse.length, 'chars')
            const partialContent = fullResponse + '\n\n---\n⚠️ *[生成が中断されました。もう一度お試しください]*'
            await addMessage(conversationId, 'assistant', partialContent)

            // Send partial completion event so frontend shows what we have
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                text: '\n\n---\n⚠️ *[生成が中断されました]*',
                partial: true
              })}\n\n`)
            )
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
          } else {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
            )
          }
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
