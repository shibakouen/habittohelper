/**
 * Blog Generation Pipeline
 *
 * STEP-BY-STEP PROCESSING for serverless (60s timeout friendly)
 * Each call to processOneStep advances ONE job by ONE step.
 * Client should poll and call repeatedly until batch is complete.
 */

import { research, analyzeResearch, writeBlog } from './openrouter'
import { analyzeKeyword, calculateScore, type NeuronWriterAnalysis } from './neuronwriter'
import {
  updateJobStatus,
  setJobError,
  saveJobResearch,
  saveNeuronwriterData,
  saveBlog,
  incrementBatchProgress,
  updateBatchStatus,
  getJobsForBatch,
  supabase,
  type Job,
} from './supabase'
import { getFullWritingContext, suggestLinks, insertLinks } from './habitto-context'

// Configuration
const MIN_ACCEPTABLE_SCORE = 60
const MAX_RETRY_ATTEMPTS = 1 // Reduced retries to save time

export interface StepResult {
  status: 'processing' | 'completed' | 'no_work'
  jobId?: string
  keyword?: string
  step?: string
  nextStep?: string
  message: string
  batchComplete?: boolean
  error?: string
}

/**
 * Get the next job that needs processing
 * Priority: in-progress jobs first, then pending jobs
 */
async function getNextJobToProcess(batchId: string): Promise<Job | null> {
  // First check for jobs that are mid-processing (researching, analyzing, writing)
  const { data: inProgressJobs } = await supabase
    .from('simple_jobs')
    .select('*')
    .eq('batch_id', batchId)
    .in('status', ['researching', 'analyzing', 'writing'])
    .order('created_at', { ascending: true })
    .limit(1)

  if (inProgressJobs && inProgressJobs.length > 0) {
    return inProgressJobs[0] as Job
  }

  // Then get pending jobs
  const { data: pendingJobs } = await supabase
    .from('simple_jobs')
    .select('*')
    .eq('batch_id', batchId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)

  if (pendingJobs && pendingJobs.length > 0) {
    return pendingJobs[0] as Job
  }

  return null
}

/**
 * Process ONE step for ONE job
 * Returns immediately after completing the step
 */
