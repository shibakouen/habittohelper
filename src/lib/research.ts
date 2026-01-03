/**
 * Deep Research Service
 *
 * Uses Claude's web_search tool to gather up-to-date information
 * for blog content generation.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { ResearchData, ResearchResult } from './writer-db'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// Use Sonnet 4.5 for research (good balance of quality and speed)
const RESEARCH_MODEL = 'claude-sonnet-4-5-20250929'

/**
 * Web search tool definition for Claude API
 */
const webSearchTool = {
  type: 'web_search_20250305' as const,
  name: 'web_search' as const,
  max_uses: 5,
  user_location: {
    type: 'approximate' as const,
    city: 'Tokyo',
    region: 'Tokyo',
    country: 'JP',
    timezone: 'Asia/Tokyo',
  },
}

/**
 * Project context for research
 */
export interface ProjectContext {
  brandVoice?: string
  targetAudience?: string
  topicFocus?: string
}

/**
 * Options for research execution
 */
export interface ResearchOptions {
  maxSearches?: number
  maxAgeMonths?: number
  locale?: 'ja' | 'en'
}

/**
 * Build semantic search queries from keyword and context
 * Generates diverse angles to get comprehensive coverage
 */
export function buildSearchQueries(
  keyword: string,
  context: ProjectContext
): string[] {
  const queries: string[] = []

  // Use dynamic years based on current date
  const currentYear = new Date().getFullYear()
  const lastYear = currentYear - 1

  // Main keyword query with recency indicator
  queries.push(`${keyword} ${lastYear} ${currentYear} 最新`)

  // Statistics and data angle
  queries.push(`${keyword} 統計 データ 調査 最新`)

  // How-to / practical angle
  queries.push(`${keyword} やり方 方法 コツ`)

  // Comparison / options angle
  queries.push(`${keyword} おすすめ 比較 ランキング`)

  // If we have target audience context, add demographic-specific query
  if (context.targetAudience) {
    queries.push(`${keyword} ${context.targetAudience}`)
  }

  return queries.slice(0, 5) // Max 5 queries
}

/**
 * Parse web search results from Claude response
 */
function parseSearchResults(
  content: Anthropic.ContentBlock[]
): { queries: string[]; rawResults: RawSearchResult[] } {
  const queries: string[] = []
  const rawResults: RawSearchResult[] = []

  for (const block of content) {
    // Extract search queries used
    if (block.type === 'server_tool_use' && block.name === 'web_search') {
      const input = block.input as { query?: string }
      if (input?.query) {
        queries.push(input.query)
      }
    }

    // Extract search results
    if (block.type === 'web_search_tool_result') {
      const results = (block.content || []) as Array<{
        type: string
        url?: string
        title?: string
        page_age?: string
        encrypted_content?: string
      }>

      for (const result of results) {
        if (result.type === 'web_search_result' && result.url && result.title) {
          rawResults.push({
            url: result.url,
            title: result.title,
            pageAge: result.page_age || null,
          })
        }
      }
    }
  }

  return { queries, rawResults }
}

interface RawSearchResult {
  url: string
  title: string
  pageAge: string | null
}

/**
 * Extract citations from Claude's response
 */
function extractCitations(
  content: Anthropic.ContentBlock[]
): Map<string, string> {
  const citations = new Map<string, string>()

  for (const block of content) {
    if (block.type === 'text' && block.citations) {
      for (const citation of block.citations) {
        if (citation.type === 'web_search_result_location') {
          const loc = citation as {
            url?: string
            cited_text?: string
          }
          if (loc.url && loc.cited_text) {
            // Append to existing citations for this URL
            const existing = citations.get(loc.url) || ''
            citations.set(loc.url, existing + ' ' + loc.cited_text)
          }
        }
      }
    }
  }

  return citations
}

/**
 * Extract the summary text from Claude's response
 */
function extractSummary(content: Anthropic.ContentBlock[]): string {
  const textParts: string[] = []

  for (const block of content) {
    if (block.type === 'text') {
      textParts.push(block.text)
    }
  }

  return textParts.join('')
}

/**
 * Filter results by recency (prefer content less than N months old)
 */
