/**
 * GET /api/batch/[batchId]/blogs
 *
 * Get all generated blogs for a batch.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getBatch, getBlogsForBatch } from '@/lib/supabase'

export async function GET(
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

    const blogs = await getBlogsForBatch(batchId)

    return NextResponse.json({
      batchId,
      totalBlogs: blogs.length,
      blogs: blogs.map(b => ({
        id: b.id,
        jobId: b.job_id,
        keyword: b.keyword,
        title: b.title,
        content: b.content,
        metaDescription: b.meta_description,
        wordCount: b.word_count,
        internalLinks: b.internal_links,
        neuronwriterScore: b.neuronwriter_score,
        createdAt: b.created_at,
      })),
    })
  } catch (error) {
    console.error('Error getting blogs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get blogs' },
      { status: 500 }
    )
  }
}