export async function processOneStep(
  batchId: string,
  useNeuronwriter: boolean
): Promise<StepResult> {
  try {
    // Ensure batch is marked as running
    await updateBatchStatus(batchId, 'running')

    // Get next job to process
    const job = await getNextJobToProcess(batchId)

    if (!job) {
      // Check if batch is complete
      const jobs = await getJobsForBatch(batchId)
      const completed = jobs.filter(j => j.status === 'completed').length
      const failed = jobs.filter(j => j.status === 'failed').length
      const total = jobs.length

      if (completed + failed === total) {
        await updateBatchStatus(batchId, failed === total ? 'failed' : 'completed')
        return {
          status: 'completed',
          message: `Batch complete: ${completed} succeeded, ${failed} failed`,
          batchComplete: true,
        }
      }

      return {
        status: 'no_work',
        message: 'No jobs to process',
      }
    }

    // Process based on current status
    // Flow: pending -> researching -> analyzing -> writing -> completed
    switch (job.status) {
      case 'pending':
        return await doResearchStep(job)

      case 'researching':
        // Research in progress - continue to research (shouldn't happen normally)
        return await doResearchStep(job)

      case 'analyzing':
        // Research done, now analyze + get NeuronWriter keywords
        return await doAnalyzeStep(job, useNeuronwriter)

      case 'writing':
        // Analysis done, now write the blog
        return await doWriteStep(job, batchId)

      default:
        return {
          status: 'no_work',
          jobId: job.id,
          keyword: job.keyword,
          message: `Job in unexpected status: ${job.status}`,
        }
    }
  } catch (error) {
    console.error('[Pipeline] Error in processOneStep:', error)
    return {
      status: 'processing',
      message: 'Error occurred, will retry',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Step 1: Research
 */
async function doResearchStep(job: Job): Promise<StepResult> {
  console.log(`[${job.keyword}] === STEP: RESEARCH ===`)
  await updateJobStatus(job.id, 'researching')

  try {
    const rawResearch = await research(job.keyword)

    // Save research and move to analyzing
    const { error: updateError } = await supabase
      .from('simple_jobs')
      .update({
        research_raw: rawResearch,
        status: 'analyzing',
      })
      .eq('id', job.id)

    if (updateError) {
      console.error(`[${job.keyword}] Failed to save research:`, updateError)
      throw new Error(`Failed to save research: ${updateError.message}`)
    }

    console.log(`[${job.keyword}] Research complete, moving to analyze`)

    return {
      status: 'processing',
      jobId: job.id,
      keyword: job.keyword,
      step: 'research',
      nextStep: 'analyze',
      message: 'Research complete',
    }
  } catch (error) {
    console.error(`[${job.keyword}] Research failed:`, error)
    await setJobError(job.id, error instanceof Error ? error.message : 'Research failed')
    return {
      status: 'processing',
      jobId: job.id,
      keyword: job.keyword,
      step: 'research',
      message: 'Research failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Step 2: Analyze + NeuronWriter
 */
async function doAnalyzeStep(job: Job, useNeuronwriter: boolean): Promise<StepResult> {
  console.log(`[${job.keyword}] === STEP: ANALYZE ===`)

  try {
    // Get the raw research from DB
    const { data: jobData } = await supabase
      .from('simple_jobs')
      .select('research_raw')
      .eq('id', job.id)
      .single()

    if (!jobData?.research_raw) {
      throw new Error('No research data found')
    }

    // Analyze research (45s timeout)
    console.log(`[${job.keyword}] Analyzing research (45s timeout)...`)
    const analyzeTimeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Analysis timeout (45s)')), 45000)
    )
    const analyzedResearch = await Promise.race([
      analyzeResearch(job.keyword, jobData.research_raw),
      analyzeTimeoutPromise
    ])
    console.log(`[${job.keyword}] Analysis complete`)

    // Get NeuronWriter keywords (if enabled) with 10s timeout
    let neuronwriterData: NeuronWriterAnalysis | null = null
    if (useNeuronwriter) {
      console.log(`[${job.keyword}] Getting NeuronWriter keywords (10s timeout)...`)
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('NeuronWriter timeout (10s)')), 10000)
        )
        neuronwriterData = await Promise.race([
          analyzeKeyword(job.keyword),
          timeoutPromise
        ])
        await saveNeuronwriterData(job.id, neuronwriterData as unknown as Record<string, unknown>)
        console.log(`[${job.keyword}] NeuronWriter: got ${neuronwriterData.recommendedTerms.length} terms`)
      } catch (error) {
        console.warn(`[${job.keyword}] NeuronWriter failed/timeout:`, error)
        // Continue without NeuronWriter data - will use fallback scoring
      }
    }

    // Save analysis and move to writing
    const { error: updateError } = await supabase
      .from('simple_jobs')
      .update({
        research_analyzed: analyzedResearch,
        status: 'writing',
      })
      .eq('id', job.id)

    if (updateError) {
      console.error(`[${job.keyword}] Failed to save analysis:`, updateError)
      throw new Error(`Failed to save analysis: ${updateError.message}`)
    }

    console.log(`[${job.keyword}] Analysis complete, moving to write`)

    return {
      status: 'processing',
      jobId: job.id,
      keyword: job.keyword,
      step: 'analyze',
      nextStep: 'write',
      message: `Analysis complete${neuronwriterData ? ` (${neuronwriterData.recommendedTerms.length} SEO terms)` : ''}`,
    }
  } catch (error) {
    console.error(`[${job.keyword}] Analysis failed:`, error)
    await setJobError(job.id, error instanceof Error ? error.message : 'Analysis failed')
    return {
      status: 'processing',
      jobId: job.id,
      keyword: job.keyword,
      step: 'analyze',
      message: 'Analysis failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Step 3: Write blog
 */
async function doWriteStep(job: Job, batchId: string): Promise<StepResult> {
  console.log(`[${job.keyword}] === STEP: WRITE ===`)

  try {
    // Get job data
    const { data: jobData } = await supabase
      .from('simple_jobs')
      .select('research_analyzed, neuronwriter_data')
      .eq('id', job.id)
      .single()

    if (!jobData?.research_analyzed) {
      throw new Error('No analyzed research found')
    }

    const neuronwriterData = jobData.neuronwriter_data as NeuronWriterAnalysis | null

    // Write blog
    const systemPrompt = getFullWritingContext()
    let blogResult = await writeBlog(
      job.keyword,
      jobData.research_analyzed,
      neuronwriterData
        ? {
            recommendedTerms: neuronwriterData.recommendedTerms,
            competitorHeadings: neuronwriterData.competitorHeadings,
            wordCountTarget: neuronwriterData.wordCountTarget,
          }
        : null,
      systemPrompt
    )

    // Add internal links
    let content = blogResult.content
    const links = suggestLinks(content)
    if (links.length > 0) {
      content = insertLinks(content, links)
    }

    // Calculate score
    let score: number | null = null
    if (neuronwriterData) {
      const scoreResult = calculateScore(content, neuronwriterData)
      score = scoreResult.percentage
      console.log(`[${job.keyword}] Score: ${score}%`)

      // ONE retry if score is bad
      if (score < MIN_ACCEPTABLE_SCORE) {
        console.log(`[${job.keyword}] Score ${score}% < ${MIN_ACCEPTABLE_SCORE}%, retrying once...`)
        blogResult = await writeBlog(
          job.keyword,
          jobData.research_analyzed,
          {
            recommendedTerms: neuronwriterData.recommendedTerms,
            competitorHeadings: neuronwriterData.competitorHeadings,
            wordCountTarget: neuronwriterData.wordCountTarget,
          },
          systemPrompt,
          {
            missingKeywords: scoreResult.missingTerms,
            previousScore: score,
            attempt: 2,
          }
        )
        content = blogResult.content
        const retryLinks = suggestLinks(content)
        if (retryLinks.length > 0) {
          content = insertLinks(content, retryLinks)
        }
        const newScoreResult = calculateScore(content, neuronwriterData)
        score = newScoreResult.percentage
        console.log(`[${job.keyword}] Retry score: ${score}%`)
      }
    }

    // Save blog
    const savedBlog = await saveBlog(
      job.id,
      job.keyword,
      blogResult.title,
      content,
      blogResult.metaDescription,
      score
    )

    // Mark completed
    await updateJobStatus(job.id, 'completed')
    await incrementBatchProgress(batchId, 'completed_keywords')

    console.log(`[${job.keyword}] === COMPLETED === Score: ${score || 'N/A'}%`)

    return {
      status: 'processing',
      jobId: job.id,
      keyword: job.keyword,
      step: 'write',
      nextStep: 'completed',
      message: `Blog complete: "${blogResult.title}" (${savedBlog.word_count} chars, ${score || 'N/A'}%)`,
    }
  } catch (error) {
    console.error(`[${job.keyword}] Write failed:`, error)
    await setJobError(job.id, error instanceof Error ? error.message : 'Write failed')
    await incrementBatchProgress(batchId, 'failed_keywords')
    return {
      status: 'processing',
      jobId: job.id,
      keyword: job.keyword,
      step: 'write',
      message: 'Write failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Legacy function for compatibility (now just calls processOneStep in a loop)
export async function processBatch(
  batchId: string,
  useNeuronwriter: boolean
): Promise<{
  completed: number
  failed: number
  results: Array<{ keyword: string; success: boolean; title?: string; wordCount?: number; score?: number; error?: string }>
}> {
  const results: Array<{ keyword: string; success: boolean; title?: string; wordCount?: number; score?: number; error?: string }> = []

  // Process step by step until done
  let continueProcessing = true
  while (continueProcessing) {
    const stepResult = await processOneStep(batchId, useNeuronwriter)

    if (stepResult.status === 'completed' || stepResult.status === 'no_work') {
      continueProcessing = false
    }

    if (stepResult.step === 'write' && stepResult.nextStep === 'completed') {
      results.push({
        keyword: stepResult.keyword || '',
        success: !stepResult.error,
        error: stepResult.error,
      })
    }
  }

  const jobs = await getJobsForBatch(batchId)
  const completed = jobs.filter(j => j.status === 'completed').length
  const failed = jobs.filter(j => j.status === 'failed').length

  return { completed, failed, results }
}
