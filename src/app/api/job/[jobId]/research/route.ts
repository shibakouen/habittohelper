/**
 * GET /api/job/[jobId]/research
 *
 * Get research data for a specific job.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getJob } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    const job = await getJob(jobId)

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      jobId,
      keyword: job.keyword,
      researchRaw: job.research_raw,
      researchAnalyzed: job.research_analyzed,
      neuronwriterData: job.neuronwriter_data,
      status: job.status,
    })
  } catch (error) {
    console.error('Error getting research:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get research' },
      { status: 500 }
    )
  }
}
