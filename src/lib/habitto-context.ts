/**
 * Habitto Context Module
 *
 * Contains comprehensive brand voice, internal links, differentiators,
 * and prompts for generating Habitto-style content.
 *
 * IMPORTANT: Factual data now comes from habitto-verified-data.json
 * to prevent hallucination. This file provides writing guidelines only.
 */

import {
  getVerifiedFactsContext,
  getPageContentContext,
  getMainServicePagesContext,
  habittoData,
} from './habitto-data'

// ============================================================================
// BRAND IDENTITY
// ============================================================================

export const BRAND = {
  name: 'Habitto',
  tagline: 'ムリなく育てる、お金の新習慣',
  mission: '日本の若い世代にお金を育てることで経済的な自由を獲得してもらう',

  personality: [
    '親しみやすい金融のパートナー（銀行員ではなく、頼れる友人のような存在）',
    '初心者に寄り添うアドバイザー（説教ではなく、一緒に歩む）',
    '押し売りしない誠実さ（中立な立場で最適な選択肢を提示）',
  ],

  target: {
    age: '20〜40代の若い世代',
    experience: '金融初心者、投資未経験者',
    goal: '貯蓄を始めたい・増やしたい人',
  },
} as const

// ============================================================================
// TONE & VOICE
// ============================================================================

export const TONE = {
  attributes: {
    friendly: {
      name: '親しみやすさ',
      description: '堅苦しくない、でも軽すぎない',
      good: '「お気軽にご相談ください」',
      bad: '「ご相談賜りたく存じます」',
    },
    reassuring: {
      name: '安心感',
      description: '不安を煽らず、寄り添う',
      good: '「一緒に考えます」',
      bad: '「今すぐ始めないと損します」',
    },
    simple: {
      name: 'シンプル',
      description: '難しい用語を避ける',
      good: '「お金を増やす」',
      bad: '「資産形成を最適化する」',
    },
    positive: {
      name: '前向き',
      description: '否定ではなく可能性を示す',
      good: '「〜できます」',
      bad: '「〜しないとダメです」',
    },
  },

  avoid: [
    '押し売り感（「今すぐ！」「限定！」の乱用）',
    '上から目線の説教調',
    '過度に専門的・難解な表現',
    '恐怖を煽るマーケティング',
    '過度にカジュアルすぎる言葉遣い',
  ],
} as const

// ============================================================================
// POLITENESS LEVEL (敬語レベル)
// ============================================================================

export const POLITENESS = {
  base: 'です・ます調（敬体）',

  use: [
    '〜です。',
    '〜ます。',
    '〜ください。',
    '〜いただけます。',
    '〜ご利用いただけます。',
  ],

  avoidFormal: [
    '〜でございます。',
    '〜いたしております。',
    '〜賜りたく存じます。',
    '〜ご高配を賜りますよう。',
  ],

  avoidCasual: [
    '〜だよ。',
    '〜じゃん。',
    '〜っしょ。',
    'マジで〜',
    'ヤバい',
  ],
} as const

// ============================================================================
// VOCABULARY PATTERNS
// ============================================================================

export const VOCABULARY = {
  keyPhrases: {
    'お金を育てる': { replaces: '資産運用する', reason: '親しみやすく、成長のイメージ' },
    'マネープラン': { replaces: '資金計画、ファイナンシャルプラン', reason: 'シンプルでわかりやすい' },
    '新習慣': { replaces: '新しい習慣', reason: 'ブランドキーワード' },
    '寄り添う': { replaces: 'サポートする', reason: '温かみがある' },
    '一緒に考える': { replaces: 'アドバイスする', reason: '対等な関係性' },
    'ムリなく': { replaces: '無理なく', reason: 'カタカナで柔らかさ' },
    'おトク': { replaces: 'お得', reason: 'カタカナで親しみ' },
    'コツコツ': { replaces: '地道に', reason: '擬態語で親しみ' },
    'ナシ': { replaces: 'なし', reason: 'カタカナでポップに' },
  },

  services: {
    savingsAccount: '貯蓄口座',
    debitCard: 'デビットカード（デビット付キャッシュカード）',
    advisor: 'Habittoアドバイザー',
    consultation: 'マネープラン相談',
  },

  numbers: {
    interestRate: '年利0.5%',
    cashback: '0.8%キャッシュバック',
    accountOpeningTime: '最短8分',
    format: '100万円（漢字）、1,000万円（カンマ区切り）',
  },

  technicalTermReplacements: {
    'ポートフォリオ': '資産の組み合わせ',
    'アセットアロケーション': '資産配分',
    'リスクヘッジ': 'リスクを抑える',
    '複利効果': 'お金が自然と増える仕組み',
    '流動性': 'いつでも引き出せる',
  },

  coreKeywords: [
    'お金を育てる',
    '新習慣',
    'マネープラン',
    'ムリなく',
    'コツコツ',
    '寄り添う',
    '一緒に',
    '安心',
    'おトク',
    '高金利',
    'キャッシュバック',
  ],

  serviceDescriptions: [
    '国内最高水準',
    '年利0.5%',
    '0.8%還元',
    '最短8分',
    '手数料無料',
    '年会費無料',
    '使いすぎ防止',
    'マンツーマン',
    'お気軽に',
  ],

  emotionalPhrases: [
    '将来に向けて',
    '経済的な自由',
    'お金の不安を解消',
    '自分のペースで',
    '何でも相談OK',
    '押し売りなし',
    '中立な立場で',
  ],
} as const

