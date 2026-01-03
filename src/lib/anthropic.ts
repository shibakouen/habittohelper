/**
 * Anthropic Claude Client
 * Direct API integration for chat with streaming support
 */

import Anthropic from '@anthropic-ai/sdk'
import { getFullWritingContext } from './habitto-context'

// Use environment variable for API key
const apiKey = process.env.ANTHROPIC_API_KEY

if (!apiKey) {
  console.warn('ANTHROPIC_API_KEY not set')
}

export const anthropic = new Anthropic({
  apiKey: apiKey || '',
})

// Model to use - Claude Sonnet 4.5 for best quality/cost balance
export const MODEL = 'claude-sonnet-4-5-20250929'

// Max tokens for response
export const MAX_TOKENS = 8192

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Research data structure
 */
interface ResearchData {
  queries: string[]
  results: Array<{
    url: string
    title: string
    pageAge: string | null
    keyFindings: string
    citedText: string
  }>
  summary: string
  generatedAt: string
}

/**
 * Build system prompt from project data
 */
export function buildSystemPrompt(
  projectSystemPrompt: string,
  contextFiles: Array<{ name: string; content: string }>,
  neuronwriterData?: {
    recommendedTerms: string[]
    competitorHeadings: string[]
    topKeywords: Array<{ term: string; weight: number }>
  },
  researchData?: ResearchData
): string {
  // ALWAYS start with the full Habitto writing context
  const habittoContext = getFullWritingContext()

  // Combine: Habitto context first, then any project-specific additions
  let systemPrompt = habittoContext

  if (projectSystemPrompt) {
    systemPrompt += '\n\n---\n\n# Additional Project Instructions\n\n' + projectSystemPrompt
  }

  // Add context files
  if (contextFiles.length > 0) {
    systemPrompt += '\n\n---\n\n# Reference Documents\n\n'
    for (const file of contextFiles) {
      systemPrompt += `## ${file.name}\n\n${file.content}\n\n`
    }
  }

  // Add NeuronWriter SEO data if available
  if (neuronwriterData) {
    systemPrompt += '\n\n---\n\n# SEO Keywords (from NeuronWriter)\n\n'
    systemPrompt += '以下のキーワードをコンテンツに自然に組み込んでください：\n\n'

    // Critical keywords (top 10)
    const critical = neuronwriterData.topKeywords.slice(0, 10)
    if (critical.length > 0) {
      systemPrompt += '【必須キーワード（3回以上使用）】\n'
      systemPrompt += critical.map(k => `- ${k.term}`).join('\n')
      systemPrompt += '\n\n'
    }

    // Important keywords (11-25)
    const important = neuronwriterData.topKeywords.slice(10, 25)
    if (important.length > 0) {
      systemPrompt += '【重要キーワード（1-2回使用）】\n'
      systemPrompt += important.map(k => `- ${k.term}`).join('\n')
      systemPrompt += '\n\n'
    }

    // Competitor headings for structure reference
    if (neuronwriterData.competitorHeadings.length > 0) {
      systemPrompt += '【参考：競合サイトの見出し構成】\n'
      systemPrompt += neuronwriterData.competitorHeadings.slice(0, 10).map(h => `- ${h}`).join('\n')
      systemPrompt += '\n'
    }
  }

  // Add research data if available
  if (researchData && researchData.summary) {
    systemPrompt += '\n\n---\n\n# Web Research Results (最新調査)\n\n'
    systemPrompt += `調査日時: ${new Date(researchData.generatedAt).toLocaleDateString('ja-JP')}\n\n`

    // Add summary
    systemPrompt += '## 調査サマリー\n\n'
    systemPrompt += researchData.summary + '\n\n'

    // Add source references with dates
    if (researchData.results.length > 0) {
      systemPrompt += '## 参照元（引用時は必ず出典を明記）\n\n'
      for (const result of researchData.results.slice(0, 8)) {
        systemPrompt += `- **${result.title}**\n`
        systemPrompt += `  URL: ${result.url}\n`
        if (result.pageAge) {
          systemPrompt += `  更新日: ${result.pageAge}\n`
        }
        if (result.keyFindings) {
          systemPrompt += `  要点: ${result.keyFindings.substring(0, 200)}...\n`
        }
        systemPrompt += '\n'
      }
    }

    systemPrompt += '\n【重要】上記の調査結果を参考にし、最新のデータや統計を記事に反映してください。引用する際は出典を明記してください。\n'
  }

  return systemPrompt
}

/**
 * Stream a chat response from Claude
 * Returns an async generator of text chunks
 */
export async function* streamChat(
  systemPrompt: string,
  messages: Message[]
): AsyncGenerator<string, void, unknown> {
  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  })

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text
    }
  }
}

/**
 * Non-streaming chat for simple requests
 */
export async function chat(
  systemPrompt: string,
  messages: Message[]
): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  })

  const content = response.content[0]
  if (content.type === 'text') {
    return content.text
  }

  throw new Error('Unexpected response type')
}
