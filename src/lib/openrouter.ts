/**
 * OpenRouter Client
 *
 * Handles AI requests via OpenRouter API.
 * - Research: perplexity/sonar-pro (web search + synthesis)
 * - Analysis & Writing: anthropic/claude-sonnet-4.5
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

export const MODELS = {
  RESEARCH: 'perplexity/sonar-pro',
  ANALYSIS: 'anthropic/claude-sonnet-4.5',
  WRITER: 'anthropic/claude-sonnet-4.5',
} as const

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * Make a request to OpenRouter
 */
async function makeRequest(
  model: string,
  messages: OpenRouterMessage[],
  options: {
    maxTokens?: number
    temperature?: number
  } = {}
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set')
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://habitto-blog.vercel.app',
      'X-Title': 'Habitto Blog Generator',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`)
  }

  const data: OpenRouterResponse = await response.json()
  return data.choices[0]?.message?.content || ''
}

/**
 * Research a topic using Perplexity (web search + synthesis)
 */
export async function research(keyword: string): Promise<string> {
  const messages: OpenRouterMessage[] = [
    {
      role: 'system',
      content: `あなたは日本の金融コンテンツに特化したリサーチ専門家です。Habitto（ネット銀行サービス）のブログ記事を書くための調査を行います。

## 調査の目的
このキーワードで検索する読者が「何を知りたいのか」「どんな悩みを解決したいのか」を理解し、競合より優れた記事を書くための素材を集めます。

## 必須調査項目

### 1. 検索意図の分析
- このキーワードで検索する人は何を求めているか
- 情報収集段階か、行動準備段階か
- 想定される読者像（年齢、状況、悩み）

### 2. 競合コンテンツの分析
- 上位表示されている記事の構成
- 競合が触れている主要トピック
- 競合が見落としている視点やギャップ

### 3. 必須データ・統計
- 信頼できる統計データ（金融庁、日銀、民間調査など）
- 具体的な数字（金額、割合、人数）
- データの出典元を明記

### 4. 日本市場の特殊性
- 日本特有の制度（税制、優遇措置など）
- 日本の金融慣行やトレンド
- 2024-2025年の最新動向

### 5. 読者の具体的な悩み・疑問
- よくある質問（FAQ）
- 初心者が陥りやすい誤解
- 具体的なユースケース

### 6. SEO関連キーワード
- このトピックで頻出する重要語句
- 関連する検索キーワード
- 記事に含めるべきフレーズ

## 出力形式
各セクションを明確に分け、箇条書きで具体的に回答してください。
データには必ず出典を付けてください。`,
    },
    {
      role: 'user',
      content: `「${keyword}」について詳しく調査してください。

特に以下の観点を重視してください：
- 20〜40代の金融初心者が本当に知りたいこと
- 貯蓄・節約・資産形成との関連性
- 具体的なアクションにつながる情報`,
    },
  ]

  return makeRequest(MODELS.RESEARCH, messages, {
    maxTokens: 4096,
    temperature: 0.3, // Lower temperature for factual research
  })
}

/**
 * Analyze research results and extract key points
 */
export async function analyzeResearch(
  keyword: string,
  rawResearch: string
): Promise<string> {
  const messages: OpenRouterMessage[] = [
    {
      role: 'system',
      content: `あなたはHabittoのコンテンツストラテジストです。リサーチ結果を分析し、NeuronWriterで高スコア（60点以上）を獲得できるブログ記事の設計図を作成します。

## Habittoについて
Habittoは日本の20〜40代向けネット銀行サービスです：
- **貯蓄口座**: 条件なしで年利0.5%（メガバンクの500倍） → 「条件なし」が最大の差別化ポイント
- **デビットカード**: 無条件で0.8%キャッシュバック（現金還元、ポイントではない）
- **アドバイザー**: 完全無料・押し売りなしの中立的相談

## 分析の目的
1. 読者の検索意図に完璧に応える記事構成を設計
2. SEOで上位表示されるためのキーワード戦略を策定
3. Habittoサービスを自然に訴求できるポイントを特定

## 必須出力セクション

### 1. 記事のユニークアングル
- 競合と差別化できる切り口（1-2文で明確に）
- なぜこの記事が読者にとって最も価値があるか

### 2. ターゲット読者の詳細プロファイル
- 具体的な人物像（年齢、職業、家族構成、収入）
- 現在の状況と抱えている課題
- この記事を読んだ後に期待するアクション

### 3. SEO必須キーワード（重要度順）
- **主要キーワード**: 記事全体で5回以上使用すべき語句
- **サブキーワード**: 各セクションで2-3回使用すべき語句
- **LSIキーワード**: 自然に織り込むべき関連語句

### 4. 必須統計データ
- 記事の信頼性を高める具体的な数字（出典付き）
- 読者の関心を引くインパクトのあるデータ

### 5. 推奨見出し構成（H2/H3）
各見出しに以下を含める：
- SEOキーワードを含む見出し文
- そのセクションで触れるべき内容（2-3点）
- 目標文字数（各H2セクション800-1200字目安）

### 6. Habitto訴求マップ
以下の形式で具体的に指定：
- **訴求ポイント1**: [記事の何%あたり] → [どのサービス] → [どんな文脈で]
- **訴求ポイント2**: ...
※ 記事の前半50%ではサービス訴求を控え、後半で自然に紹介

### 7. 内部リンク計画
3-6個のHabittoページへのリンクを以下から選択：
- https://www.habitto.com/account/ （貯蓄口座）
- https://www.habitto.com/card/ （デビットカード）
- https://www.habitto.com/advisor/ （アドバイザー）
- https://www.habitto.com/people-like-you/ （お客様の声）
- https://www.habitto.com/ （公式サイト）`,
    },
    {
      role: 'user',
      content: `キーワード：「${keyword}」

リサーチ結果：
${rawResearch}

---
上記のリサーチを分析し、NeuronWriterで高スコアを獲得できるSEO最適化された記事設計図を作成してください。`,
    },
  ]

  return makeRequest(MODELS.ANALYSIS, messages, {
    maxTokens: 4096,
    temperature: 0.5,
  })
}

