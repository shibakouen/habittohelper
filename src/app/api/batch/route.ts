/**
 * POST /api/batch
 *
 * Create a new batch with keywords.
 * Body: { keywords: string[], useNeuronwriter: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createBatch } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { keywords, useNeuronwriter = true } = body

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'Keywords array is required' },
        { status: 400 }
      )
    }

    // Validate keyword count
    if (keywords.length > 500) {
      return NextResponse.json(
        { error: 'Maximum 500 keywords allowed' },
        { status: 400 }
      )
    }

    // Filter empty keywords
    const cleanKeywords = keywords
      .map((k: string) => k.trim())
      .filter((k: string) => k.length > 0)

    if (cleanKeywords.length === 0) {
      return NextResponse.json(
        { error: 'No valid keywords provided' },
        { status: 400 }
      )
    }

    // Create batch
    const batch = await createBatch(cleanKeywords, useNeuronwriter)

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      totalKeywords: cleanKeywords.length,
      useNeuronwriter,
    })
  } catch (error) {
    console.error('Error creating batch:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create batch' },
      { status: 500 }
    )
  }
}
