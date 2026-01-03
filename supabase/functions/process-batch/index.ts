/**
 * Supabase Edge Function: process-batch
 *
 * Handles blog generation pipeline with 400s timeout (Supabase Pro).
 * Processes ONE step per invocation to enable progress tracking.
 *
 * Steps: pending → researching → analyzing → writing → completed
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// ============================================================================
// CONFIGURATION
// ============================================================================

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const NEURONWRITER_API_URL = 'https://app.neuronwriter.com/neuron-api/0.5/writer'

// COST CONTROL: Use fast, cheap models. Never Claude via OpenRouter (too slow, expensive, times out)
const MODELS = {
  RESEARCH: 'perplexity/sonar-pro',
  ANALYSIS: 'google/gemini-2.5-flash',  // Fast, cheap, score 58
  WRITER: 'google/gemini-2.5-flash',     // $0.10/M input vs Claude $3/M
  FALLBACK: 'google/gemini-2.5-pro',
} as const

const MIN_ACCEPTABLE_SCORE = 60

// ============================================================================
// TYPES
// ============================================================================

type JobStatus = 'pending' | 'researching' | 'analyzing' | 'writing' | 'completed' | 'failed'

interface Job {
  id: string
  batch_id: string
  keyword: string
  status: JobStatus
  error: string | null
  research_raw: string | null
  research_analyzed: string | null
  neuronwriter_data: Record<string, unknown> | null
}

interface NeuronWriterAnalysis {
  queryId: string | null
  recommendedTerms: string[]
  competitorHeadings: string[]
  wordCountTarget: number
  topKeywords: Array<{ term: string; weight: number }>
}

interface StepResult {
  status: 'processing' | 'completed' | 'no_work'
  jobId?: string
  keyword?: string
  step?: string
  nextStep?: string
  message: string
  batchComplete?: boolean
  error?: string
}

// ============================================================================
// OPENROUTER CLIENT
// ============================================================================

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function makeOpenRouterRequest(
  model: string,
  messages: OpenRouterMessage[],
  options: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {}
): Promise<string> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY')
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set')
  }

  // Add timeout using AbortController (default 180 seconds for long content generation)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 180000)

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
      signal: controller.signal,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || ''
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`OpenRouter API timeout after ${(options.timeoutMs || 180000) / 1000}s`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

// ============================================================================
// RESEARCH FUNCTION
// ============================================================================

async function research(keyword: string): Promise<string> {
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

  return makeOpenRouterRequest(MODELS.RESEARCH, messages, {
    maxTokens: 4096,
    temperature: 0.3,
    timeoutMs: 90000, // 90s for research (Perplexity web search)
  })
}

// ============================================================================
// ANALYZE FUNCTION
// ============================================================================

async function analyzeResearch(keyword: string, rawResearch: string): Promise<string> {
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

  return makeOpenRouterRequest(MODELS.ANALYSIS, messages, {
    maxTokens: 4096,
    temperature: 0.5,
    timeoutMs: 180000, // 3 minutes for analysis
  })
}

// ============================================================================
// WRITER SYSTEM PROMPT
// ============================================================================

const WRITER_SYSTEM_PROMPT = `あなたはHabittoのコンテンツライターです。以下のガイドラインに従って日本語コンテンツを作成してください：

【トーン】
- 親しみやすく、でも軽すぎない
- 金融初心者に寄り添う
- 押し売りしない、安心感を与える
- 前向きで可能性を示す

【文体】
- です・ます調（敬体）
- 短い文と中程度の文を組み合わせる
- 専門用語は平易に言い換える

## ★★★ 必須ブランドキーワード（絶対に含めること）★★★

以下のキーワードは記事内で**必ず**使用してください：

1. **「お金を育てる」** - 最低2回使用（資産運用、投資の代わりに）
   例：「Habittoでお金を育てる習慣を始めましょう」

2. **「ムリなく」** - 最低1回使用（カタカナで）
   例：「ムリなく続けられる貯金方法」

3. **「コツコツ」** - 最低1回使用
   例：「コツコツ貯めることで大きな資産に」

4. **「おトク」** - 可能であれば使用（カタカナで）
   例：「おトクな金利で効率的に」

5. **「条件なし」** - Habitto紹介時に必ず使用
   例：「条件なしで年利0.5%」

これらのキーワードが欠けている記事はHabittoブランドとして不完全です。

【Habittoサービスの訴求方法】
- 貯蓄口座（年利0.5%）：銀行比較、貯金方法、金利の話題で自然に紹介
- デビットカード（0.8%還元）：節約、キャッシュレス、使いすぎ防止の文脈で紹介
- アドバイザー（無料相談）：投資、NISA、ライフプラン、複雑な判断の文脈で紹介

【サービス訴求の原則】
- 記事の80%は純粋な価値提供、20%以下でサービス紹介
- 押し売りではなく「選択肢の一つ」として提案
- 具体的な数字（0.5%、0.8%）でベネフィットを示す
- 読者の課題解決の文脈でサービスを位置づける

【Habittoの差別化ポイント（必ず強調）】
- 貯蓄口座: 他のネット銀行と違い、給与振込や取引回数などの条件なしで年利0.5%が適用されます
- デビットカード: ポイント制ではなく現金で還元。条件なしで全ての買い物に適用されます
- アドバイザー: 商品を売らない中立的な立場で、本当に必要なアドバイスだけを提供します

【「条件なし」の強調】
Habittoを紹介する際は、必ず「条件なし」「無条件で」という点を強調してください。
他社サービスは給与振込や取引回数などの条件がありますが、Habittoは一切の条件なしで特典が適用されます。

## ★★★ 絶対に避けるCTA表現 ★★★

以下の表現は**絶対に使わないでください**（押し売り感があります）：
- 「今すぐHabittoで口座開設！」
- 「今すぐ申し込み！」
- 「今すぐ始めないと損」
- 「\[今すぐ○○する\]」形式のボタン風テキスト
- 「絶対おすすめ」「断然おすすめ」

代わりに使うべき柔らかいCTA：
- 「高金利の口座を探している方は、Habittoの貯蓄口座もチェックしてみてください。」
- 「詳しくはHabitto公式サイトをご覧ください。」
- 「お金のことで迷ったら、無料で相談できるHabittoアドバイザーも選択肢の一つです。」

【その他避けること】
- 恐怖訴求（老後破綻！手遅れ！）
- 堅すぎる敬語（ございます、賜る）
- 専門用語の多用
- 上から目線の説教調
- 記事冒頭からのサービス訴求
- 他社を貶める比較

【ターゲット】
- 20〜40代の若い世代
- 金融初心者、投資未経験者
- 貯蓄を始めたい・増やしたい人

## ★★★ 内部リンク要件（厳守）★★★

### リンク可能なページ：
- [貯蓄口座](https://www.habitto.com/account/) - キーワード: 貯蓄口座、金利、0.5%
- [デビットカード](https://www.habitto.com/card/) - キーワード: デビットカード、キャッシュバック、0.8%
- [Habittoアドバイザー](https://www.habitto.com/advisor/) - キーワード: アドバイザー、相談、無料相談
- [お客様の声](https://www.habitto.com/people-like-you/) - キーワード: レビュー、口コミ、体験談
- [Habitto公式](https://www.habitto.com/) - キーワード: Habitto
- [アプリ](https://www.habitto.com/app/) - キーワード: アプリ、ダウンロード

### ルール（厳守）：
1. **最低3リンク、最大6リンク**を記事に含める
2. サービスページ（貯蓄口座、デビットカード、アドバイザー）は**記事の後半**でリンク
3. **【重要】同じURLは記事内で1回だけリンクする**
   - ❌ 悪い例: https://www.habitto.com/account/ を5回リンク
   - ✅ 良い例: https://www.habitto.com/account/ は1回だけリンク
4. 自然な文脈でリンクを挿入する

## ★★★ SEO最適化：H2見出しにキーワードを含める ★★★

H2見出しには必ず主要キーワードまたは関連キーワードを含めてください：
- ❌ 悪い例: 「基本を押さえよう」
- ✅ 良い例: 「【貯金方法の基本】先取り貯金とは」

各H2見出しに、記事のメインキーワードまたはサブキーワードを自然に組み込んでください。

## ★★★ FAQ（よくある質問）セクション必須 ★★★

記事の最後に必ず以下の構成を含めてください：

1. 本文の最後のH2セクション
2. 「## よくある質問」← このセクションを必ず追加
3. 「## まとめ」

よくある質問セクションには、読者が抱きそうな3つの疑問をQ&A形式で記載：
- H3で質問を書く（例: ### Q: 貯金は月いくらからできますか？）
- その下に回答を2-3文で書く

このセクションがない記事は不完全です。`

// ============================================================================
// WRITE BLOG FUNCTION
// ============================================================================

async function writeBlog(
  keyword: string,
  analyzedResearch: string,
  neuronwriterData: {
    recommendedTerms: string[]
    competitorHeadings: string[]
    wordCountTarget: number
  } | null,
  retryContext?: {
    missingKeywords: string[]
    previousScore: number
    attempt: number
  }
): Promise<{ title: string; content: string; metaDescription: string }> {
  let seoInstructions = ''

  if (neuronwriterData) {
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
      content: WRITER_SYSTEM_PROMPT + seoInstructions,
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
- [ ] 読者の悩みに共感し、解決策を提示
- [ ] **必須: 「## よくある質問」セクションを「## まとめ」の直前に配置（3つのQ&Aを含む）**`,
    },
  ]

  const response = await makeOpenRouterRequest(MODELS.WRITER, messages, {
    maxTokens: 12000,
    temperature: 0.7,
    timeoutMs: 300000, // 5 minutes for long blog generation
  })

  // Parse the JSON response
  try {
    // Try to extract JSON from markdown code block (greedy match)
    const jsonMatch = response.match(/```json\s*([\s\S]*)\s*```/)
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.trim()

    const parsed = JSON.parse(jsonStr)
    console.log('[Writer] JSON parsing successful')
    return {
      title: parsed.title || '',
      content: parsed.content || '',
      metaDescription: parsed.metaDescription || '',
    }
  } catch (e) {
    console.warn('[Writer] JSON parsing failed:', e)
    console.warn('[Writer] Attempting manual extraction')

    // Extract each field individually using more robust patterns
    let title = ''
    let metaDescription = ''
    let content = ''

    // Title extraction - find "title": "..."
    const titleMatch = response.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/s)
    if (titleMatch) {
      title = titleMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')
    }

    // MetaDescription extraction
    const metaMatch = response.match(/"metaDescription"\s*:\s*"((?:[^"\\]|\\.)*)"/s)
    if (metaMatch) {
      metaDescription = metaMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')
    }

    // Content extraction - more complex due to markdown
    // Find "content": " and then capture until the closing pattern
    const contentStartMatch = response.match(/"content"\s*:\s*"/)
    if (contentStartMatch && contentStartMatch.index !== undefined) {
      const startIdx = contentStartMatch.index + contentStartMatch[0].length
      let endIdx = startIdx
      let escaped = false

      for (let i = startIdx; i < response.length; i++) {
        const char = response[i]
        if (escaped) {
          escaped = false
          continue
        }
        if (char === '\\') {
          escaped = true
          continue
        }
        if (char === '"') {
          // Check if this is the end of content field
          const remaining = response.slice(i + 1).trimStart()
          if (remaining.startsWith('}') || remaining.startsWith(',')) {
            endIdx = i
            break
          }
        }
      }

      content = response.slice(startIdx, endIdx)
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\')
    }

    if (title && content) {
      console.log('[Writer] Manual extraction successful')
      return { title, content, metaDescription }
    }

    // Last resort - extract from raw markdown
    console.warn('[Writer] Manual extraction failed, using raw content')
    const lines = response.split('\n')
    for (const line of lines) {
      if (line.startsWith('# ') && !title) {
        title = line.replace('# ', '')
        break
      }
    }

    // Try to find markdown content after JSON wrapper
    const markdownStart = response.indexOf('# ')
    if (markdownStart !== -1) {
      content = response.slice(markdownStart)
    } else {
      content = response
    }

    return {
      title,
      content,
      metaDescription: metaDescription || (content.slice(0, 160).replace(/\n/g, ' ')),
    }
  }
}

// ============================================================================
// NEURONWRITER CLIENT
// ============================================================================

async function analyzeKeywordNeuronWriter(keyword: string): Promise<NeuronWriterAnalysis> {
  const apiKey = Deno.env.get('NEURONWRITER_API_KEY')
  const projectId = Deno.env.get('NEURONWRITER_PROJECT_ID')

  if (!apiKey || !projectId) {
    console.log('[NeuronWriter] API key or project ID not set, using fallback')
    return getFallbackAnalysis(keyword)
  }

  try {
    // Check for existing query
    const listResponse = await fetch(`${NEURONWRITER_API_URL}/list-queries`, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ project: projectId }),
    })

    if (!listResponse.ok) {
      throw new Error(`Failed to list queries: ${listResponse.status}`)
    }

    const queries = await listResponse.json()
    const existingQuery = queries?.find?.(
      (q: { keyword: string }) => q.keyword.toLowerCase() === keyword.toLowerCase()
    )

    let queryId = existingQuery?.id

    if (!queryId) {
      // Create new query
      console.log(`[NeuronWriter] Creating new query for "${keyword}"`)
      const createResponse = await fetch(`${NEURONWRITER_API_URL}/new-query`, {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project: projectId,
          keyword: keyword,
          language: 'ja',
          engine: 'google.co.jp',
        }),
      })

      if (!createResponse.ok) {
        throw new Error(`Failed to create query: ${createResponse.status}`)
      }

      const createData = await createResponse.json()
      queryId = createData.query

      if (!queryId) {
        return getFallbackAnalysis(keyword)
      }

      // Poll for results (max 60s to avoid Edge Function timeout)
      let attempts = 0
      const maxAttempts = 12

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000))

        const statusResponse = await fetch(`${NEURONWRITER_API_URL}/get-query`, {
          method: 'POST',
          headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: queryId }),
        })

        const statusData = await statusResponse.json()
        console.log(`[NeuronWriter] Poll ${attempts + 1}/${maxAttempts}, status: ${statusData.status}`)

        if (statusData.status === 'ready' && statusData.query) {
          return parseQueryResponse(statusData)
        }

        if (statusData.status === 'error') {
          return getFallbackAnalysis(keyword)
        }

        attempts++
      }

      return getFallbackAnalysis(keyword)
    } else {
      // Use existing query
      console.log(`[NeuronWriter] Using existing query: ${queryId}`)
      const getResponse = await fetch(`${NEURONWRITER_API_URL}/get-query`, {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: queryId }),
      })

      const getData = await getResponse.json()
      if (getData.query) {
        return parseQueryResponse(getData)
      }
    }

    return getFallbackAnalysis(keyword)
  } catch (error) {
    console.error('[NeuronWriter] Error:', error)
    return getFallbackAnalysis(keyword)
  }
}

function parseQueryResponse(response: {
  query?: string;
  terms?: {
    content_basic?: Array<{ t: string; usage_pc: number }>;
    content_extended?: Array<{ t: string; usage_pc: number }>;
    title?: Array<{ t: string; usage_pc: number }>;
    h1?: Array<{ t: string; usage_pc: number }>;
    h2?: Array<{ t: string; usage_pc: number }>;
    entities?: Array<{ t: string; usage_pc: number }>;
  };
  competitors?: Array<{ headers?: Array<[string, string]>; word_count?: number }>;
  status?: string;
}, queryId?: string): NeuronWriterAnalysis {
  const resolvedQueryId = queryId || response.query || null

  // Check if we have terms data
  const termsData = response.terms
  if (!termsData || !termsData.content_basic) {
    console.log('[NeuronWriter] No terms data found in response')
    return getFallbackAnalysis('')
  }

  // Get main content SEO terms from content_basic
  const contentTerms = termsData.content_basic || []
  console.log(`[NeuronWriter] Found ${contentTerms.length} content_basic terms`)

  // Sort by usage percentage and extract term text
  const terms = contentTerms
    .sort((a, b) => (b.usage_pc || 0) - (a.usage_pc || 0))
    .map(t => t.t)

  // Get headings from competitors - headers is array of [tag, text] pairs
  const headings = (response.competitors || [])
    .flatMap(c => (c.headers || []).map(h => h[1])) // h[1] is the heading text
    .filter(Boolean)

  // Calculate average word count from competitors
  const wordCounts = (response.competitors || [])
    .map(c => c.word_count || 0)
    .filter(wc => wc > 0)
  const avgWordCount = wordCounts.length > 0
    ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length)
    : 3000

  console.log(`[NeuronWriter] Parsed ${terms.length} terms, ${headings.length} headings, target ${avgWordCount} words`)

  return {
    queryId: resolvedQueryId,
    recommendedTerms: terms,
    competitorHeadings: [...new Set(headings)].slice(0, 20), // dedupe and limit
    wordCountTarget: avgWordCount,
    topKeywords: contentTerms.slice(0, 20).map(t => ({
      term: t.t,
      weight: t.usage_pc || 0,
    })),
  }
}

function getFallbackAnalysis(keyword: string): NeuronWriterAnalysis {
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

  return {
    queryId: null,
    recommendedTerms: [...baseTerms, ...habittoTerms.filter(t => !baseTerms.includes(t))],
    competitorHeadings: [
      `${keyword}とは？基礎知識を解説`,
      `${keyword}のメリット・デメリット`,
      `${keyword}の始め方・やり方`,
      `${keyword}の選び方のポイント`,
      `${keyword}に関するよくある質問`,
      `まとめ：${keyword}で賢くお金を管理しよう`,
    ],
    wordCountTarget: 3000,
    topKeywords: baseTerms.slice(0, 10).map((term, i) => ({
      term,
      weight: 100 - i * 5,
    })),
  }
}

// ============================================================================
// MARKDOWN TO HTML CONVERTER
// ============================================================================

function markdownToHtml(markdown: string): string {
  let html = markdown

  // Convert headings (must be done before other conversions)
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

  // Convert bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Convert links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

  // Convert unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')

  // Convert ordered lists (basic)
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

  // Convert code blocks (basic)
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.replace(/```\w*\n?/g, '').replace(/```/g, '')
    return `<pre><code>${code}</code></pre>`
  })

  // Convert inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Convert tables (basic)
  html = html.replace(/\|(.+)\|/g, (match, content) => {
    if (content.includes('---')) return '' // Skip separator rows
    const cells = content.split('|').map((c: string) => c.trim()).filter(Boolean)
    const cellsHtml = cells.map((c: string) => `<td>${c}</td>`).join('')
    return `<tr>${cellsHtml}</tr>`
  })
  html = html.replace(/(<tr>.*<\/tr>\n?)+/g, '<table>$&</table>')

  // Convert paragraphs (lines that don't start with HTML tags)
  const lines = html.split('\n')
  const processedLines = lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('<')) return trimmed
    if (trimmed.startsWith('□')) return `<p>${trimmed}</p>`
    return `<p>${trimmed}</p>`
  })

  html = processedLines.join('\n')

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '')

  return html
}

// ============================================================================
// NEURONWRITER CONTENT IMPORT
// ============================================================================

interface NeuronWriterImportResult {
  success: boolean
  contentScore: number | null
  editorUrl: string | null
  error?: string
}

async function importToNeuronWriter(
  queryId: string,
  title: string,
  metaDescription: string,
  markdownContent: string
): Promise<NeuronWriterImportResult> {
  const apiKey = Deno.env.get('NEURONWRITER_API_KEY')

  if (!apiKey || !queryId) {
    return {
      success: false,
      contentScore: null,
      editorUrl: null,
      error: 'Missing API key or query ID',
    }
  }

  try {
    const html = markdownToHtml(markdownContent)
    console.log(`[NeuronWriter] Importing content to query ${queryId}`)

    const response = await fetch(`${NEURONWRITER_API_URL}/import-content`, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: queryId,
        html: html,
        title: title,
        description: metaDescription,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[NeuronWriter] Import failed: ${response.status} - ${errorText}`)
      return {
        success: false,
        contentScore: null,
        editorUrl: null,
        error: `Import failed: ${response.status}`,
      }
    }

    const result = await response.json()
    console.log(`[NeuronWriter] Import successful, content_score: ${result.content_score}`)

    return {
      success: true,
      contentScore: result.content_score || null,
      editorUrl: `https://app.neuronwriter.com/analysis/view/${queryId}`,
    }
  } catch (error) {
    console.error('[NeuronWriter] Import error:', error)
    return {
      success: false,
      contentScore: null,
      editorUrl: null,
      error: String(error),
    }
  }
}

// ============================================================================
// SCORING
// ============================================================================

function calculateScore(
  content: string,
  analysis: NeuronWriterAnalysis
): { percentage: number; missingTerms: string[] } {
  const contentLower = content.toLowerCase()

  const criticalTerms = analysis.recommendedTerms.slice(0, 10)
  const importantTerms = analysis.recommendedTerms.slice(10, 25)
  const supportingTerms = analysis.recommendedTerms.slice(25)

  const missingCritical: string[] = []
  const missingImportant: string[] = []
  let criticalScore = 0
  let importantScore = 0
  let supportingScore = 0

  for (const term of criticalTerms) {
    const count = countOccurrences(contentLower, term.toLowerCase())
    if (count >= 3) {
      criticalScore += 3
    } else if (count >= 1) {
      criticalScore += count
      missingCritical.push(term)
    } else {
      missingCritical.push(term)
    }
  }

  for (const term of importantTerms) {
    const count = countOccurrences(contentLower, term.toLowerCase())
    if (count >= 1) {
      importantScore += Math.min(count, 2)
    } else {
      missingImportant.push(term)
    }
  }

  for (const term of supportingTerms) {
    if (contentLower.includes(term.toLowerCase())) {
      supportingScore += 1
    }
  }

  const maxCritical = criticalTerms.length * 3
  const maxImportant = importantTerms.length * 2
  const maxSupporting = supportingTerms.length

  const criticalPct = maxCritical > 0 ? (criticalScore / maxCritical) * 50 : 50
  const importantPct = maxImportant > 0 ? (importantScore / maxImportant) * 30 : 30
  const supportingPct = maxSupporting > 0 ? (supportingScore / maxSupporting) * 20 : 20

  const percentage = Math.round(criticalPct + importantPct + supportingPct)

  return {
    percentage,
    missingTerms: [...missingCritical, ...missingImportant.slice(0, 5)],
  }
}

function countOccurrences(content: string, term: string): number {
  const regex = new RegExp(escapeRegex(term), 'gi')
  const matches = content.match(regex)
  return matches ? matches.length : 0
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ============================================================================
// POST-PROCESSING FUNCTIONS
// ============================================================================

/**
 * Deduplicate internal links - each URL should appear only once
 */
