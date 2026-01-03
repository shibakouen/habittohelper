/**
 * Habitto Verified Data Loader
 *
 * Loads the verified Habitto data from the JSON file.
 * This is the SINGLE SOURCE OF TRUTH for all Habitto facts.
 *
 * Anti-hallucination: All factual data comes from this verified file,
 * not from LLM training data.
 */

import verifiedData from '@/data/habitto-verified-data.json'

// Type definitions based on the JSON structure
export interface HabittoCompany {
  name: string
  legalName: string
  registrationNumber: string
  founded: string
  headquarters: string
  leadership: {
    ceo: string
    coo: string
    cto?: string
  }
  employeeCount: string
}

export interface HabittoFunding {
  seriesA: {
    amount: string
    date: string
    leadInvestor: string
    allInvestors: string[]
    cumulativeTotal: string
  }
}

export interface HabittoSavingsAccount {
  interestRate: string
  interestRateNumeric: number
  maxBalance: string
  conditions: string
  keyMessage: string
  differentiator: string
}

export interface HabittoDebitCard {
  cashbackRate: string
  cashbackRateNumeric: number
  conditions: string
  keyMessage: string
  features: string[]
}

export interface HabittoAdvisor {
  cost: string
  keyMessage: string
  differentiator: string
  services: string[]
}

export interface HabittoFees {
  atmWithdrawal: string
  domesticTransfer: string
  freeTransfersNote: string
}

export interface CrawledPage {
  url: string
  title: string
  pageType: string
  language: string
  content: string
}

export interface HabittoVerifiedData {
  _metadata: {
    version: string
    lastVerified: string
    source: string
    note: string
  }
  company: HabittoCompany
  funding: HabittoFunding
  milestones: Array<{ date: string; event: string }>
  savingsAccount: HabittoSavingsAccount
  debitCard: HabittoDebitCard
  advisor: HabittoAdvisor
  fees: HabittoFees
  customerStages: Array<{ stage: string; requirement: string; benefits: string[] }>
  partners: { banking: string }
  tools: Array<{ name: string; url: string; description: string }>
  research: Array<{ title: string; date: string; keyFinding: string }>
  awards: string[]
  mediaFeatures: string[]
  comparison: Record<string, Record<string, string>>
  internalLinks: Array<{ url: string; title: string; keywords: string[]; priority: number }>
  commonMisconceptions: Array<{ wrong: string; correct: string }>
  writingGuidelines: {
    tone: string[]
    avoid: string[]
    keyPhrases: string[]
    vocabulary: Record<string, string>
  }
  brandVoice: {
    toneDescriptors: string[]
  }
  crawlMetadata: {
    crawlDate: string
    totalPagesCrawled: number
    crawlDurationSeconds: number
  }
  crawledPages: Record<string, CrawledPage | { _note: string }>
}

// Export the verified data with type safety
export const habittoData = verifiedData as unknown as HabittoVerifiedData

/**
 * Get company information
 */
export function getCompanyInfo(): HabittoCompany {
  return habittoData.company
}

/**
 * Get savings account details
 */
export function getSavingsAccount(): HabittoSavingsAccount {
  return habittoData.savingsAccount
}

/**
 * Get debit card details
 */
export function getDebitCard(): HabittoDebitCard {
  return habittoData.debitCard
}

/**
 * Get advisor details
 */
export function getAdvisor(): HabittoAdvisor {
  return habittoData.advisor
}

/**
 * Get fee information
 */
export function getFees(): HabittoFees {
  return habittoData.fees
}

/**
 * Get all crawled pages
 */
export function getCrawledPages(): Record<string, CrawledPage> {
  const pages: Record<string, CrawledPage> = {}
  for (const [key, value] of Object.entries(habittoData.crawledPages)) {
    if (key !== '_note' && 'url' in value) {
      pages[key] = value as CrawledPage
    }
  }
  return pages
}

/**
 * Get a specific crawled page by slug
 */
export function getCrawledPage(slug: string): CrawledPage | null {
  const page = habittoData.crawledPages[slug]
  if (page && 'url' in page) {
    return page as CrawledPage
  }
  return null
}

/**
 * Get pages relevant to a topic
 * Searches page content and titles for keyword matches
 */