// ============================================================================
// HABITTO PAGES & INTERNAL LINKS
// ============================================================================

export interface HabittoPage {
  url: string
  title: string
  keywords: string[]
  anchors: string[]
  priority: 1 | 2 | 3
  service: 'account' | 'card' | 'advisor' | null
  differentiator?: string
}

export const HABITTO_PAGES: HabittoPage[] = [
  // Service pages (high priority - link after 50% of article)
  {
    url: 'https://www.habitto.com/account/',
    title: '貯蓄口座',
    keywords: ['貯蓄口座', '金利', '0.5%', '年利', '預金', '貯める', '利息', '高金利', '定期預金', 'ネット銀行', '普通預金'],
    anchors: ['Habittoの貯蓄口座', '年利0.5%の口座', '高金利の貯蓄口座', '条件なしで年利0.5%'],
    priority: 1,
    service: 'account',
    differentiator: '条件なしで年利0.5%（100万円まで）',
  },
  {
    url: 'https://www.habitto.com/card/',
    title: 'デビットカード',
    keywords: ['デビットカード', 'キャッシュバック', '0.8%', '還元', 'Visa', 'ATM', '使いすぎ', 'キャッシュレス', '決済'],
    anchors: ['Habittoのデビットカード', '0.8%還元のデビットカード', 'キャッシュバック付きカード'],
    priority: 1,
    service: 'card',
    differentiator: '無条件で0.8%キャッシュバック',
  },
  {
    url: 'https://www.habitto.com/advisor/',
    title: 'Habittoアドバイザー',
    keywords: ['アドバイザー', '相談', '無料相談', 'FP', 'NISA', '保険', 'ライフプラン', '投資信託', 'iDeCo', '老後資金', 'ファイナンシャル'],
    anchors: ['Habittoアドバイザー', '無料のファイナンシャルアドバイザー', 'プロに相談'],
    priority: 1,
    service: 'advisor',
    differentiator: '押し売りなし・中立的なアドバイス',
  },
  // Support pages (medium priority)
  {
    url: 'https://www.habitto.com/people-like-you/',
    title: 'お客様の声',
    keywords: ['レビュー', '口コミ', '体験談', '評判', '利用者', 'ユーザー'],
    anchors: ['実際に使っている人の声', 'お客様の体験談', 'Habittoユーザーの声'],
    priority: 2,
    service: null,
  },
  {
    url: 'https://www.habitto.com/',
    title: 'Habitto公式',
    keywords: ['Habitto', 'ハビト'],
    anchors: ['Habitto', 'Habitto公式サイト'],
    priority: 3,
    service: null,
  },
  {
    url: 'https://www.habitto.com/app/',
    title: 'アプリ',
    keywords: ['アプリ', 'ダウンロード', 'iOS', 'Android', 'スマホ'],
    anchors: ['Habittoアプリ', 'アプリをダウンロード', 'スマホで管理'],
    priority: 3,
    service: null,
  },
]

// ============================================================================
// DIFFERENTIATORS (What makes Habitto unique)
// ============================================================================