function dedupeInternalLinks(content: string): string {
  const seenUrls = new Set<string>()

  return content.replace(
    /\[([^\]]+)\]\((https:\/\/www\.habitto\.com[^)]+)\)/g,
    (match, text, url) => {
      // Normalize URL (remove trailing slash variations)
      const normalizedUrl = url.replace(/\/$/, '')

      if (seenUrls.has(normalizedUrl)) {
        // Remove the link, keep just the text
        console.log(`[PostProcess] Removing duplicate link: ${url}`)
        return text
      }

      seenUrls.add(normalizedUrl)
      return match
    }
  )
}

/**
 * Validate and report missing brand keywords
 */
interface BrandKeywordValidation {
  isValid: boolean
  missingKeywords: string[]
  foundKeywords: string[]
}

function validateBrandKeywords(content: string): BrandKeywordValidation {
  const requiredKeywords = [
    { keyword: 'お金を育てる', minCount: 2 },
    { keyword: 'ムリなく', minCount: 1 },
    { keyword: 'コツコツ', minCount: 1 },
    { keyword: '条件なし', minCount: 1 },
  ]

  const optionalKeywords = [
    { keyword: 'おトク', minCount: 1 },
  ]

  const missingKeywords: string[] = []
  const foundKeywords: string[] = []

  for (const { keyword, minCount } of requiredKeywords) {
    const count = (content.match(new RegExp(escapeRegex(keyword), 'g')) || []).length
    if (count >= minCount) {
      foundKeywords.push(`${keyword} (${count}回)`)
    } else {
      missingKeywords.push(`${keyword} (必要: ${minCount}回, 現在: ${count}回)`)
    }
  }

  // Log optional keywords found
  for (const { keyword } of optionalKeywords) {
    const count = (content.match(new RegExp(escapeRegex(keyword), 'g')) || []).length
    if (count > 0) {
      foundKeywords.push(`${keyword} (${count}回)`)
    }
  }

  return {
    isValid: missingKeywords.length === 0,
    missingKeywords,
    foundKeywords,
  }
}

