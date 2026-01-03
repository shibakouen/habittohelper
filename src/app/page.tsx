'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

type JobStatus = 'pending' | 'researching' | 'analyzing' | 'writing' | 'completed' | 'failed'
type BatchStatus = 'pending' | 'running' | 'completed' | 'failed'

interface JobDetail {
  id: string
  keyword: string
  status: JobStatus
  error: string | null
}

interface BatchResponse {
  batch: {
    id: string
    status: BatchStatus
    totalKeywords: number
    completedKeywords: number
    failedKeywords: number
    useNeuronwriter: boolean
  }
  activeJob: {
    id: string
    keyword: string
    status: JobStatus
  } | null
  jobDetails: JobDetail[]
}

interface Blog {
  id: string
  jobId: string
  keyword: string
  title: string
  content: string
  metaDescription: string | null
  wordCount: number | null
  internalLinks: string[]
  neuronwriterScore: number | null
}

interface ResearchData {
  researchRaw: string | null
  researchAnalyzed: string | null
  neuronwriterData: Record<string, unknown> | null
}

type ModalTab = 'article' | 'research'

interface PreviousBatch {
  id: string
  status: BatchStatus
  totalKeywords: number
  completedKeywords: number
  failedKeywords: number
  blogCount: number
  useNeuronwriter: boolean
  createdAt: string
}

function HomeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [keywords, setKeywords] = useState('')
  const [useNeuronwriter, setUseNeuronwriter] = useState(true)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [batch, setBatch] = useState<BatchResponse | null>(null)
  const [blogs, setBlogs] = useState<Blog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedBlog, setSelectedBlog] = useState<Blog | null>(null)
  const [activeTab, setActiveTab] = useState<ModalTab>('article')
  const [researchData, setResearchData] = useState<ResearchData | null>(null)
  const [isLoadingResearch, setIsLoadingResearch] = useState(false)
  const [previousBatches, setPreviousBatches] = useState<PreviousBatch[]>([])
  const [isLoadingBatches, setIsLoadingBatches] = useState(true)
  const [isLoadingBlogs, setIsLoadingBlogs] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // URL state helpers
  const updateURL = useCallback((params: { batch?: string | null; blog?: string | null }) => {
    const newParams = new URLSearchParams()
    if (params.batch) newParams.set('batch', params.batch)
    if (params.blog) newParams.set('blog', params.blog)
    const queryString = newParams.toString()
    router.push(queryString ? `?${queryString}` : '/', { scroll: false })
  }, [router])

  // Count keywords
  const keywordList = keywords
    .split('\n')
    .map(k => k.trim())
    .filter(k => k.length > 0)
  const keywordCount = keywordList.length

  // Sync URL params to app state (handles back/forward navigation)
  useEffect(() => {
    const urlBatchId = searchParams.get('batch')
    const urlBlogId = searchParams.get('blog')

    const syncState = async () => {
      // If URL has batch param but we don't have blogs loaded for it
      if (urlBatchId && (batchId !== urlBatchId || blogs.length === 0)) {
        setIsLoadingBlogs(true)
        try {
          const res = await fetch(`/api/batch/${urlBatchId}/blogs`)
          if (res.ok) {
            const data = await res.json()
            const loadedBlogs = data.blogs || []
            setBlogs(loadedBlogs)
            setBatchId(urlBatchId)

            // If URL also has blog param, select that blog
            if (urlBlogId && loadedBlogs.length > 0) {
              const blogToSelect = loadedBlogs.find((b: Blog) => b.id === urlBlogId)
              if (blogToSelect) {
                setSelectedBlog(blogToSelect)
                setActiveTab('article')
                // Fetch research data
                try {
                  const researchRes = await fetch(`/api/job/${blogToSelect.jobId}/research`)
                  if (researchRes.ok) {
                    const researchData = await researchRes.json()
                    setResearchData({
                      researchRaw: researchData.researchRaw,
                      researchAnalyzed: researchData.researchAnalyzed,
                      neuronwriterData: researchData.neuronwriterData,
                    })
                  }
                } catch {
                  // Ignore research fetch errors
                }
              }
            } else {
              setSelectedBlog(null)
            }
          }
        } catch (err) {
          console.error('Failed to load batch from URL:', err)
        } finally {
          setIsLoadingBlogs(false)
        }
      } else if (!urlBatchId && blogs.length > 0 && !isProcessing) {
        // URL has no batch param but we have blogs - clear them (back to home)
        setBlogs([])
        setBatchId(null)
        setSelectedBlog(null)
        setResearchData(null)
      } else if (urlBatchId && !urlBlogId && selectedBlog) {
        // URL has batch but no blog - close modal (back from blog view)
        setSelectedBlog(null)
        setResearchData(null)
      } else if (urlBatchId && urlBlogId && blogs.length > 0) {
        // URL has both batch and blog - ensure correct blog is selected
        const blogToSelect = blogs.find(b => b.id === urlBlogId)
        if (blogToSelect && selectedBlog?.id !== urlBlogId) {
          setSelectedBlog(blogToSelect)
          setActiveTab('article')
          // Fetch research data
          try {
            const researchRes = await fetch(`/api/job/${blogToSelect.jobId}/research`)
            if (researchRes.ok) {
              const researchData = await researchRes.json()
              setResearchData({
                researchRaw: researchData.researchRaw,
                researchAnalyzed: researchData.researchAnalyzed,
                neuronwriterData: researchData.neuronwriterData,
              })
            }
          } catch {
            // Ignore research fetch errors
          }
        }
      }
      setIsInitialized(true)
    }

    syncState()
  }, [searchParams, batchId, blogs.length, isProcessing, selectedBlog?.id])

  // Load previous batches on mount
  useEffect(() => {
    const loadBatches = async () => {
      try {
        const res = await fetch('/api/batches')
        if (res.ok) {
          const data = await res.json()
          setPreviousBatches(data.batches || [])
        }
      } catch (err) {
        console.error('Failed to load batches:', err)
      } finally {
        setIsLoadingBatches(false)
      }
    }
    loadBatches()
  }, [])

  // Load blogs from a previous batch
  const loadPreviousBatch = async (prevBatchId: string) => {
    // Update URL first - this will trigger the sync effect
    updateURL({ batch: prevBatchId, blog: null })
  }

  // Poll for batch status
  useEffect(() => {
    if (!batchId || !isProcessing) return

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/batch/${batchId}`)
        const data: BatchResponse = await res.json()
        setBatch(data)

        // Check if done
        if (data.batch.status === 'completed' || data.batch.status === 'failed') {
          setIsProcessing(false)
          if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
          }

          // Fetch blogs
          const blogsRes = await fetch(`/api/batch/${batchId}/blogs`)
          const blogsData = await blogsRes.json()
          setBlogs(blogsData.blogs || [])

          // Update URL to show this batch
          updateURL({ batch: batchId, blog: null })
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }

    pollRef.current = setInterval(pollStatus, 2000)
    pollStatus() // Initial poll

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [batchId, isProcessing, updateURL])

  // Fetch research data when a blog is selected
  const fetchResearch = async (jobId: string) => {
    setIsLoadingResearch(true)
    try {
      const res = await fetch(`/api/job/${jobId}/research`)
      if (res.ok) {
        const data = await res.json()
        setResearchData({
          researchRaw: data.researchRaw,
          researchAnalyzed: data.researchAnalyzed,
          neuronwriterData: data.neuronwriterData,
        })
      }
    } catch (err) {
      console.error('Failed to fetch research:', err)
    } finally {
      setIsLoadingResearch(false)
    }
  }

  // Handle blog selection
  const handleSelectBlog = (blog: Blog) => {
    setSelectedBlog(blog)
    setActiveTab('article')
    setResearchData(null)
    fetchResearch(blog.jobId)
    // Update URL with blog param
    if (batchId) {
      updateURL({ batch: batchId, blog: blog.id })
    }
  }

  // Close modal
  const handleCloseModal = () => {
    setSelectedBlog(null)
    setActiveTab('article')
    setResearchData(null)
    // Update URL - keep batch, remove blog
    if (batchId) {
      updateURL({ batch: batchId, blog: null })
    }
  }

  const handleStart = async () => {
    if (keywordCount === 0) {
      setError('Please enter at least one keyword')
      return
    }

    if (keywordCount > 500) {
      setError('Maximum 500 keywords allowed')
      return
    }

    setError(null)
    setIsLoading(true)
    setBatch(null)
    setBlogs([])
    setSelectedBlog(null)

    try {
      // Create batch
      const createRes = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: keywordList,
          useNeuronwriter,
        }),
      })

      if (!createRes.ok) {
        const err = await createRes.json()
        throw new Error(err.error || 'Failed to create batch')
      }

      const createData = await createRes.json()
      setBatchId(createData.batchId)
      setIsProcessing(true)

      // Start processing
      fetch(`/api/batch/${createData.batchId}/process`, {
        method: 'POST',
      }).catch(console.error)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500'
      case 'failed':
        return 'bg-red-500'
      case 'researching':
      case 'analyzing':
      case 'writing':
        return 'bg-blue-500 animate-pulse'
      default:
        return 'bg-gray-300'
    }
  }

  const getStatusLabel = (status: JobStatus) => {
    switch (status) {
      case 'pending':
        return 'Pending'
      case 'researching':
        return 'Researching...'
      case 'analyzing':
        return 'Analyzing...'
      case 'writing':
        return 'Writing...'
      case 'completed':
        return 'Done'
      case 'failed':
        return 'Failed'
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">
            Habitto Blog Generator
          </h1>
          <span className="text-sm text-gray-500">Simple Mode</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Input Section */}
        {!isProcessing && blogs.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4">Generate Blog Articles</h2>

            {/* Keyword Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Keywords (one per line, max 500)
              </label>
              <textarea
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                placeholder="貯金 コツ
投資 初心者
NISA 始め方"
                className="w-full h-48 px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                {keywordCount} keyword{keywordCount !== 1 ? 's' : ''} entered
              </p>
            </div>

            {/* NeuronWriter Toggle */}
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useNeuronwriter}
                  onChange={e => setUseNeuronwriter(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Use NeuronWriter SEO optimization
                </span>
              </label>
              <p className="mt-1 ml-8 text-xs text-gray-500">
                Adds SEO keywords and calculates content score (slower but better SEO)
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Start Button */}
            <button
              onClick={handleStart}
              disabled={isLoading || keywordCount === 0}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Creating...' : `Start Generation (${keywordCount} keywords)`}
            </button>
          </div>
        )}

        {/* Previous Batches Section */}
        {!isProcessing && blogs.length === 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4">Previous Generations</h2>

            {isLoadingBatches ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : previousBatches.filter(b => b.blogCount > 0).length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                No previous generations found. Generate your first blog above!
              </p>
            ) : (
              <div className="space-y-3">
                {previousBatches
                  .filter(b => b.blogCount > 0)
                  .map(prevBatch => (
                    <div
                      key={prevBatch.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:border-blue-300 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            prevBatch.status === 'completed' ? 'bg-green-500' :
                            prevBatch.status === 'failed' ? 'bg-red-500' :
                            prevBatch.status === 'running' ? 'bg-blue-500 animate-pulse' :
                            'bg-gray-300'
                          }`} />
                          <span className="font-medium text-sm text-gray-900">
                            {prevBatch.blogCount} blog{prevBatch.blogCount !== 1 ? 's' : ''}
                          </span>
                          {prevBatch.useNeuronwriter && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                              SEO
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(prevBatch.createdAt).toLocaleDateString('ja-JP', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <button
                        onClick={() => loadPreviousBatch(prevBatch.id)}
                        disabled={isLoadingBlogs}
                        className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isLoadingBlogs ? 'Loading...' : 'View'}
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Progress Section */}
        {isProcessing && batch && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Processing...</h2>
              <span className="text-sm text-gray-500">
                {batch.batch.completedKeywords + batch.batch.failedKeywords} / {batch.batch.totalKeywords}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{
                    width: `${((batch.batch.completedKeywords + batch.batch.failedKeywords) / batch.batch.totalKeywords) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Active Job */}
            {batch.activeJob && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-700">
                  {getStatusLabel(batch.activeJob.status)}: {batch.activeJob.keyword}
                </p>
              </div>
            )}

            {/* Job List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {batch.jobDetails.map(job => (
                <div
                  key={job.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-gray-50"
                >
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(job.status)}`} />
                  <span className="flex-1 text-sm truncate">{job.keyword}</span>
                  <span className="text-xs text-gray-500">{getStatusLabel(job.status)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results Section */}
        {blogs.length > 0 && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-2">Generation Complete</h2>
              <p className="text-sm text-gray-600">
                {blogs.length} blog{blogs.length !== 1 ? 's' : ''} generated
              </p>

              <button
                onClick={async () => {
                  setBatchId(null)
                  setBatch(null)
                  setBlogs([])
                  setKeywords('')
                  setSelectedBlog(null)
                  // Update URL to home
                  updateURL({ batch: null, blog: null })
                  // Reload previous batches
                  setIsLoadingBatches(true)
                  try {
                    const res = await fetch('/api/batches')
                    if (res.ok) {
                      const data = await res.json()
                      setPreviousBatches(data.batches || [])
                    }
                  } catch (err) {
                    console.error('Failed to reload batches:', err)
                  } finally {
                    setIsLoadingBatches(false)
                  }
                }}
                className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Generate More
              </button>
            </div>

            {/* Blog List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {blogs.map(blog => (
                <div
                  key={blog.id}
                  onClick={() => handleSelectBlog(blog)}
                  className="bg-white rounded-lg shadow-sm border p-4 cursor-pointer hover:border-blue-500 transition-colors"
                >
                  <h3 className="font-medium text-gray-900 mb-1 truncate">{blog.title}</h3>
                  <p className="text-sm text-gray-500 mb-2">Keyword: {blog.keyword}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>{blog.wordCount?.toLocaleString() || 0} chars</span>
                    <span>{blog.internalLinks.length} links</span>
                    {blog.neuronwriterScore !== null && (
                      <span className={blog.neuronwriterScore >= 60 ? 'text-green-600' : 'text-yellow-600'}>
                        Score: {blog.neuronwriterScore}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Blog Modal */}
        {selectedBlog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedBlog.title}</h3>
                  <p className="text-sm text-gray-500">Keyword: {selectedBlog.keyword}</p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab('article')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'article'
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Article
                </button>
                <button
                  onClick={() => setActiveTab('research')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'research'
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Research Data
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'article' ? (
                  <>
                    {/* Meta Description */}
                    {selectedBlog.metaDescription && (
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-medium text-gray-500 mb-1">Meta Description</p>
                        <p className="text-sm text-gray-700">{selectedBlog.metaDescription}</p>
                      </div>
                    )}

                    {/* Content */}
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
                        {selectedBlog.content}
                      </pre>
                    </div>
                  </>
                ) : (
                  /* Research Tab */
                  <div className="space-y-6">
                    {isLoadingResearch ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    ) : researchData ? (
                      <>
                        {/* Analyzed Research */}
                        {researchData.researchAnalyzed && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              Analyzed Research
                            </h4>
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
                                {researchData.researchAnalyzed}
                              </pre>
                            </div>
                          </div>
                        )}

                        {/* Raw Research */}
                        {researchData.researchRaw && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Raw Research Data
                            </h4>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                              <pre className="whitespace-pre-wrap font-mono text-xs text-gray-600 leading-relaxed">
                                {researchData.researchRaw}
                              </pre>
                            </div>
                          </div>
                        )}

                        {/* NeuronWriter Data */}
                        {researchData.neuronwriterData && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              NeuronWriter SEO Data
                            </h4>
                            <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                              <pre className="whitespace-pre-wrap font-mono text-xs text-gray-700 leading-relaxed">
                                {JSON.stringify(researchData.neuronwriterData, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}

                        {/* No data state */}
                        {!researchData.researchAnalyzed && !researchData.researchRaw && !researchData.neuronwriterData && (
                          <div className="text-center py-12 text-gray-500">
                            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-sm">No research data available for this article</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-sm">No research data available</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  {selectedBlog.wordCount?.toLocaleString() || 0} chars | {selectedBlog.internalLinks.length} links
                  {selectedBlog.neuronwriterScore !== null && ` | Score: ${selectedBlog.neuronwriterScore}%`}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(selectedBlog.content)}
                    className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-lg"
                  >
                    Copy Content
                  </button>
                  <button
                    onClick={() => {
                      const blob = new Blob([selectedBlog.content], { type: 'text/markdown' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${selectedBlog.keyword.replace(/\s+/g, '-')}.md`
                      a.click()
                    }}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
                  >
                    Download
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// Loading fallback for Suspense
function HomeLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">
            Habitto Blog Generator
          </h1>
          <span className="text-sm text-gray-500">Simple Mode</span>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </main>
    </div>
  )
}

// Export with Suspense wrapper for useSearchParams
export default function Home() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeContent />
    </Suspense>
  )
}
