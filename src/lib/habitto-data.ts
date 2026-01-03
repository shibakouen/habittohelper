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
  legalName: string
  brandName: string
  brandNameJp: string
  parentCompany: string
  bankPartner: string
  website: string
  purpose: string
  tagline: string
  mainMessage: string
  founded: string
  serviceLaunch: string
  registration: {
    type: string
    number: string
    date: string
    note: string
  }
  address: {
    full: string
    area: string
    moveDate: string
    previousAddress: string
    phone: string
  }
  targetAudience: {
    ageRange: string
    primaryAge: string
    description: string
    characteristics: string[]
  }
  businessHours: {
    weekday: string
    closedDays: string[]
  }
  contact: {
    support: string
    complaints: string
    press: string
  }
  socialMedia: {
    x: string
    instagram: string
    linkedin: string
  }
  values: Array<{
    name: string
    description: string
  }>
  employees: number
  disputeResolution: {
    description: string
    centers: Array<{
      name: string
      phone: string
    }>
  }
}

export interface HabittoFunding {
  totalRaised: {
    jpy: string
    usd: string
  }
  rounds: Array<{
    name: string
    date: string
    amount: string
    investors: string[]
    note?: string
  }>
}

export interface HabittoSavingsAccount {
  url: string
  interestRate: {
    rate: string
    rateAfterTax: string
    maxAmount: number
    maxAmountFormatted: string
    excessRate: string
    excessRateAfterTax: string
    conditions: string
  }
  interestRateHistory: Array<{
    period: string
    rate: string
    type: string
    note?: string
  }>
  accountType: string
  openingTime: string
  openingSteps: number
  features: string[]
  keyMessages: string[]
}

export interface HabittoDebitCard {
  url: string
  cashbackRate: string
  cashbackTiming: string
  cardBrand: string
  issuanceFee: string
  annualFee: string
  eligibleTransactions: string[]
  excludedTransactions: string[]
  dailyLimit: {
    shopping: string
    atmWithdrawal: string
  }
  features: string[]
  keyMessages: string[]
}

export interface HabittoAdvisor {
  url: string
  cost: string
  qualification: string
  methods: string[]
  shortConsultation: string
  topics: string[]
  features: string[]
  keyMessages: string[]
  usageRate: string
}

export interface HabittoFees {
  transferFee: {
    toOtherBank: {
      amount: number
      unit: string
      formatted: string
      note: string
    }
    toGMOAozora: {
      amount: number
      formatted: string
      note: string
    }
  }
  atmFee: {
    deposit: {
      amount: number
      formatted: string
      note: string
    }
    withdrawal: {
      amount: number
      unit: string
      formatted: string
      note: string
    }
  }
  accountFee: {
    amount: number
    formatted: string
    note: string
  }
  appFee: {
    amount: number
    formatted: string
    note: string
  }
  cardIssuanceFee: {
    amount: number
    formatted: string
  }
  cardAnnualFee: {
    amount: number
    formatted: string
  }
  availableATMs: string[]
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
    lastUpdated: string
    sources: string[]
    notes: string
  }
  company: HabittoCompany
  funding: HabittoFunding
  milestones: Array<{ date: string; event: string }>
  savingsAccount: HabittoSavingsAccount
  debitCard: HabittoDebitCard
  advisor: HabittoAdvisor
  fees: HabittoFees
  customerStages: {
    description: string
    note: string
    stages: Array<{
      name: string
      level: number
      atmFreeCount: number
      transferFreeCount: number
      note?: string
    }>
  }
  partners: { banking: string }
  tools: Record<string, {
    name: string
    nameEn: string
    description: string
    dataSource?: string
    purpose?: string
  }>
  research: Record<string, {
    name: string
    date: string
    sampleSize: number
    findings: Array<{
      stat: string
      finding: string
    }>
  }>
  awards: string[]
  mediaFeatures: string[]
  comparison: Record<string, Record<string, string>>
  internalLinks: {
    pages: Array<{
      url: string
      name: string
      anchorTexts: string[]
      linkContexts: string[]
    }>
  }
  commonMisconceptions: Record<string, { wrong: string; correct: string }>
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

  // Get the latest Series A funding round
  const seriesA = data.funding.rounds.find(r => r.name === 'Series A')

  return `
# 【重要】Habitto正確データ（これ以外の数字を使用しないでください）

## 会社情報
- 正式名称: ${data.company.legalName}
- 登録番号: ${data.company.registration.number}
- 設立: ${data.company.founded}
- サービス開始: ${data.company.serviceLaunch}

## 貯蓄口座
- 金利: ${data.savingsAccount.interestRate.rate}（${data.savingsAccount.interestRate.maxAmountFormatted}まで）
- 条件: ${data.savingsAccount.interestRate.conditions}
- 口座タイプ: ${data.savingsAccount.accountType}

## デビットカード
- キャッシュバック: ${data.debitCard.cashbackRate}
- キャッシュバック条件: 条件なし（全ての買い物が対象）
- 特徴: ${data.debitCard.features.join('、')}

## アドバイザー
- 費用: ${data.advisor.cost}
- 資格: ${data.advisor.qualification}
- 相談方法: ${data.advisor.methods.join('、')}
- 相談内容: ${data.advisor.topics.join('、')}

## 手数料
- ATM出金: ${data.fees.atmFee.withdrawal.formatted}（無料回数を超過した場合）
- 他行宛振込: ${data.fees.transferFee.toOtherBank.formatted}（無料回数を超過した場合）
- 口座維持手数料: ${data.fees.accountFee.formatted}

## 資金調達
- シリーズA: ${seriesA?.amount}（${seriesA?.date}）
- 累計調達額: ${data.funding.totalRaised.jpy}

## よくある間違い（絶対に避けること）
${Object.values(data.commonMisconceptions).map(m => `- ❌ 間違い: ${m.wrong}\n  ✅ 正解: ${m.correct}`).join('\n')}

---
【警告】上記以外の数字や事実は使用しないでください。特に他行宛振込手数料（${data.fees.transferFee.toOtherBank.formatted}）は間違いやすいので注意。
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