/**
 * Remove or soften pushy CTA expressions
 */
function removePushyCTAs(content: string): string {
  let processed = content

  // Patterns to remove entirely
  const removePatterns = [
    /\*\*\\\[今すぐ[^\]]*\\\]\*\*/g,  // **\[今すぐ○○\]**
    /\\\[今すぐ[^\]]*\\\]/g,           // \[今すぐ○○\]
    /\[今すぐ[^\]]*\]/g,               // [今すぐ○○]
  ]

  for (const pattern of removePatterns) {
    const matches = processed.match(pattern)
    if (matches) {
      console.log(`[PostProcess] Removing pushy CTA: ${matches.join(', ')}`)
      processed = processed.replace(pattern, '')
    }
  }

  // Patterns to soften
  const softenPatterns: Array<{ pattern: RegExp; replacement: string }> = [
    {
      pattern: /今すぐHabitto(で)?口座(を)?開設[！!]?/g,
      replacement: 'Habittoの貯蓄口座もチェックしてみてください',
    },
    {
      pattern: /今すぐ(申し込み|始め)[！!]/g,
      replacement: '詳しくは公式サイトをご覧ください',
    },
    {
      pattern: /(断然|絶対)(に)?おすすめ/g,
      replacement: '選択肢の一つ',
    },
  ]

  for (const { pattern, replacement } of softenPatterns) {
    if (pattern.test(processed)) {
      console.log(`[PostProcess] Softening CTA matching: ${pattern}`)
      processed = processed.replace(pattern, replacement)
    }
  }

  // Clean up any double spaces or empty lines created by removals
  processed = processed.replace(/\n\n\n+/g, '\n\n')
  processed = processed.replace(/  +/g, ' ')

  return processed
}