export function getRelevantPages(keyword: string, maxPages: number = 5): CrawledPage[] {
  const pages = getCrawledPages()
  const keywordLower = keyword.toLowerCase()

  const matches: Array<{ page: CrawledPage; score: number }> = []

  for (const page of Object.values(pages)) {
    let score = 0

    // Title match = high score
    if (page.title.toLowerCase().includes(keywordLower)) {
      score += 10
    }

    // Content match = medium score
    if (page.content.toLowerCase().includes(keywordLower)) {
      score += 5
      // Count occurrences
      const occurrences = (page.content.toLowerCase().match(new RegExp(keywordLower, 'g')) || []).length
      score += Math.min(occurrences, 5) // Cap at 5 extra points
    }

    // URL match
    if (page.url.toLowerCase().includes(keywordLower)) {
      score += 3
    }

    if (score > 0) {
      matches.push({ page, score })
    }
  }

  // Sort by score descending and return top matches
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPages)
    .map(m => m.page)
}

/**
 * Get verified facts as a formatted string for the system prompt
 * This prevents hallucination by providing exact data
 */
export function getVerifiedFactsContext(): string {
  const data = habittoData

  return `
# 【重要】Habitto正確データ（これ以外の数字を使用しないでください）

## 会社情報
- 正式名称: ${data.company.legalName}
- 登録番号: ${data.company.registrationNumber}
- 設立: ${data.company.founded}
- CEO: ${data.company.leadership.ceo}
- COO: ${data.company.leadership.coo}

## 貯蓄口座
- 金利: ${data.savingsAccount.interestRate}（${data.savingsAccount.maxBalance}まで）
- 条件: ${data.savingsAccount.conditions}
- 差別化ポイント: ${data.savingsAccount.differentiator}

## デビットカード
- キャッシュバック: ${data.debitCard.cashbackRate}
- 条件: ${data.debitCard.conditions}
- 特徴: ${data.debitCard.features.join('、')}

## アドバイザー
- 費用: ${data.advisor.cost}
- 差別化: ${data.advisor.differentiator}
- サービス内容: ${data.advisor.services.join('、')}

## 手数料
- ATM出金: ${data.fees.atmWithdrawal}
- 他行宛振込: ${data.fees.domesticTransfer}
- ※${data.fees.freeTransfersNote}

## 資金調達
- シリーズA: ${data.funding.seriesA.amount}（${data.funding.seriesA.date}）
- リード投資家: ${data.funding.seriesA.leadInvestor}

## よくある間違い（絶対に避けること）
${data.commonMisconceptions.map(m => `- ❌ 間違い: ${m.wrong}\n  ✅ 正解: ${m.correct}`).join('\n')}

---
【警告】上記以外の数字や事実は使用しないでください。特に他行宛振込手数料（${data.fees.domesticTransfer}）は間違いやすいので注意。
`
}

/**
 * Get crawled page content as context for a specific topic
 */
export function getPageContentContext(keyword: string): string {
  const relevantPages = getRelevantPages(keyword, 3)

  if (relevantPages.length === 0) {
    return ''
  }

  let context = '\n# 参考：Habitto公式ページの内容\n\n'
  context += '以下はHabitto公式サイトから抽出した実際のコンテンツです。記事を書く際はこの内容を参考にしてください。\n\n'

  for (const page of relevantPages) {
    context += `## ${page.title}\n`
    context += `URL: ${page.url}\n\n`
    // Truncate very long content
    const content = page.content.length > 2000
      ? page.content.substring(0, 2000) + '...[省略]'
      : page.content
    context += `${content}\n\n---\n\n`
  }

  return context
}

/**
 * Get main service pages content (account, card, advisor)
 */
export function getMainServicePagesContext(): string {
  const servicePages = ['account', 'card', 'advisor']
  let context = '\n# Habitto主要サービスページの実際のコンテンツ\n\n'

  for (const slug of servicePages) {
    const page = getCrawledPage(slug)
    if (page) {
      context += `## ${page.title}\n`
      context += `URL: ${page.url}\n\n`
      // Take first 1500 chars of each service page
      const content = page.content.length > 1500
        ? page.content.substring(0, 1500) + '...[省略]'
        : page.content
      context += `${content}\n\n---\n\n`
    }
  }

  return context
}