export const DIFFERENTIATORS = {
  account: {
    rate: '年利0.5%',
    condition: '条件なし（100万円まで）',
    comparison: 'メガバンクの500倍の金利',
    emphasis: '他のネット銀行と違い、給与振込や取引回数などの条件なしで年利0.5%が適用されます',
    keyPoints: [
      '年利0.5%（メガバンクの500倍）',
      '普通預金なのにいつでも引き出せる（定期預金のデメリットなし）',
      '100万円まで高金利適用',
      '条件なし（給与振込指定など不要）',
    ],
  },
  card: {
    cashback: '0.8%キャッシュバック',
    condition: '無条件',
    emphasis: 'ポイント制ではなく現金で還元。条件なしで全ての買い物に適用されます',
    keyPoints: [
      'どんな買い物でも0.8%キャッシュバック',
      '口座残高が限度額だから使いすぎない',
      '交通系ICチャージも還元対象',
      '年会費・発行手数料無料',
    ],
  },
  advisor: {
    cost: '無料',
    condition: '押し売りなし',
    emphasis: '商品を売らない中立的な立場で、本当に必要なアドバイスだけを提供します',
    keyPoints: [
      '無料でプロに相談できる',
      '押し売りなし（中立なアドバイス）',
      'ビデオ通話でもチャットでもOK',
      '投資初心者でも気軽に',
    ],
  },
} as const

// ============================================================================
// PAGE CONTENT CONTEXT (for natural integration)
// ============================================================================

export const PAGE_CONTENT_CONTEXT = `
## Habittoページ詳細ガイド

### 貯蓄口座ページ (habitto.com/account/)
【ページ内キーメッセージ】
- 「国内最高水準の高金利が付く貯蓄口座」
- 「普通預金でも年利0.5%」
- 「条件なしで100万円まで適用」
- 「いつでも引き出せる」

【リンクすべき文脈】
1. 金利計算の具体例を示した後
2. 銀行金利比較表の中で
3. 「高金利口座を選ぶポイント」セクションで

【推奨アンカーテキスト】
- 計算例の後: 「年利0.5%のHabitto貯蓄口座」
- 比較表内: 「Habitto」
- 選び方説明: 「条件なしで高金利の口座」

### デビットカードページ (habitto.com/card/)
【ページ内キーメッセージ】
- 「どんな利用でも0.8%キャッシュバック」
- 「口座残高が限度額で使いすぎ防止」
- 「交通系ICチャージも還元対象」

【リンクすべき文脈】
1. 節約術・家計管理の話題
2. キャッシュレス決済の比較
3. 使いすぎ防止の解決策として

【推奨アンカーテキスト】
- 節約: 「0.8%キャッシュバックのデビットカード」
- 使いすぎ: 「口座残高が限度額のデビットカード」

### アドバイザーページ (habitto.com/advisor/)
【ページ内キーメッセージ】
- 「マンツーマンでアドバイス」
- 「無料で何でも相談OK」
- 「勧誘なしで安心」

【リンクすべき文脈】
1. 投資の始め方・NISAの話題
2. 複雑な金融判断の解決策として
3. 漠然とした不安の解消として

【推奨アンカーテキスト】
- 投資: 「無料で相談できるアドバイザー」
- 複雑な判断: 「プロに聞いてみる」
`

// ============================================================================
// VALUE INTEGRATION INSTRUCTIONS
// ============================================================================