/**
 * Apply all post-processing to content
 */
function postProcessContent(content: string, keyword: string): {
  content: string
  brandValidation: BrandKeywordValidation
} {
  console.log(`[${keyword}] Running post-processors...`)

  // Step 1: Dedupe internal links
  let processed = dedupeInternalLinks(content)

  // Step 2: Remove pushy CTAs
  processed = removePushyCTAs(processed)

  // Step 3: Validate brand keywords (for logging, not modification)
  const brandValidation = validateBrandKeywords(processed)

  if (brandValidation.isValid) {
    console.log(`[${keyword}] ✅ Brand keywords valid: ${brandValidation.foundKeywords.join(', ')}`)
  } else {
    console.warn(`[${keyword}] ⚠️ Missing brand keywords: ${brandValidation.missingKeywords.join(', ')}`)
    console.log(`[${keyword}] Found: ${brandValidation.foundKeywords.join(', ')}`)
  }

  return { content: processed, brandValidation }
}

// ============================================================================
// LINK INSERTION
// ============================================================================

interface HabittoPage {
  url: string
  keywords: string[]
  priority: 1 | 2 | 3
}

const HABITTO_PAGES: HabittoPage[] = [
  {
    url: 'https://www.habitto.com/account/',
    keywords: ['貯蓄口座', '金利', '0.5%', '年利', '預金', '貯める', '利息', '高金利', '定期預金', 'ネット銀行', '普通預金'],
    priority: 1,
  },
  {
    url: 'https://www.habitto.com/card/',
    keywords: ['デビットカード', 'キャッシュバック', '0.8%', '還元', 'Visa', 'ATM', '使いすぎ', 'キャッシュレス', '決済'],
    priority: 1,
  },
  {
    url: 'https://www.habitto.com/advisor/',
    keywords: ['アドバイザー', '相談', '無料相談', 'FP', 'NISA', '保険', 'ライフプラン', '投資信託', 'iDeCo', '老後資金', 'ファイナンシャル'],
    priority: 1,
  },
  {
    url: 'https://www.habitto.com/people-like-you/',
    keywords: ['レビュー', '口コミ', '体験談', '評判', '利用者', 'ユーザー'],
    priority: 2,
  },
  {
    url: 'https://www.habitto.com/',
    keywords: ['Habitto', 'ハビト'],
    priority: 3,
  },
]

