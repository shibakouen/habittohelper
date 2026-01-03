/**
 * NeuronWriter Client
 *
 * Handles SEO keyword recommendations and scoring.
 * API Docs: https://neuronwriter.com/faqs/neuronwriter-api-how-to-use/
 */

import { marked } from 'marked'

const NEURONWRITER_API_URL = 'https://app.neuronwriter.com/neuron-api/0.5/writer'
const NEURONWRITER_API_KEY = process.env.NEURONWRITER_API_KEY
const NEURONWRITER_PROJECT_ID = process.env.NEURONWRITER_PROJECT_ID

export interface NeuronWriterAnalysis {
  queryId?: string // NeuronWriter query ID for API calls
  recommendedTerms: string[]
  competitorHeadings: string[]
  wordCountTarget: number
  topKeywords: Array<{
    term: string
    weight: number
  }>
}

export interface NeuronWriterScore {
  score: number
  maxScore: number
  percentage: number
  missingTerms: string[]
  suggestions: string[]
}

/**
 * Make a request to NeuronWriter API
 * All requests use POST method with X-API-KEY header
 */
async function makeRequest(
  endpoint: string,
  body?: Record<string, unknown>
): Promise<unknown> {
  if (!NEURONWRITER_API_KEY) {
    throw new Error('NEURONWRITER_API_KEY is not set')
  }

  const url = `${NEURONWRITER_API_URL}${endpoint}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-KEY': NEURONWRITER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`NeuronWriter API error: ${response.status} - ${error}`)
  }

  return response.json()
}

/**
 * List queries response type (API returns array directly)
 */
type ListQueriesResponse = Array<{
  id: string
  keyword: string
  status: string
  created: string
  updated: string
}>

/**
 * Find existing query for a keyword in the project
 * Uses /list-queries endpoint
 */
async function findExistingQuery(keyword: string): Promise<string | null> {
  try {
    // List queries in the project using correct API endpoint
    // NOTE: API returns array directly, not {queries: [...]}
    const queries = await makeRequest('/list-queries', {
      project: NEURONWRITER_PROJECT_ID,
    }) as ListQueriesResponse

    if (!queries || !Array.isArray(queries)) {
      console.log('[NeuronWriter] No queries returned from /list-queries')
      return null
    }

    // Find a query matching our keyword (exact match)
    const existingQuery = queries.find(
      q => q.keyword.toLowerCase() === keyword.toLowerCase()
    )

    if (existingQuery) {
      console.log(`[NeuronWriter] Found existing query for "${keyword}": ${existingQuery.id}`)
      return existingQuery.id
    }

    console.log(`[NeuronWriter] No existing query found for "${keyword}" in ${queries.length} queries`)
    return null
  } catch (error) {
    console.warn('[NeuronWriter] Could not list existing queries:', error)
    return null
  }
}

/**
 * Get query response type (from NeuronWriter API)
 */
interface GetQueryResponse {
  status?: string
  keyword?: string
  language?: string
  engine?: string
  project?: string
  query?: string
  ideas?: {
    suggest_questions?: Array<{ q: string }>
    people_also_ask?: Array<{ q: string }>
    topic_matrix?: Record<string, { importance: number }>
  }
  terms?: {
    title?: Array<{ t: string; usage_pc: number }>
    desc?: Array<{ t: string; usage_pc: number }>
    h1?: Array<{ t: string; usage_pc: number }>
    h2?: Array<{ t: string; usage_pc: number }>
    content_basic?: Array<{ t: string; usage_pc: number; sugg_usage?: [number, number] }>
    content_extended?: Array<{ t: string; usage_pc: number; sugg_usage?: [number, number] }>
    // Entities array with all aggregated keywords
    entities?: Array<{
      t: string // term
      importance: number
      relevance: number
      confidence: number
      links?: Array<[string, string]>
    }>
  }
  competitors?: Array<{
    rank?: number
    url: string
    title: string
    desc?: string
    headers?: Array<[string, string]> // [level, text]
    content_score?: number
    readability?: number
    word_count?: number
  }>
}

/**
 * Get keyword analysis from NeuronWriter
 * First checks for existing queries to avoid wasting credits
 */
export async function analyzeKeyword(keyword: string): Promise<NeuronWriterAnalysis> {
  console.log(`[NeuronWriter] === analyzeKeyword("${keyword}") START ===`)
  console.log(`[NeuronWriter] API Key set: ${!!NEURONWRITER_API_KEY}, Project ID set: ${!!NEURONWRITER_PROJECT_ID}`)

  try {
    // Step 1: Check for existing query first (saves credits!)
    console.log(`[NeuronWriter] Step 1: Checking for existing query...`)
    const existingQueryId = await findExistingQuery(keyword)

    if (existingQueryId) {
      console.log(`[NeuronWriter] Using existing query: ${existingQueryId}`)
      const existingData = await makeRequest('/get-query', {
        query: existingQueryId,
      }) as GetQueryResponse

      // DEBUG: Check what keys are in the response
      console.log('[NeuronWriter] Response keys:', Object.keys(existingData))
      console.log('[NeuronWriter] Has entities?:', !!existingData.terms?.entities)
      console.log('[NeuronWriter] Entities count:', existingData.terms?.entities?.length || 0)

      if (existingData.status === 'ready' && existingData.competitors) {
        console.log(`[NeuronWriter] Successfully retrieved existing data for "${keyword}"`)
        console.log(`[NeuronWriter] Competitors count:`, existingData.competitors?.length || 0)
        return parseQueryResponse(existingData, existingQueryId)
      }
    }

    // Step 2: No existing query found, create new one
    console.log(`[NeuronWriter] Creating NEW query for "${keyword}" (will use credits)`)
    const createResponse = await makeRequest('/new-query', {
      project: NEURONWRITER_PROJECT_ID,
      keyword: keyword,
      language: 'Japanese',  // NeuronWriter requires full language name
      engine: 'google.co.jp',
    }) as { query?: string; status?: string }

    const queryId = createResponse.query

    if (!queryId) {
      console.warn('[NeuronWriter] Could not create query, response:', createResponse)
      return getFallbackAnalysis(keyword)
    }

    console.log(`[NeuronWriter] Created query ${queryId}, waiting for processing...`)

    // Poll for results (NeuronWriter processes async)
    let attempts = 0
    const maxAttempts = 20 // More attempts, queries can take time

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)) // 5 sec intervals

      const statusResponse = await makeRequest('/get-query', {
        query: queryId,
      }) as GetQueryResponse

      console.log(`[NeuronWriter] Poll ${attempts + 1}/${maxAttempts}, status: ${statusResponse.status}`)

      if (statusResponse.status === 'ready' && statusResponse.terms?.entities) {
        console.log(`[NeuronWriter] Query ready! Got ${statusResponse.terms.entities.length || 0} entities`)
        return parseQueryResponse(statusResponse, queryId)
      }

      if (statusResponse.status === 'error') {
        console.warn('[NeuronWriter] Query failed')
        // Pass queryId so we can still import content to NeuronWriter later
        return getFallbackAnalysis(keyword, queryId)
      }

      attempts++
    }

    console.warn('[NeuronWriter] Timeout waiting for query')
    // Pass queryId so we can still import content to NeuronWriter later
    return getFallbackAnalysis(keyword, queryId)
  } catch (error) {
    console.error('[NeuronWriter] === ERROR CAUGHT ===')
    console.error('[NeuronWriter] Error type:', typeof error)
    console.error('[NeuronWriter] Error:', error)
    console.error('[NeuronWriter] Error message:', error instanceof Error ? error.message : String(error))
    console.error('[NeuronWriter] Stack:', error instanceof Error ? error.stack : 'No stack')
    console.error('[NeuronWriter] Falling back to generated terms')
    return getFallbackAnalysis(keyword)
  }
}

/**
 * Parse /get-query response into our format
 */
function parseQueryResponse(response: GetQueryResponse, queryId?: string): NeuronWriterAnalysis {
  console.log('[NeuronWriter] Parsing response...')
  console.log('[NeuronWriter] Query ID:', queryId)
  console.log('[NeuronWriter] terms.entities count:', response.terms?.entities?.length || 0)
  console.log('[NeuronWriter] Competitors:', response.competitors?.length || 0)

  // Use terms.entities array (already aggregated by NeuronWriter)
  if (response.terms?.entities && response.terms.entities.length > 0) {
    // Sort by importance
    const sortedEntities = [...response.terms.entities]
      .sort((a, b) => b.importance - a.importance)
      .map(e => ({ term: e.t, importance: e.importance }))

    console.log('[NeuronWriter] Found', sortedEntities.length, 'entities')
    console.log('[NeuronWriter] Top 10:', sortedEntities.slice(0, 10).map(e => e.term).join(', '))

    // Extract competitor headings
    const headings = (response.competitors || [])
      .flatMap(c => (c.headers || []).map(([level, text]) => text))
      .filter(Boolean)

    console.log('[NeuronWriter] Headings extracted:', headings.length)

    // Get average word count as target
    const wordCounts = (response.competitors || []).map(c => c.word_count || 0).filter(wc => wc > 0)
    const avgWordCount = wordCounts.length > 0
      ? Math.round(wordCounts.reduce((sum, wc) => sum + wc, 0) / wordCounts.length)
      : 3000

    console.log('[NeuronWriter] Average word count:', avgWordCount)

    return {
      queryId,
      recommendedTerms: sortedEntities.map(e => e.term),
      competitorHeadings: headings.slice(0, 20),
      wordCountTarget: avgWordCount,
      topKeywords: sortedEntities.slice(0, 50).map(e => ({
        term: e.term,
        weight: e.importance,
      })),
    }
  }

  console.warn('[NeuronWriter] No entities found in response.terms, using fallback')
  // Pass queryId to preserve it even when using fallback data
  return getFallbackAnalysis('', queryId)
}

/**
 * Get fallback analysis when NeuronWriter is unavailable
 * IMPORTANT: Always pass queryId if available to prevent fake IDs from being stored
 */
function getFallbackAnalysis(keyword: string, queryId?: string): NeuronWriterAnalysis {
  // Generate reasonable defaults based on the keyword
  const relatedTerms = generateRelatedTerms(keyword)

  return {
    queryId, // Preserve real NeuronWriter queryId even when using fallback data
    recommendedTerms: relatedTerms,
    competitorHeadings: [
      `${keyword}とは？基礎知識を解説`,
      `${keyword}のメリット・デメリット`,
      `${keyword}の始め方・やり方`,
      `${keyword}の選び方のポイント`,
      `${keyword}に関するよくある質問`,
      `まとめ：${keyword}で賢くお金を管理しよう`,
    ],
    wordCountTarget: 3000,
    topKeywords: relatedTerms.slice(0, 10).map((term, i) => ({
      term,
      weight: 100 - i * 5,
    })),
  }
}

/**
 * Generate related terms based on keyword (for fallback)
 */
function generateRelatedTerms(keyword: string): string[] {
  const baseTerms = [
    keyword,
    `${keyword} とは`,
    `${keyword} やり方`,
    `${keyword} メリット`,
    `${keyword} デメリット`,
    `${keyword} 初心者`,
    `${keyword} おすすめ`,
    `${keyword} 比較`,
    `${keyword} 2024`,
    `${keyword} コツ`,
  ]

  // Add Habitto-specific terms
  const habittoTerms = [
    '貯蓄',
    '金利',
    '節約',
    '貯金',
    'デビットカード',
    'キャッシュバック',
    '高金利',
    'ネット銀行',
  ]

  return [...baseTerms, ...habittoTerms.filter(t => !baseTerms.includes(t))]
}

/**
 * Calculate content score based on NeuronWriter recommendations
 * Returns detailed breakdown for retry logic
 */
export function calculateScore(
  content: string,
  analysis: NeuronWriterAnalysis
): NeuronWriterScore {
  const contentLower = content.toLowerCase()

  // Split keywords into tiers (matching writeBlog's structure)
  const criticalTerms = analysis.recommendedTerms.slice(0, 10)
  const importantTerms = analysis.recommendedTerms.slice(10, 25)
  const supportingTerms = analysis.recommendedTerms.slice(25)

  // Count occurrences and track missing keywords
  const missingCritical: string[] = []
  const missingImportant: string[] = []
  let criticalScore = 0
  let importantScore = 0
  let supportingScore = 0

  // Critical terms (weighted 3x)
  for (const term of criticalTerms) {
    const count = countOccurrences(contentLower, term.toLowerCase())
    if (count >= 3) {
      criticalScore += 3 // Full points for 3+ occurrences
    } else if (count >= 1) {
      criticalScore += count // Partial points
      missingCritical.push(term) // Still flag as needing more
    } else {
      missingCritical.push(term)
    }
  }

  // Important terms (weighted 2x)
  for (const term of importantTerms) {
    const count = countOccurrences(contentLower, term.toLowerCase())
    if (count >= 1) {
      importantScore += Math.min(count, 2) // Max 2 points each
    } else {
      missingImportant.push(term)
    }
  }

  // Supporting terms (weighted 1x)
  for (const term of supportingTerms) {
    if (contentLower.includes(term.toLowerCase())) {
      supportingScore += 1
    }
  }

  // Calculate weighted percentage
  const maxCritical = criticalTerms.length * 3
  const maxImportant = importantTerms.length * 2
  const maxSupporting = supportingTerms.length

  const totalScore = criticalScore + importantScore + supportingScore
  const maxScore = maxCritical + maxImportant + maxSupporting

  // Weight critical terms more heavily in final percentage
  const criticalPct = maxCritical > 0 ? (criticalScore / maxCritical) * 50 : 50
  const importantPct = maxImportant > 0 ? (importantScore / maxImportant) * 30 : 30
  const supportingPct = maxSupporting > 0 ? (supportingScore / maxSupporting) * 20 : 20

  const percentage = Math.round(criticalPct + importantPct + supportingPct)

  // Generate prioritized suggestions
  const suggestions: string[] = []

  if (missingCritical.length > 0) {
    suggestions.push(`【優先】以下のクリティカルキーワードが不足: ${missingCritical.slice(0, 5).join('、')}`)
  }

  if (missingImportant.length > 3) {
    suggestions.push(`重要キーワード${missingImportant.length}個が不足`)
  }

  // Check word count
  const wordCount = content.length
  if (wordCount < analysis.wordCountTarget * 0.8) {
    suggestions.push(`文字数不足: ${wordCount}文字 / 目標${analysis.wordCountTarget}文字`)
  }

  // Combine missing terms (critical first, then important)
  const allMissing = [...missingCritical, ...missingImportant.slice(0, 5)]

  return {
    score: totalScore,
    maxScore,
    percentage,
    missingTerms: allMissing,
    suggestions,
  }
}

/**
 * Count occurrences of a term in content
 */
function countOccurrences(content: string, term: string): number {
  const regex = new RegExp(escapeRegex(term), 'gi')
  const matches = content.match(regex)
  return matches ? matches.length : 0
}

/**
 * Escape special regex characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Prepared content for NeuronWriter API
 */
export interface PreparedContent {
  html: string
  title: string
  description: string
}

/**
 * Convert markdown content to HTML and extract title/meta description
 * for NeuronWriter's /import-content endpoint
 */
export function prepareContentForNW(
  markdownContent: string,
  keyword: string
): PreparedContent {
  // Convert markdown to HTML
  const html = marked.parse(markdownContent, { async: false }) as string

  // Extract title from first H1, or generate from keyword
  const titleMatch = markdownContent.match(/^#\s+(.+)$/m)
  const title = titleMatch
    ? titleMatch[1].trim()
    : `${keyword}｜完全ガイド`

  // Extract meta description from content
  // Look for: 1) explicit meta in frontmatter, 2) first paragraph after intro, 3) generate
  let description = ''

  // Try to find first substantial paragraph (not a heading, list, or short line)
  const lines = markdownContent.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    // Skip headings, empty lines, lists, and short lines
    if (
      !trimmed ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('-') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('1.') ||
      trimmed.length < 50
    ) {
      continue
    }
    // Found a substantial paragraph
    description = trimmed
      .replace(/\*\*/g, '') // Remove bold
      .replace(/\*/g, '') // Remove italics
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
      .substring(0, 160) // Meta description limit
    break
  }

  // Fallback: generate from keyword
  if (!description) {
    description = `${keyword}について詳しく解説。初心者にもわかりやすく、${keyword}の基礎知識から実践的なコツまで紹介します。`
  }

  // Ensure description ends nicely (not mid-word)
  if (description.length >= 155) {
    const lastSpace = description.lastIndexOf(' ', 155)
    const lastPunctuation = Math.max(
      description.lastIndexOf('。', 155),
      description.lastIndexOf('、', 155),
      description.lastIndexOf('！', 155)
    )
    const cutoff = Math.max(lastSpace, lastPunctuation)
    if (cutoff > 100) {
      description = description.substring(0, cutoff)
    }
  }

  console.log('[NW Prep] Title:', title)
  console.log('[NW Prep] Description:', description.substring(0, 50) + '...')
  console.log('[NW Prep] HTML length:', html.length)

  return { html, title, description }
}