/**
 * Write a blog article
 */
export async function writeBlog(
  keyword: string,
  analyzedResearch: string,
  neuronwriterData: {
    recommendedTerms: string[]
    competitorHeadings: string[]
    wordCountTarget: number
  } | null,
  systemPrompt: string,
  retryContext?: {
    missingKeywords: string[]
    previousScore: number
    attempt: number
  }
): Promise<{
  title: string
  content: string
  metaDescription: string
}> {
  let seoInstructions = ''

  if (neuronwriterData) {
    // Split keywords into tiers based on importance
    const criticalTerms = neuronwriterData.recommendedTerms.slice(0, 10)
    const importantTerms = neuronwriterData.recommendedTerms.slice(10, 25)
    const supportingTerms = neuronwriterData.recommendedTerms.slice(25, 40)

    seoInstructions = `

## SEO最適化要件（NeuronWriter）- スコア60点以上が必須

### 【必須】クリティカルキーワード（各3回以上使用）
以下のキーワードは記事内で**必ず3回以上**自然に使用してください：
${criticalTerms.map((t, i) => `${i + 1}. ${t}`).join('\n')}

### 【重要】セカンダリキーワード（各1-2回使用）
以下のキーワードは記事内で**1-2回**使用してください：
${importantTerms.join('、')}

### 【推奨】サポートキーワード（可能な限り使用）
${supportingTerms.join('、')}

### 競合の見出し構成（参考・上回ること）
${neuronwriterData.competitorHeadings.slice(0, 10).map((h, i) => `${i + 1}. ${h}`).join('\n')}

### 目標文字数：${neuronwriterData.wordCountTarget}文字以上

## キーワード配置戦略
1. **タイトル**: 主要キーワードを含める
2. **導入部（最初の200文字）**: クリティカルキーワードを2-3個使用
3. **各H2見出し**: 関連キーワードを含める
4. **本文**: 各段落にキーワードを自然に分散
5. **まとめ**: 主要キーワードを再度使用
`

    // Add retry context if this is a retry attempt
    if (retryContext && retryContext.attempt > 1) {
      seoInstructions += `

## ⚠️ 再生成の指示（前回スコア: ${retryContext.previousScore}点）

前回の記事では以下のキーワードが不足していました。今回は**必ず**これらを含めてください：

### 不足していたキーワード（必須で含めること）
${retryContext.missingKeywords.map((k, i) => `${i + 1}. **${k}** ← 必ず2回以上使用`).join('\n')}

これらのキーワードを自然な文脈で記事に織り込んでください。スコア60点以上を達成することが必須です。
`
    }
  }

  const messages: OpenRouterMessage[] = [
    {
      role: 'system',
      content: systemPrompt + seoInstructions,
    },
    {
      role: 'user',
      content: `以下の情報をもとに、「${keyword}」についてのブログ記事を作成してください。

${analyzedResearch}

---

## 出力形式（厳守）

以下のJSON形式で**必ず**回答してください。JSONの前後に余計な文章を入れないでください：

\`\`\`json
{
  "title": "記事タイトル（40-60文字、主要キーワードを含む）",
  "metaDescription": "メタディスクリプション（120-160文字、主要キーワードを含む）",
  "content": "記事本文（Markdown形式、${neuronwriterData?.wordCountTarget || 5000}文字以上）"
}
\`\`\`

## 記事要件チェックリスト
- [ ] H2見出しを5-7個使用
- [ ] H3見出しで詳細を構造化
- [ ] 3-6個のHabitto内部リンク（記事後半に配置）
- [ ] 「条件なし」「無条件で」というHabittoの差別化ポイントを強調
- [ ] SEOキーワードを自然に分散配置
- [ ] 具体的な数字・統計データを含む
- [ ] 読者の悩みに共感し、解決策を提示`,
    },
  ]

  const response = await makeRequest(MODELS.WRITER, messages, {
    maxTokens: 8192,
    temperature: 0.7,
  })

  // Parse the JSON response
  try {
    // Extract JSON from markdown code block if present
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : response

    const parsed = JSON.parse(jsonStr)
    return {
      title: parsed.title || '',
      content: parsed.content || '',
      metaDescription: parsed.metaDescription || '',
    }
  } catch {
    // If JSON parsing fails, try to extract content more robustly
    console.warn('JSON parsing failed, attempting manual extraction')

    // Try to find JSON-like structure in the response
    const titleMatch = response.match(/"title"\s*:\s*"([^"]+)"/)
    const metaMatch = response.match(/"metaDescription"\s*:\s*"([^"]+)"/)
    const contentMatch = response.match(/"content"\s*:\s*"([\s\S]*?)"\s*}/)

    if (titleMatch && contentMatch) {
      return {
        title: titleMatch[1],
        content: contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
        metaDescription: metaMatch?.[1] || '',
      }
    }

    // Last resort: extract from markdown
    const lines = response.split('\n')
    let title = ''
    let content = ''

    for (const line of lines) {
      if (line.startsWith('# ') && !title) {
        title = line.replace('# ', '')
      }
    }

    content = response
    const metaDescription = response.slice(0, 160)

    return { title, content, metaDescription }
  }
}