function suggestLinks(articleContent: string): Array<{ paragraph: number; anchorText: string; url: string }> {
  const paragraphs = articleContent.split('\n\n')
  const suggestions: Array<{ paragraph: number; anchorText: string; url: string }> = []
  const usedUrls = new Set<string>()

  // First pass: find ALL potential link opportunities
  const allOpportunities: Array<{ paragraph: number; anchorText: string; url: string; priority: number }> = []

  for (const [index, paragraph] of paragraphs.entries()) {
    // Skip headings and very short paragraphs
    if (paragraph.startsWith('#') || paragraph.length < 30) continue
    // Skip paragraphs that already have links
    if (paragraph.includes('](http')) continue

    for (const page of HABITTO_PAGES) {
      for (const keyword of page.keywords) {
        if (paragraph.includes(keyword)) {
          allOpportunities.push({
            paragraph: index,
            anchorText: keyword,
            url: page.url,
            priority: page.priority,
          })
          break // Only one keyword per page per paragraph
        }
      }
    }
  }

  // Second pass: select links with good distribution
  // Prioritize high-priority pages and spread links throughout article
  const sortedOpportunities = allOpportunities.sort((a, b) => {
    // First by priority (lower is better)
    if (a.priority !== b.priority) return a.priority - b.priority
    // Then by position (earlier first)
    return a.paragraph - b.paragraph
  })

  for (const opp of sortedOpportunities) {
    if (usedUrls.has(opp.url)) continue

    // Check if there's already a link in nearby paragraphs (within 3 paragraphs)
    const hasNearbyLink = suggestions.some(s => Math.abs(s.paragraph - opp.paragraph) < 3)
    if (hasNearbyLink && suggestions.length >= 2) continue // Allow clustering for first 2 links

    suggestions.push({
      paragraph: opp.paragraph,
      anchorText: opp.anchorText,
      url: opp.url,
    })
    usedUrls.add(opp.url)

    if (suggestions.length >= 5) break // Limit total links
  }

  console.log(`[suggestLinks] Found ${allOpportunities.length} opportunities, selected ${suggestions.length} links`)

  return suggestions
}