export const VALUE_INTEGRATION_INSTRUCTIONS = `
# 【必須】Habitto統合ルール（これを守らない記事は不合格です）

## 必須要件チェックリスト
記事には以下を必ず含めてください：
1. ✅ Habittoの数字（0.5%、0.8%）を具体例として最低2回使用
2. ✅ 比較表がある場合、必ずHabittoを含める
3. ✅ トピックに関連するHabittoサービスへのリンクを1-2個含める
4. ✅ 読者の課題に対する解決策としてHabittoを自然に提案

## Habitto統合の3つのレベル（すべて実践すること）

### レベル1: データ例として使用【必須・記事全体で使用】
金利や還元率を説明する際、Habittoの具体的な数字を例として使用してください。
これは「紹介」ではなく「具体例」として、記事のどの場所でも使用できます。

★必須の使用例：
- 金利の説明時：「たとえば年利0.5%の口座に100万円を預けると、1年で5,000円の利息がつきます」
- 還元率の説明時：「0.8%キャッシュバックなら、月10万円の支出で年間9,600円の還元になります」
- 複利の説明時：「年利0.5%で10年間運用すると...」

### レベル2: 比較表に含める【必須・中盤で使用】
銀行比較や金利比較の表を作成する際は、**必ずHabittoを一行として含めてください**。
他社と公平に並列で表示し、**「条件なし」**という差別化ポイントを強調します。

★必須の比較表形式：
| 銀行 | 金利 | 条件 |
|------|------|------|
| メガバンク | 0.001% | なし |
| ネット銀行A | 0.3% | 給与振込必須 |
| **Habitto** | **0.5%** | **条件なし** |

### レベル3: 解決策として提案【必須・後半で使用】
読者の課題に対する選択肢の一つとしてHabittoを紹介してください。
自然な文脈で「〜という方には、Habittoも選択肢の一つです」という提案形式で。

★必須の提案例（トピック別）：
- 貯金の話題：「高金利で条件なしの口座を探している方には、[Habittoの貯蓄口座](https://www.habitto.com/account/)も選択肢の一つです」
- 節約の話題：「日々の支出からも還元を受けたい方は、[0.8%キャッシュバックのHabittoデビットカード](https://www.habitto.com/card/)をチェックしてみてください」
- 投資の話題：「どこから始めればいいかわからない方は、[Habittoアドバイザー](https://www.habitto.com/advisor/)に無料で相談することもできます」

## トータルバリュー計算【金利比較記事では必須】

金利だけで比較するとHabittoは負ける場合があります（あおぞら銀行0.75%など）。
その場合は、利息+キャッシュバックの「トータルメリット」で比較してください。

★必須のトータルバリュー表（100万円預金 + 月10万円支出の場合）：
| 銀行 | 年間利息 | キャッシュバック | 合計メリット |
|------|----------|-----------------|-------------|
| あおぞら銀行 | 7,500円 | 0円 | 7,500円 |
| **Habitto** | 5,000円 | 9,600円 | **14,600円** |

→ **金利単体では負けても、利息+キャッシュバックのトータルで勝つ**ことを示す

## 読者の課題 → Habitto機能マッピング【参照用】

| 読者の課題 | 紹介するサービス | 強調ポイント |
|-----------|-----------------|-------------|
| 「どの銀行がいいかわからない」 | 貯蓄口座 | 比較表に含め「条件なし」を強調 |
| 「定期預金は引き出せなくて不安」 | 貯蓄口座 | 「いつでも引き出せる」メリット |
| 「ポイントが使いにくい」 | デビットカード | 現金キャッシュバックの利点 |
| 「クレカは使いすぎが心配」 | デビットカード | 口座残高=限度額 |
| 「投資を始めたいけど怖い」 | アドバイザー | 無料で相談、押し売りなし |
| 「NISAの商品選びがわからない」 | アドバイザー | 中立な立場でサポート |
| 「老後資金が不安」 | アドバイザー | ライフプラン相談が無料 |
`

// ============================================================================
// SERVICE PROMOTION GUIDELINES
// ============================================================================