export function filterByRecency(
  results: ResearchResult[],
  maxAgeMonths: number = 12
): ResearchResult[] {
  const now = new Date()
  const cutoffDate = new Date(now.setMonth(now.getMonth() - maxAgeMonths))

  return results.filter(result => {
    if (!result.pageAge) return true // Keep if no date info

    // Try to parse the page age
    const dateMatch = result.pageAge.match(
      /(\w+)\s+(\d{1,2}),?\s+(\d{4})/
    )
    if (!dateMatch) return true // Keep if can't parse

    try {
      const pageDate = new Date(result.pageAge)
      return pageDate >= cutoffDate
    } catch {
      return true // Keep if parsing fails
    }
  })
}

/**
 * Execute deep research using Claude's web search tool
 */
export async function executeResearch(
  keyword: string,
  context: ProjectContext = {},
  options: ResearchOptions = {}
): Promise<ResearchData> {
  const { maxAgeMonths = 12 } = options

  console.log(`[Research] Starting research for keyword: "${keyword}"`)

  // Get current date for dynamic year references
  const now = new Date()
  const currentYear = now.getFullYear()
  const lastYear = currentYear - 1
  const currentDate = now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })

  // Build the research prompt
  const researchPrompt = `あなたは金融・貯蓄に関する日本語ブログ記事のためのリサーチャーです。

【重要】本日は${currentDate}です。最新の情報を検索してください。

以下のキーワードについて、最新かつ信頼性の高い情報を調査してください：

【調査キーワード】
${keyword}

【調査の観点】
1. 最新の統計データや調査結果（${lastYear}年〜${currentYear}年のデータを優先）
2. 専門家や公的機関からの情報
3. 実践的なアドバイスや具体的な方法
4. 比較やランキング情報
5. 初心者向けの基礎知識

【出力要件】
- 複数の検索を実行して包括的な情報を集めてください
- 各情報源の日付を確認し、できるだけ新しい情報を優先してください
- 統計データは出典を明確にしてください
- 最後に、ブログ記事作成に役立つ形で要点をまとめてください
- 本日の日付（${currentDate}）を基準に、最新のデータを使用してください

【ターゲット読者】
${context.targetAudience || '20〜40代の金融初心者、貯蓄を始めたい・増やしたい人'}

日本語で検索し、日本語で回答してください。`

  try {
    const response = await anthropic.messages.create({
      model: RESEARCH_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: researchPrompt }],
      tools: [webSearchTool],
    })

    console.log(`[Research] API call complete. Stop reason: ${response.stop_reason}`)
    console.log(`[Research] Web searches: ${response.usage?.server_tool_use?.web_search_requests || 0}`)

    // Parse the response
    const { queries, rawResults } = parseSearchResults(response.content)
    const citations = extractCitations(response.content)
    const summary = extractSummary(response.content)

    console.log(`[Research] Found ${rawResults.length} results from ${queries.length} queries`)

    // Build structured results with citations
    const results: ResearchResult[] = rawResults.map(raw => ({
      url: raw.url,
      title: raw.title,
      pageAge: raw.pageAge,
      keyFindings: '', // Will be populated from summary
      citedText: citations.get(raw.url)?.trim() || '',
    }))

    // Filter by recency
    const filteredResults = filterByRecency(results, maxAgeMonths)
    console.log(`[Research] After recency filter: ${filteredResults.length} results`)

    // Extract key findings from summary for each result
    // (Simple approach: use the cited text as key findings)
    for (const result of filteredResults) {
      if (result.citedText) {
        result.keyFindings = result.citedText.substring(0, 300)
      }
    }

    const researchData: ResearchData = {
      queries,
      results: filteredResults,
      summary,
      generatedAt: new Date().toISOString(),
    }

    console.log(`[Research] Research complete. Summary length: ${summary.length}`)

    return researchData
  } catch (error) {
    console.error('[Research] Error:', error)
    throw new Error(
      `Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Format research data for inclusion in system prompt
 */
export function formatResearchForPrompt(research: ResearchData): string {
  let formatted = '\n\n---\n\n# Web Research Results\n\n'
  formatted += `調査日時: ${new Date(research.generatedAt).toLocaleDateString('ja-JP')}\n\n`

  // Add summary
  if (research.summary) {
    formatted += '## 調査サマリー\n\n'
    formatted += research.summary + '\n\n'
  }

  // Add source references
  if (research.results.length > 0) {
    formatted += '## 参照元\n\n'
    for (const result of research.results.slice(0, 10)) {
      formatted += `- [${result.title}](${result.url})`
      if (result.pageAge) {
        formatted += ` (${result.pageAge})`
      }
      formatted += '\n'
    }
  }

  return formatted
}