function insertLinks(
  content: string,
  links: Array<{ paragraph: number; anchorText: string; url: string }>
): string {
  const paragraphs = content.split('\n\n')
  const sortedLinks = [...links].sort((a, b) => b.paragraph - a.paragraph)

  for (const link of sortedLinks) {
    const paragraph = paragraphs[link.paragraph]
    if (!paragraph) continue
    if (paragraph.includes(`](${link.url})`)) continue

    paragraphs[link.paragraph] = paragraph.replace(
      link.anchorText,
      `[${link.anchorText}](${link.url})`
    )
  }

  return paragraphs.join('\n\n')
}

// ============================================================================
// PIPELINE STEPS
// ============================================================================

async function doResearchStep(
  supabase: ReturnType<typeof createClient>,
  job: Job
): Promise<StepResult> {
  console.log(`[${job.keyword}] === STEP: RESEARCH ===`)

  await supabase
    .from('simple_jobs')
    .update({ status: 'researching' })
    .eq('id', job.id)

  try {
    const rawResearch = await research(job.keyword)

    const { error: updateError } = await supabase
      .from('simple_jobs')
      .update({
        research_raw: rawResearch,
        status: 'analyzing',
      })
      .eq('id', job.id)

    if (updateError) {
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
    await supabase
      .from('simple_jobs')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Research failed',
      })
      .eq('id', job.id)

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

async function doAnalyzeStep(
  supabase: ReturnType<typeof createClient>,
  job: Job,
  useNeuronwriter: boolean
): Promise<StepResult> {
  console.log(`[${job.keyword}] === STEP: ANALYZE ===`)

  try {
    const { data: jobData } = await supabase
      .from('simple_jobs')
      .select('research_raw')
      .eq('id', job.id)
      .single()

    if (!jobData?.research_raw) {
      throw new Error('No research data found')
    }

    // Run Claude analysis and NeuronWriter in PARALLEL to save time
    console.log(`[${job.keyword}] Starting analysis (parallel)...`)

    const analysisPromise = analyzeResearch(job.keyword, jobData.research_raw)
    const neuronwriterPromise = useNeuronwriter
      ? analyzeKeywordNeuronWriter(job.keyword).catch(err => {
          console.warn(`[${job.keyword}] NeuronWriter failed:`, err)
          return null
        })
      : Promise.resolve(null)

    const [analyzedResearch, neuronwriterData] = await Promise.all([
      analysisPromise,
      neuronwriterPromise,
    ])

    console.log(`[${job.keyword}] Analysis complete`)

    if (neuronwriterData) {
      await supabase
        .from('simple_jobs')
        .update({ neuronwriter_data: neuronwriterData as unknown as Record<string, unknown> })
        .eq('id', job.id)
      console.log(`[${job.keyword}] NeuronWriter: got ${neuronwriterData.recommendedTerms.length} terms`)
    }

    const { error: updateError } = await supabase
      .from('simple_jobs')
      .update({
        research_analyzed: analyzedResearch,
        status: 'writing',
      })
      .eq('id', job.id)

    if (updateError) {
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
    await supabase
      .from('simple_jobs')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Analysis failed',
      })
      .eq('id', job.id)

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

async function doWriteStep(
  supabase: ReturnType<typeof createClient>,
  job: Job,
  batchId: string
): Promise<StepResult> {
  console.log(`[${job.keyword}] === STEP: WRITE ===`)

  try {
    const { data: jobData } = await supabase
      .from('simple_jobs')
      .select('research_analyzed, neuronwriter_data')
      .eq('id', job.id)
      .single()

    if (!jobData?.research_analyzed) {
      throw new Error('No analyzed research found')
    }

    const neuronwriterData = jobData.neuronwriter_data as NeuronWriterAnalysis | null

    let blogResult = await writeBlog(
      job.keyword,
      jobData.research_analyzed,
      neuronwriterData
        ? {
            recommendedTerms: neuronwriterData.recommendedTerms,
            competitorHeadings: neuronwriterData.competitorHeadings,
            wordCountTarget: neuronwriterData.wordCountTarget,
          }
        : null
    )

    let content = blogResult.content
    const links = suggestLinks(content)
    if (links.length > 0) {
      content = insertLinks(content, links)
    }

    let score: number | null = null
    if (neuronwriterData) {
      const scoreResult = calculateScore(content, neuronwriterData)
      score = scoreResult.percentage
      console.log(`[${job.keyword}] Score: ${score}%`)

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

    // Apply post-processing (dedupe links, remove pushy CTAs, validate brand keywords)
    const { content: processedContent, brandValidation } = postProcessContent(content, job.keyword)
    content = processedContent

    // Extract internal links (after deduplication)
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g
    const internalLinks: string[] = []
    let match
    while ((match = linkRegex.exec(content)) !== null) {
      if (match[2].includes('habitto.com')) {
        internalLinks.push(match[2])
      }
    }

    const wordCount = content.length

    // Import content to NeuronWriter editor if we have a query ID
    let neuronwriterEditorUrl: string | null = null
    let neuronwriterRealScore: number | null = null
    if (neuronwriterData?.queryId) {
      console.log(`[${job.keyword}] Importing content to NeuronWriter editor...`)
      const importResult = await importToNeuronWriter(
        neuronwriterData.queryId,
        blogResult.title,
        blogResult.metaDescription,
        content
      )
      if (importResult.success) {
        neuronwriterRealScore = importResult.contentScore
        neuronwriterEditorUrl = importResult.editorUrl
        console.log(`[${job.keyword}] NeuronWriter real score: ${neuronwriterRealScore}%`)
        console.log(`[${job.keyword}] NeuronWriter editor: ${neuronwriterEditorUrl}`)
      } else {
        console.warn(`[${job.keyword}] NeuronWriter import failed: ${importResult.error}`)
      }
    }

    // Use NeuronWriter's real score if available, otherwise use our calculated score
    const finalScore = neuronwriterRealScore ?? score

    await supabase.from('simple_blogs').insert({
      job_id: job.id,
      keyword: job.keyword,
      title: blogResult.title,
      content,
      meta_description: blogResult.metaDescription,
      word_count: wordCount,
      internal_links: internalLinks,
      neuronwriter_score: finalScore,
      neuronwriter_editor_url: neuronwriterEditorUrl,
    })

    await supabase
      .from('simple_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    // Increment batch progress
    const { data: batch } = await supabase
      .from('simple_batches')
      .select('completed_keywords')
      .eq('id', batchId)
      .single()

    if (batch) {
      await supabase
        .from('simple_batches')
        .update({ completed_keywords: (batch.completed_keywords || 0) + 1 })
        .eq('id', batchId)
    }

    console.log(`[${job.keyword}] === COMPLETED === Score: ${score || 'N/A'}%`)

    return {
      status: 'processing',
      jobId: job.id,
      keyword: job.keyword,
      step: 'write',
      nextStep: 'completed',
      message: `Blog complete: "${blogResult.title}" (${wordCount} chars, ${score || 'N/A'}%)`,
    }
  } catch (error) {
    console.error(`[${job.keyword}] Write failed:`, error)

    await supabase
      .from('simple_jobs')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Write failed',
      })
      .eq('id', job.id)

    // Increment failed count
    const { data: batch } = await supabase
      .from('simple_batches')
      .select('failed_keywords')
      .eq('id', batchId)
      .single()

    if (batch) {
      await supabase
        .from('simple_batches')
        .update({ failed_keywords: (batch.failed_keywords || 0) + 1 })
        .eq('id', batchId)
    }

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

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { batchId, useNeuronwriter } = await req.json()

    if (!batchId) {
      return new Response(
        JSON.stringify({ error: 'batchId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Ensure batch is running
    await supabase
      .from('simple_batches')
      .update({ status: 'running' })
      .eq('id', batchId)

    // Get next job to process
    // First check for jobs that are mid-processing
    const { data: inProgressJobs } = await supabase
      .from('simple_jobs')
      .select('*')
      .eq('batch_id', batchId)
      .in('status', ['researching', 'analyzing', 'writing'])
      .order('created_at', { ascending: true })
      .limit(1)

    let job: Job | null = null

    if (inProgressJobs && inProgressJobs.length > 0) {
      job = inProgressJobs[0] as Job
    } else {
      // Get pending jobs
      const { data: pendingJobs } = await supabase
        .from('simple_jobs')
        .select('*')
        .eq('batch_id', batchId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)

      if (pendingJobs && pendingJobs.length > 0) {
        job = pendingJobs[0] as Job
      }
    }

    if (!job) {
      // Check if batch is complete
      const { data: allJobs } = await supabase
        .from('simple_jobs')
        .select('status')
        .eq('batch_id', batchId)

      const completed = allJobs?.filter(j => j.status === 'completed').length || 0
      const failed = allJobs?.filter(j => j.status === 'failed').length || 0
      const total = allJobs?.length || 0

      if (completed + failed === total) {
        await supabase
          .from('simple_batches')
          .update({ status: failed === total ? 'failed' : 'completed' })
          .eq('id', batchId)

        return new Response(
          JSON.stringify({
            success: true,
            status: 'completed',
            message: `Batch complete: ${completed} succeeded, ${failed} failed`,
            batchComplete: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: 'no_work',
          message: 'No jobs to process',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process based on current status
    let result: StepResult

    switch (job.status) {
      case 'pending':
      case 'researching':
        result = await doResearchStep(supabase, job)
        break

      case 'analyzing':
        result = await doAnalyzeStep(supabase, job, useNeuronwriter ?? true)
        break

      case 'writing':
        result = await doWriteStep(supabase, job, batchId)
        break

      default:
        result = {
          status: 'no_work',
          jobId: job.id,
          keyword: job.keyword,
          message: `Job in unexpected status: ${job.status}`,
        }
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error processing batch step:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to process step',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