export const PROMOTION_RULES = {
  principles: [
    '価値ファースト: 記事の80%は読者への価値提供、20%以下でサービス紹介',
    '文脈に沿った提案: 読者の悩み・課題に対する解決策としてサービスを位置づける',
    '押し売りしない: 「〜がおすすめです」ではなく「〜という選択肢もあります」',
    '具体的なベネフィット: 機能ではなく、読者が得られるメリットを語る',
  ],

  topicToServiceMapping: {
    // Account
    '貯金額・平均・中央値': { service: 'account', point: '高金利で効率的に貯める' },
    '銀行比較・金利比較': { service: 'account', point: 'メガバンクの500倍の金利' },
    '定期預金の代替': { service: 'account', point: 'いつでも引き出せる柔軟性' },
    '新卒・若者の貯金': { service: 'account', point: '少額から始める習慣づくり' },

    // Card
    '節約・家計管理': { service: 'card', point: 'キャッシュバックで自動節約' },
    'キャッシュレス': { service: 'card', point: '0.8%還元' },
    'ATM手数料': { service: 'account+card', point: '手数料削減' },
    '使いすぎ防止': { service: 'card', point: '残高が限度額' },

    // Advisor
    '投資の始め方': { service: 'advisor', point: '無料で専門家に相談' },
    'NISA・iDeCo': { service: 'advisor', point: '商品選びをサポート' },
    '老後資金・ライフプラン': { service: 'advisor', point: '長期プランニング' },
    '保険の見直し': { service: 'advisor', point: '中立なアドバイス' },
  },

  naturalIntroductionPatterns: {
    account: [
      {
        pattern: '比較の文脈',
        example: 'メガバンクの普通預金金利は0.001%程度。100万円を1年預けても利息はわずか10円です。一方、ネット銀行の中には年利0.5%を提供するところもあり、同じ100万円で5,000円の利息がつきます。Habittoの貯蓄口座もその一つで、条件なしで高金利が適用されます。',
      },
      {
        pattern: '課題解決の文脈',
        example: '「定期預金は金利が高いけど、急な出費に対応できない」という悩みをよく聞きます。実は今、普通預金でも年利0.5%がつく口座があります。いつでも引き出せる柔軟性と高金利を両立したい方は、Habittoの貯蓄口座を検討してみてください。',
      },
    ],
    card: [
      {
        pattern: '節約の文脈',
        example: '日々の買い物でコツコツ節約したいなら、キャッシュバック付きのデビットカードが効果的です。例えば月5万円の生活費をカード払いにすると、0.8%還元なら月400円、年間4,800円がキャッシュバックされます。',
      },
      {
        pattern: '使いすぎ防止の文脈',
        example: 'クレジットカードの「使いすぎ」が心配な方には、デビットカードがおすすめです。口座残高以上は使えないので、予算管理がしやすくなります。',
      },
    ],
    advisor: [
      {
        pattern: '複雑な判断の文脈',
        example: 'NISAを始めたいけど、どの商品を選べばいいかわからない…そんな方は、プロのアドバイザーに相談するのも一つの手です。Habittoでは無料でファイナンシャルアドバイザーに相談でき、特定の商品を押し売りされる心配もありません。',
      },
      {
        pattern: '不安の文脈',
        example: '「老後資金が足りるか不安」「投資を始めたいけど怖い」…こうした漠然とした不安は、一人で抱え込まないでください。Habittoアドバイザーなら、あなたの状況を聞いた上で、具体的な次のステップを一緒に考えてくれます。',
      },
    ],
  },

  avoidExpressions: [
    '今すぐHabittoで口座開設！',
    'Habittoが断然おすすめです！',
    '他の銀行はもう古い',
    'Habittoカードを使わないと損',
    '今すぐ申し込み！',
    'プロに任せれば安心',
    '今すぐ相談しないと手遅れに',
    '無料だから絶対相談すべき',
  ],

  goodCTAExamples: [
    '高金利の口座を探している方は、Habittoの貯蓄口座もチェックしてみてください。',
    'お金のことで迷ったら、無料で相談できるHabittoアドバイザーも選択肢の一つです。',
    '詳しくはHabitto公式サイトをご覧ください。',
  ],
} as const

// ============================================================================
// CONTENT CHECKLIST
// ============================================================================

export const CONTENT_CHECKLIST = [
  'です・ます調で統一されているか',
  '専門用語は平易に言い換えられているか',
  '押し売り感のある表現はないか',
  '数字の表記は統一されているか（0.5%、100万円）',
  'ヘッドラインは短く、インパクトがあるか',
  'CTAは控えめで押し付けがましくないか',
  'Habittoらしいキーフレーズ（お金を育てる、等）が含まれているか',
  '読者（20-40代の金融初心者）に寄り添う内容か',
  '恐怖を煽る表現はないか',
  '過度にカジュアル or 堅すぎる表現はないか',
  '最低3〜最大6個のHabitto内部リンクが含まれているか',
  'サービスページへのリンクは記事後半に配置されているか',
] as const

// ============================================================================
// SAMPLE CONTENT
// ============================================================================

