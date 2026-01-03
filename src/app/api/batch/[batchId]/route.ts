/**
 * GET /api/batch/[batchId]
 *
 * Get batch status and job details.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getBatch, getJobsForBatch } from '@/lib/supabase'

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

    const jobs = await getJobsForBatch(batchId)

    // Summarize job statuses
    const jobSummary = {
      pending: jobs.filter(j => j.status === 'pending').length,
      researching: jobs.filter(j => j.status === 'researching').length,
      analyzing: jobs.filter(j => j.status === 'analyzing').length,
      writing: jobs.filter(j => j.status === 'writing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
    }

    // Get active job (if any)
    const activeJob = jobs.find(j =>
      ['researching', 'analyzing', 'writing'].includes(j.status)
    )

    return NextResponse.json({
      batch: {
        id: batch.id,
        status: batch.status,
        totalKeywords: batch.total_keywords,
        completedKeywords: batch.completed_keywords,
        failedKeywords: batch.failed_keywords,
        useNeuronwriter: batch.use_neuronwriter,
        createdAt: batch.created_at,
        updatedAt: batch.updated_at,
      },
      jobs: jobSummary,
      activeJob: activeJob
        ? {
            id: activeJob.id,
            keyword: activeJob.keyword,
            status: activeJob.status,
          }
        : null,
      jobDetails: jobs.map(j => ({
        id: j.id,
        keyword: j.keyword,
        status: j.status,
        error: j.error,
        startedAt: j.started_at,
        completedAt: j.completed_at,
      })),
    })
  } catch (error) {
    console.error('Error getting batch:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get batch' },
      { status: 500 }
    )
  }
}
