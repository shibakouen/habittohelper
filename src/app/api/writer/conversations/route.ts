/**
 * Conversations API Route
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getConversations,
  getConversation,
  createConversation,
  deleteConversation,
  getMessages,
} from '@/lib/writer-db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const conversationId = searchParams.get('id')

    // Get single conversation with messages
    if (conversationId) {
      const conversation = await getConversation(conversationId)
      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }
      const messages = await getMessages(conversationId)
      return NextResponse.json({ ...conversation, messages })
    }

    // Get all conversations for project
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const conversations = await getConversations(projectId)
    return NextResponse.json(conversations)
  } catch (error) {
    console.error('Failed to get conversations:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, title, keyword } = await req.json()

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const conversation = await createConversation(projectId, title, keyword)
    return NextResponse.json(conversation, { status: 201 })
  } catch (error) {
    console.error('Failed to create conversation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    await deleteConversation(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete conversation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
