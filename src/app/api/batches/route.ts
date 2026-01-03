/**
 * GET /api/batches
 *
 * Get recent batches with their blog counts.
 */

import { NextResponse } from 'next/server'
import { getRecentBatches, getBlogsForBatch } from '@/lib/supabase'

export async function GET() {
  try {
    const batches = await getRecentBatches(20)

    // Get blog counts for completed batches
    const batchesWithBlogs = await Promise.all(
      batches.map(async batch => {
        let blogCount = 0
        if (batch.status === 'completed' || batch.completed_keywords > 0) {
          try {
            const blogs = await getBlogsForBatch(batch.id)
            blogCount = blogs.length
          } catch {
            // Ignore errors fetching blogs
          }
        }

        return {
          id: batch.id,
          status: batch.status,
          totalKeywords: batch.total_keywords,
          completedKeywords: batch.completed_keywords,
          failedKeywords: batch.failed_keywords,
          blogCount,
          useNeuronwriter: batch.use_neuronwriter,
          createdAt: batch.created_at,
        }
      })
    )

    return NextResponse.json({
      batches: batchesWithBlogs,
    })
  } catch (error) {
    console.error('Error getting batches:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get batches' },
      { status: 500 }
    )
  }
}