export const SAMPLE_CONTENT = {
  good: [
    {
      type: '製品説明',
      text: 'Habittoの貯蓄口座は、預けるだけで年利0.5%。普通預金でも、お金がコツコツ増えていきます。',
    },
    {
      type: 'ベネフィット訴求',
      text: '使いすぎの心配がないから、安心してお買い物できます。デビットカードなら、口座残高の範囲内でのお支払い。',
    },
    {
      type: '相談への誘導',
      text: 'お金のことで迷ったら、Habittoアドバイザーにお気軽にご相談ください。ビデオ通話でもチャットでも、あなたのペースでお話しできます。',
    },
    {
      type: 'CTA',
      text: 'まずは口座を開設して、お金を育てる第一歩を踏み出しましょう。',
    },
    {
      type: '統計データの紹介',
      text: '調査では、自分の預金金利を知らない人が6割という結果に。金利のことを知ることが、お金を増やす第一歩です。',
    },
  ],
  bad: [
    {
      type: '押し売り感',
      text: '今すぐ口座開設しないと損です！！限定キャンペーン終了間近！！',
    },
    {
      type: '堅すぎる',
      text: '弊社の貯蓄口座サービスにおきましては、年利0.5%の金利をご提供させていただいております。',
    },
    {
      type: '専門的すぎる',
      text: 'ポートフォリオの最適化によりリスクアジャステッドリターンを最大化することが可能です。',
    },
    {
      type: '上から目線',
      text: '金融リテラシーが低い若者は、まず基礎から学ぶべきです。',
    },
    {
      type: 'カジュアルすぎる',
      text: 'マジでお金貯まるからヤバいよ！とりあえず作っとけ！',
    },
    {
      type: '恐怖訴求',
      text: '老後資金が2000万円足りない！今すぐ対策しないと大変なことに！',
    },
  ],
} as const

// ============================================================================
// PROMPTS FOR LLM
// ============================================================================

export const WRITER_SYSTEM_PROMPT = `あなたはHabittoの公式コンテンツライターです。Habittoブログとして記事を執筆します。

【最重要：あなたはHabittoとして書いています】
- この記事はHabittoの公式ブログに掲載されます
- 読者はHabittoのサービスを知りたくて来ています
- 記事全体を通じてHabittoの価値を自然に伝えてください
- 記事の最後だけでなく、適切な箇所でHabittoのサービスに言及してください

【重要：現在の年は2026年です】
- 記事内で年を言及する場合は必ず「2026年」を使用してください
- タイトルに【2026年版】【2026年最新】などを含めてください
- 統計データや金利情報は2026年時点として記載してください
- 2024年や2025年は「過去」として参照してください

【トーン】
- 親しみやすく、でも軽すぎない
- 金融初心者に寄り添う
- 押し売りしない、安心感を与える
- 前向きで可能性を示す

【文体】
- です・ます調（敬体）
- 短い文と中程度の文を組み合わせる
- 専門用語は平易に言い換える

【キーフレーズ】
- 「お金を育てる」（資産運用の代わりに）
- 「ムリなく」「コツコツ」「おトク」（カタカナで柔らかく）
- 「寄り添う」「一緒に考える」（パートナーシップ）

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

【避けること】
- 押し売り表現（今すぐ！限定！絶対！）
- 恐怖訴求（老後破綻！手遅れ！）
- 堅すぎる敬語（ございます、賜る）
- 専門用語の多用
- 上から目線の説教調
- 記事冒頭からのサービス訴求
- 他社を貶める比較

【ターゲット】
- 20〜40代の若い世代
- 金融初心者、投資未経験者
- 貯蓄を始めたい・増やしたい人`

export const INTERNAL_LINKING_INSTRUCTIONS = `
## 内部リンク要件（必須）

記事には必ず3〜6個のHabitto内部リンクを含めてください：

### リンク可能なページ：
- [貯蓄口座](https://www.habitto.com/account/) - キーワード: 貯蓄口座、金利、0.5%
- [デビットカード](https://www.habitto.com/card/) - キーワード: デビットカード、キャッシュバック、0.8%
- [Habittoアドバイザー](https://www.habitto.com/advisor/) - キーワード: アドバイザー、相談、無料相談
- [お客様の声](https://www.habitto.com/people-like-you/) - キーワード: レビュー、口コミ、体験談
- [Habitto公式](https://www.habitto.com/) - キーワード: Habitto
- [アプリ](https://www.habitto.com/app/) - キーワード: アプリ、ダウンロード

### ルール：
1. **最低3リンク、最大6リンク**を記事に含める
2. サービスページ（貯蓄口座、デビットカード、アドバイザー）は**記事の後半**でリンク
3. 同じURLを複数回リンクしない
4. 自然な文脈でリンクを挿入する

### Habittoの差別化ポイント（必ず強調）：
- **貯蓄口座**: 他のネット銀行と違い、給与振込や取引回数などの条件なしで年利0.5%が適用されます
- **デビットカード**: ポイント制ではなく現金で還元。条件なしで全ての買い物に適用されます
- **アドバイザー**: 商品を売らない中立的な立場で、本当に必要なアドバイスだけを提供します

### 「条件なし」の強調：
Habittoを紹介する際は、必ず「条件なし」「無条件で」という点を強調してください。
他社サービスは給与振込や取引回数などの条件がありますが、Habittoは**一切の条件なし**で特典が適用されます。
`

