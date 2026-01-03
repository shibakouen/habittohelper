/**
 * POST /api/batch/[batchId]/process
 *
 * Proxies to Supabase Edge Function for blog generation.
 * Edge Function has 400s timeout (Pro plan) vs Vercel's 60s limit.
 *
 * Each call processes ONE step:
 * - Research one job (~20-30s)
 * - Analyze one job (~45-90s) - Claude Sonnet 4.5
 * - Write one blog (~45-90s) - Claude Sonnet 4.5
 */

import { NextRequest, NextResponse } from 'next/server'
import { getBatch } from '@/lib/supabase'

export const maxDuration = 60 // Vercel limit - but Edge Function does the real work

// Supabase Edge Function URL
const EDGE_FUNCTION_URL = process.env.SUPABASE_EDGE_FUNCTION_URL ||
  `https://${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').replace('.supabase.co', '')}.supabase.co/functions/v1/process-batch`

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params

    const batch = await getBatch(batchId)

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    if (batch.status === 'completed') {
      return NextResponse.json({
        success: true,
        batchComplete: true,
        message: 'Batch already completed',
      })
    }

    // Call Supabase Edge Function
    const edgeFunctionUrl = `https://udolfppdjnncwtqdoaat.supabase.co/functions/v1/process-batch`

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        batchId,
        useNeuronwriter: batch.use_neuronwriter,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Edge Function error:', error)
      return NextResponse.json(
        { error: `Edge Function error: ${response.status}` },
        { status: 500 }
      )
    }

    const result = await response.json()

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error calling Edge Function:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process step' },
      { status: 500 }
    )
  }
}
