/**
 * Supabase Client
 *
 * Database operations for batches, jobs, and blogs.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// ============================================================================
// TYPES
// ============================================================================

export type BatchStatus = 'pending' | 'running' | 'completed' | 'failed'
export type JobStatus = 'pending' | 'researching' | 'analyzing' | 'writing' | 'completed' | 'failed'

export interface Batch {
  id: string
  use_neuronwriter: boolean
  total_keywords: number
  completed_keywords: number
  failed_keywords: number
  status: BatchStatus
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  batch_id: string
  keyword: string
  status: JobStatus
  error: string | null
  research_raw: string | null
  research_analyzed: string | null
  neuronwriter_data: Record<string, unknown> | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface Blog {
  id: string
  job_id: string
  keyword: string
  title: string
  content: string
  meta_description: string | null
  word_count: number | null
  internal_links: string[]
  neuronwriter_score: number | null
  created_at: string
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

export async function createBatch(
  keywords: string[],
  useNeuronwriter: boolean
): Promise<Batch> {
  const { data: batch, error: batchError } = await supabase
    .from('simple_batches')
    .insert({
      use_neuronwriter: useNeuronwriter,
      total_keywords: keywords.length,
      status: 'pending',
    })
    .select()
    .single()

  if (batchError || !batch) {
    throw new Error(`Failed to create batch: ${batchError?.message}`)
  }

  // Create jobs for each keyword
  const jobs = keywords.map(keyword => ({
    batch_id: batch.id,
    keyword: keyword.trim(),
    status: 'pending' as const,
  }))

  const { error: jobsError } = await supabase.from('simple_jobs').insert(jobs)

  if (jobsError) {
    throw new Error(`Failed to create jobs: ${jobsError.message}`)
  }

  return batch as Batch
}

export async function getBatch(batchId: string): Promise<Batch | null> {
  const { data, error } = await supabase
    .from('simple_batches')
    .select('*')
    .eq('id', batchId)
    .single()

  if (error || !data) return null
  return data as Batch
}

export async function updateBatchStatus(
  batchId: string,
  status: BatchStatus
): Promise<void> {
  const { error } = await supabase
    .from('simple_batches')
    .update({ status })
    .eq('id', batchId)

  if (error) {
    throw new Error(`Failed to update batch status: ${error.message}`)
  }
}

export async function incrementBatchProgress(
  batchId: string,
  field: 'completed_keywords' | 'failed_keywords'
): Promise<void> {
  // Get current value
  const { data: batch, error: fetchError } = await supabase
    .from('simple_batches')
    .select(field)
    .eq('id', batchId)
    .single()

  if (fetchError || !batch) {
    throw new Error(`Failed to fetch batch: ${fetchError?.message}`)
  }

  // Increment
  const currentValue = (batch as Record<string, number>)[field] || 0
  const { error } = await supabase
    .from('simple_batches')
    .update({ [field]: currentValue + 1 })
    .eq('id', batchId)

  if (error) {
    throw new Error(`Failed to increment ${field}: ${error.message}`)
  }
}

// ============================================================================
// JOB OPERATIONS
// ============================================================================

export async function getJobsForBatch(batchId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('simple_jobs')
    .select('*')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to get jobs: ${error.message}`)
  }

  return (data || []) as Job[]
}

export async function getNextPendingJob(batchId: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from('simple_jobs')
    .select('*')
    .eq('batch_id', batchId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (error || !data) return null
  return data as Job
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  additionalData?: Partial<Job>
): Promise<void> {
  const update: Record<string, unknown> = { status, ...additionalData }

  if (status !== 'pending' && !additionalData?.started_at) {
    const { data } = await supabase
      .from('simple_jobs')
      .select('started_at')
      .eq('id', jobId)
      .single()

    if (data && !data.started_at) {
      update.started_at = new Date().toISOString()
    }
  }

  if (status === 'completed' || status === 'failed') {
    update.completed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('simple_jobs')
    .update(update)
    .eq('id', jobId)

  if (error) {
    throw new Error(`Failed to update job: ${error.message}`)
  }
}

export async function setJobError(jobId: string, error: string): Promise<void> {
  await updateJobStatus(jobId, 'failed', { error })
}

export async function saveJobResearch(
  jobId: string,
  rawResearch: string,
  analyzedResearch: string
): Promise<void> {
  const { error } = await supabase
    .from('simple_jobs')
    .update({
      research_raw: rawResearch,
      research_analyzed: analyzedResearch,
    })
    .eq('id', jobId)

  if (error) {
    throw new Error(`Failed to save research: ${error.message}`)
  }
}

export async function saveNeuronwriterData(
  jobId: string,
  data: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('simple_jobs')
    .update({ neuronwriter_data: data })
    .eq('id', jobId)

  if (error) {
    throw new Error(`Failed to save NeuronWriter data: ${error.message}`)
  }
}

// ============================================================================
// BLOG OPERATIONS
// ============================================================================

export async function saveBlog(
  jobId: string,
  keyword: string,
  title: string,
  content: string,
  metaDescription: string | null,
  neuronwriterScore: number | null
): Promise<Blog> {
  // Count words (Japanese character count)
  const wordCount = content.length

  // Extract internal links
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g
  const internalLinks: string[] = []
  let match
  while ((match = linkRegex.exec(content)) !== null) {
    if (match[2].includes('habitto.com')) {
      internalLinks.push(match[2])
    }
  }

  const { data, error } = await supabase
    .from('simple_blogs')
    .insert({
      job_id: jobId,
      keyword,
      title,
      content,
      meta_description: metaDescription,
      word_count: wordCount,
      internal_links: internalLinks,
      neuronwriter_score: neuronwriterScore,
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to save blog: ${error?.message}`)
  }

  return data as Blog
}

export async function getBlogsForBatch(batchId: string): Promise<Blog[]> {
  // Get job IDs for this batch
  const { data: jobs, error: jobsError } = await supabase
    .from('simple_jobs')
    .select('id')
    .eq('batch_id', batchId)

  if (jobsError || !jobs) {
    throw new Error(`Failed to get jobs: ${jobsError?.message}`)
  }

  const jobIds = jobs.map(j => j.id)

  // Get blogs for these jobs
  const { data: blogs, error: blogsError } = await supabase
    .from('simple_blogs')
    .select('*')
    .in('job_id', jobIds)
    .order('created_at', { ascending: true })

  if (blogsError) {
    throw new Error(`Failed to get blogs: ${blogsError.message}`)
  }

  return (blogs || []) as Blog[]
}

export async function getBlog(jobId: string): Promise<Blog | null> {
  const { data, error } = await supabase
    .from('simple_blogs')
    .select('*')
    .eq('job_id', jobId)
    .single()

  if (error || !data) return null
  return data as Blog
}

export async function getJob(jobId: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from('simple_jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (error || !data) return null
  return data as Job
}

export async function getRecentBatches(limit = 10): Promise<Batch[]> {
  const { data, error } = await supabase
    .from('simple_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to get recent batches: ${error.message}`)
  }

  return (data || []) as Batch[]
}