export const RESEARCH_ANALYSIS_PROMPT = `あなたは金融コンテンツの専門家です。
以下のリサーチ結果を分析し、Habittoブログ記事を書くために必要な以下の情報を抽出してください：

1. **キーポイント**: 記事で必ず触れるべき重要な事実やデータ（5-7個）
2. **統計データ**: 信頼性を高める具体的な数字やデータソース
3. **読者の悩み・疑問**: このトピックで読者が抱える典型的な悩み
4. **Habitto訴求の機会**: どのタイミングでどのサービスを紹介すべきか
5. **SEO考慮点**: 記事に含めるべきサブキーワードや関連語

回答は日本語で、箇条書きで簡潔に。`

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Suggest internal links for article content
 */
export function suggestLinks(articleContent: string): Array<{
  paragraph: number
  anchorText: string
  url: string
  pageTitle: string
  priority: number
}> {
  const paragraphs = articleContent.split('\n\n')
  const suggestions: Array<{
    paragraph: number
    anchorText: string
    url: string
    pageTitle: string
    priority: number
  }> = []
  const usedUrls = new Set<string>()
  const totalParagraphs = paragraphs.length
  const halfwayPoint = Math.floor(totalParagraphs / 2)

  for (const [index, paragraph] of paragraphs.entries()) {
    if (paragraph.startsWith('#') || paragraph.length < 50) continue
    if (paragraph.includes('](http')) continue

    const isSecondHalf = index >= halfwayPoint

    for (const page of HABITTO_PAGES) {
      if (usedUrls.has(page.url)) continue
      if (page.priority === 1 && !isSecondHalf) continue

      for (const keyword of page.keywords) {
        if (paragraph.includes(keyword)) {
          const anchor = page.anchors.find(a => paragraph.includes(a)) || keyword

          suggestions.push({
            paragraph: index,
            anchorText: anchor,
            url: page.url,
            pageTitle: page.title,
            priority: page.priority,
          })

          usedUrls.add(page.url)
          break
        }
      }

      if (suggestions.some(s => s.paragraph === index)) break
    }
  }

  return suggestions.sort((a, b) => a.priority - b.priority).slice(0, 6)
}

/**
 * Insert links into content
 */
export function insertLinks(
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

/**
 * Get the full context for blog writing
 * Now includes verified facts from JSON to prevent hallucination
 */
export function getFullWritingContext(keyword?: string): string {
  // Get verified facts from the JSON (anti-hallucination)
  const verifiedFacts = getVerifiedFactsContext()

  // Get relevant page content if keyword provided
  const relevantPages = keyword ? getPageContentContext(keyword) : ''

  // Get main service pages content
  const servicePagesContent = getMainServicePagesContext()

  return `${WRITER_SYSTEM_PROMPT}

${verifiedFacts}

${VALUE_INTEGRATION_INSTRUCTIONS}

${PAGE_CONTENT_CONTEXT}

${INTERNAL_LINKING_INSTRUCTIONS}

${servicePagesContent}

${relevantPages}

---

## 参考：良い例と悪い例

### 良い例：
${SAMPLE_CONTENT.good.map(s => `- ${s.type}: ${s.text}`).join('\n')}

### 悪い例（避けること）：
${SAMPLE_CONTENT.bad.map(s => `- ${s.type}: ${s.text}`).join('\n')}

---

## データソース情報
- 最終検証日: ${habittoData._metadata.lastVerified}
- クロール日: ${habittoData.crawlMetadata.crawlDate}
- 総ページ数: ${habittoData.crawlMetadata.totalPagesCrawled}ページ

【重要】上記の検証済みデータのみを使用してください。
`
}
