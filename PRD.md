# PRD: Habitto Simple Blog Generator

## Project Overview

**Project Title:** Habitto Simple Blog Generator

A stripped-down, single-purpose app that generates SEO-optimized Japanese blog articles for Habitto, a Japanese fintech company. The user pastes keywords, optionally enables NeuronWriter SEO optimization, clicks Start, and the system produces publication-ready content with proper Habitto branding, internal links, and product mentions.

### Problem Statement

The current agency-dashboard is overloaded with features that aren't being used. A simple Claude project with a good prompt is producing better results than the complex multi-service architecture. We need a focused tool that:
1. Takes keyword input (single or bulk)
2. Optionally uses NeuronWriter for SEO keyword recommendations
3. Researches the topic using Perplexity (via OpenRouter)
4. Combines research + SEO keywords + Habitto context
5. Writes a high-quality blog aiming for NeuronWriter score 60+

### Success Criteria

- [ ] User can paste 1-500 keywords and start generation with one click
- [ ] Each blog scores 60+ on NeuronWriter when that option is enabled
- [ ] Generation time < 3 minutes per keyword
- [ ] Content follows Habitto brand voice (friendly, educational, です・ます調)
- [ ] Each blog has 3-6 internal links to Habitto pages
- [ ] Product mentions appear in second half of article only
- [ ] Zero configuration required - works out of the box

### Technology Stack

Based on [2025 Next.js best practices](https://dev.to/bajrayejoon/best-practices-for-organizing-your-nextjs-15-2025-53ji):

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Next.js (App Router) | 15.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Database | Supabase | CLI + JS SDK |
| AI Gateway | OpenRouter | API v1 |
| Research Model | perplexity/sonar-pro | via OpenRouter |
| Analysis Model | anthropic/claude-sonnet-4.5 | via OpenRouter |
| Writing Model | anthropic/claude-sonnet-4.5 | via OpenRouter |
| SEO Tool | NeuronWriter API | v1 |
| Testing | Vitest + Playwright | Latest |
| Package Manager | pnpm | 9.x |
| Deployment | Vercel | Latest |

---

## Architecture & Setup Phase

### Task 1: Project Scaffolding

**Description:** Create the Next.js 15 project with minimal structure. No database, no auth, no complex state management.

**Acceptance Criteria:**
- [ ] Project created with `pnpm create next-app@latest`
- [ ] TypeScript strict mode enabled
- [ ] App Router structure (`src/app/`)
- [ ] Tailwind CSS configured
- [ ] No unnecessary dependencies

**Test Requirements:**
- [ ] `pnpm build` completes without errors
- [ ] `pnpm dev` starts on port 3000
- [ ] Home page renders

```json
{
  "task_id": "TASK-1",
  "name": "Project Scaffolding",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": [],
  "estimated_complexity": "low"
}
```

### Task 2: Environment Configuration

**Description:** Set up environment variables for OpenRouter and NeuronWriter APIs.

**Acceptance Criteria:**
- [ ] `.env.local.example` file with all required vars
- [ ] Environment validation on app start
- [ ] Clear error messages for missing keys

**Environment Variables:**
```
OPENROUTER_API_KEY=your_key_here
NEURONWRITER_API_KEY=your_key_here
NEURONWRITER_PROJECT_ID=your_project_id
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Test Requirements:**
- [ ] App crashes gracefully with helpful message if env missing
- [ ] No secrets logged to console

```json
{
  "task_id": "TASK-2",
  "name": "Environment Configuration",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-1"],
  "estimated_complexity": "low"
}
```

### Task 3: Testing Infrastructure

**Description:** Set up Vitest for unit tests and Playwright for E2E tests.

**Acceptance Criteria:**
- [ ] Vitest configured with TypeScript support
- [ ] Playwright configured for E2E
- [ ] Test commands in package.json
- [ ] Coverage reporting enabled

**Directory Structure:**
```
src/
├── __tests__/          # Unit tests (co-located or separate)
├── lib/
│   └── __tests__/      # Lib function tests
tests/
└── e2e/                # Playwright E2E tests
```

**Test Requirements:**
- [ ] `pnpm test` runs unit tests
- [ ] `pnpm test:e2e` runs Playwright tests
- [ ] Coverage threshold set to 80%

```json
{
  "task_id": "TASK-3",
  "name": "Testing Infrastructure",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-1"],
  "estimated_complexity": "low"
}
```

---

## Core Feature Tasks

### Task 4: Habitto Context Module

**Description:** Create a single file containing all Habitto-specific context: brand voice, internal links, product differentiators. This is the "persistent context" that makes our system better than a basic Claude prompt.

**Acceptance Criteria:**
- [ ] Single `src/lib/habitto-context.ts` file
- [ ] Exports `BRAND_VOICE`, `INTERNAL_LINKS`, `DIFFERENTIATORS`
- [ ] Exports `getFullContext()` function that returns formatted prompt text
- [ ] All Japanese text properly encoded

**Habitto Context Data:**

```typescript
// Brand Voice
export const BRAND_VOICE = {
  language: 'ja',
  tone: 'friendly and educational',
  targetAudience: '20-40s Japanese adults interested in personal finance',
  forbiddenPatterns: ['断定的な表現', '絶対', '必ず'],
  preferredPatterns: ['です・ます調', 'かもしれません', '考えられます'],
  companyName: 'Habitto',
}

// Internal Links (3-6 per article, service pages in second half only)
export const INTERNAL_LINKS = [
  {
    url: 'https://www.habitto.com/account/',
    title: '貯蓄口座',
    keywords: ['貯蓄口座', '金利', '0.5%', '年利', '預金', '貯める'],
    anchors: ['Habittoの貯蓄口座', '年利0.5%の口座'],
    isServicePage: true,
  },
  {
    url: 'https://www.habitto.com/card/',
    title: 'デビットカード',
    keywords: ['デビットカード', 'キャッシュバック', '0.8%', '還元'],
    anchors: ['Habittoのデビットカード', '0.8%還元のデビットカード'],
    isServicePage: true,
  },
  {
    url: 'https://www.habitto.com/advisor/',
    title: 'Habittoアドバイザー',
    keywords: ['アドバイザー', '相談', '無料相談', 'FP', 'NISA'],
    anchors: ['Habittoアドバイザー', '無料のファイナンシャルアドバイザー'],
    isServicePage: true,
  },
  {
    url: 'https://www.habitto.com/people-like-you/',
    title: 'お客様の声',
    keywords: ['レビュー', '口コミ', '体験談'],
    anchors: ['実際に使っている人の声'],
    isServicePage: false,
  },
  {
    url: 'https://www.habitto.com/app/',
    title: 'アプリ',
    keywords: ['アプリ', 'ダウンロード'],
    anchors: ['Habittoアプリ'],
    isServicePage: false,
  },
]

// Key Differentiators (emphasize "no conditions" / 条件なし)
export const DIFFERENTIATORS = {
  account: {
    rate: '年利0.5%',
    condition: '条件なし（100万円まで）',
    emphasis: '他のネット銀行と違い、給与振込や取引回数などの条件なしで年利0.5%が適用されます',
  },
  card: {
    cashback: '0.8%キャッシュバック',
    condition: '無条件',
    emphasis: 'ポイント制ではなく現金で還元。条件なしで全ての買い物に適用されます',
  },
  advisor: {
    cost: '無料',
    condition: '押し売りなし',
    emphasis: '商品を売らない中立的な立場で、本当に必要なアドバイスだけを提供します',
  },
}
```

**Test Requirements:**
- [ ] `getFullContext()` returns valid prompt string
- [ ] All service pages marked correctly
- [ ] No forbidden patterns in exports

```json
{
  "task_id": "TASK-4",
  "name": "Habitto Context Module",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-1"],
  "estimated_complexity": "low"
}
```

### Task 5: OpenRouter Client

**Description:** Create a typed OpenRouter client that calls Perplexity for research gathering, Claude for research analysis/synthesis, and Claude for blog writing. Uses [OpenRouter's streaming API](https://openrouter.ai/docs/api/reference/streaming).

**Acceptance Criteria:**
- [ ] Single `src/lib/openrouter.ts` file
- [ ] `gatherResearch(keyword: string)` - calls Perplexity sonar-pro for raw research
- [ ] `analyzeResearch(keyword: string, research: string)` - calls Claude to synthesize/analyze
- [ ] `write(prompt: string)` - calls Claude for blog writing
- [ ] Streaming support for write operations
- [ ] Proper error handling with retries
- [ ] Rate limiting awareness

**API Configuration:**
```typescript
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

const MODELS = {
  research: 'perplexity/sonar-pro',
  analyze: 'anthropic/claude-sonnet-4.5',
  write: 'anthropic/claude-sonnet-4.5',
}
```

**Test Requirements:**
- [ ] Mock OpenRouter responses for unit tests
- [ ] Test timeout handling
- [ ] Test retry logic on 429/5xx errors
- [ ] Integration test with real API (skipped in CI)

```json
{
  "task_id": "TASK-5",
  "name": "OpenRouter Client",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-2"],
  "estimated_complexity": "medium"
}
```

### Task 6: NeuronWriter Client

**Description:** Create a client for NeuronWriter API to get SEO keyword recommendations. Based on [NeuronWriter API docs](https://neuronwriter.com/faqs/neuronwriter-api-how-to-use/).

**Acceptance Criteria:**
- [ ] Single `src/lib/neuronwriter.ts` file
- [ ] `createQuery(keyword: string)` - creates new analysis
- [ ] `getRecommendations(queryId: string)` - gets SEO keywords
- [ ] `checkScore(content: string, queryId: string)` - checks content score
- [ ] Polling mechanism (recommendations take ~60s)
- [ ] Returns structured keyword data with usage counts

**NeuronWriter Response Structure:**
```typescript
interface NeuronWriterRecommendations {
  queryId: string
  mainKeyword: string
  keywords: {
    term: string
    count: number // how many times to use
    importance: 'high' | 'medium' | 'low'
  }[]
  headings: string[] // H2/H3 suggestions
  questions: string[] // FAQs to answer
}
```

**Test Requirements:**
- [ ] Mock NeuronWriter responses
- [ ] Test polling timeout (max 2 minutes)
- [ ] Test score parsing
- [ ] Edge case: API returns no keywords

```json
{
  "task_id": "TASK-6",
  "name": "NeuronWriter Client",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-2"],
  "estimated_complexity": "medium"
}
```

### Task 7: Blog Generation Pipeline

**Description:** The core orchestrator that combines research + NeuronWriter + Habitto context to generate a blog. This is where the magic happens.

**Acceptance Criteria:**
- [ ] Single `src/lib/generate-blog.ts` file
- [ ] `generateBlog(keyword: string, useNeuronWriter: boolean)` function
- [ ] Parallel execution: research + NeuronWriter (if enabled)
- [ ] Combines all context into optimal prompt
- [ ] Returns blog with metadata

**Pipeline Flow:**
```
1. START
   ├── [Parallel] Gather research via Perplexity sonar-pro
   └── [Parallel] Get NeuronWriter keywords (if enabled)
2. ANALYZE research via Claude Sonnet 4.5
   └── Synthesize Perplexity results into structured insights
3. COMBINE
   ├── Analyzed research results
   ├── NeuronWriter keywords (if available)
   ├── Habitto brand voice
   ├── Internal linking rules
   └── Product differentiators
4. WRITE via Claude Sonnet 4.5
5. VALIDATE
   ├── Check word count (target: 2500)
   ├── Check internal links (3-6)
   └── Check NeuronWriter score (if enabled, aim 60+)
6. SAVE to Supabase
7. RETURN blog + metadata
```

**Blog Output Structure:**
```typescript
interface GeneratedBlog {
  keyword: string
  title: string
  content: string // Markdown with internal links
  metaDescription: string
  wordCount: number
  internalLinks: string[]
  neuronWriterScore?: number
  generatedAt: string
}
```

**Test Requirements:**
- [ ] Unit test with mocked API clients
- [ ] Test with NeuronWriter enabled
- [ ] Test with NeuronWriter disabled
- [ ] Test parallel execution completes
- [ ] Edge case: research fails

```json
{
  "task_id": "TASK-7",
  "name": "Blog Generation Pipeline",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-4", "TASK-5", "TASK-6"],
  "estimated_complexity": "high"
}
```

### Task 8: UI - Input Form

**Description:** Simple, single-page UI with keyword input, NeuronWriter toggle, and Start button.

**Acceptance Criteria:**
- [ ] Textarea for keywords (one per line or comma-separated)
- [ ] Toggle for "Use NeuronWriter"
- [ ] "Start" button
- [ ] Keyword count display
- [ ] Input validation (1-500 keywords)

**UI Layout:**
```
┌─────────────────────────────────────────┐
│  Habitto Blog Generator                 │
├─────────────────────────────────────────┤
│                                         │
│  Keywords (one per line):               │
│  ┌─────────────────────────────────┐    │
│  │ 20代 貯金 目安                   │    │
│  │ 30代 投資 始め方                 │    │
│  │ NISA つみたて 違い               │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [✓] Use NeuronWriter SEO              │
│                                         │
│  3 keywords                             │
│                                         │
│  [ Start Generation ]                   │
│                                         │
└─────────────────────────────────────────┘
```

**Test Requirements:**
- [ ] E2E: Enter keywords, click start
- [ ] Validation: Error on 0 keywords
- [ ] Validation: Error on 501+ keywords
- [ ] Toggle state persists

```json
{
  "task_id": "TASK-8",
  "name": "UI - Input Form",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-1", "TASK-3"],
  "estimated_complexity": "low"
}
```

### Task 9: UI - Progress Display

**Description:** Show real-time progress for each keyword being processed.

**Acceptance Criteria:**
- [ ] List of keywords with status indicators
- [ ] Status states: pending, researching, writing, done, error
- [ ] Elapsed time per keyword
- [ ] NeuronWriter score display (if enabled)

**Progress UI:**
```
┌─────────────────────────────────────────┐
│  Generation Progress                    │
├─────────────────────────────────────────┤
│  ✓ 20代 貯金 目安          SEO: 72  45s│
│  ◉ 30代 投資 始め方        Writing... │
│  ○ NISA つみたて 違い      Pending     │
├─────────────────────────────────────────┤
│  1/3 completed                          │
└─────────────────────────────────────────┘
```

**Test Requirements:**
- [ ] E2E: Status updates during generation
- [ ] Error state displays correctly
- [ ] Score displays when available

```json
{
  "task_id": "TASK-9",
  "name": "UI - Progress Display",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-8"],
  "estimated_complexity": "low"
}
```

### Task 10: UI - Results View

**Description:** Display completed blogs with copy/download functionality.

**Acceptance Criteria:**
- [ ] Expandable blog cards
- [ ] Markdown preview
- [ ] Copy to clipboard button
- [ ] Download as .md file
- [ ] Show metadata (word count, links, score)

**Results UI:**
```
┌─────────────────────────────────────────┐
│  ▼ 20代 貯金 目安                       │
│    Words: 2,453 | Links: 5 | SEO: 72    │
│  ┌─────────────────────────────────┐    │
│  │ # 20代の貯金目安は？...          │    │
│  │ ...                              │    │
│  └─────────────────────────────────┘    │
│  [ Copy ] [ Download ]                  │
├─────────────────────────────────────────┤
│  ▶ 30代 投資 始め方                     │
│    Words: 2,521 | Links: 4 | SEO: 68    │
└─────────────────────────────────────────┘
```

**Test Requirements:**
- [ ] E2E: Copy button copies correct content
- [ ] E2E: Download creates valid .md file
- [ ] Markdown renders correctly

```json
{
  "task_id": "TASK-10",
  "name": "UI - Results View",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-9"],
  "estimated_complexity": "medium"
}
```

### Task 11: API Route - Generate

**Description:** Server-side API route that handles generation requests.

**Acceptance Criteria:**
- [ ] POST `/api/generate` endpoint
- [ ] Accepts `{ keywords: string[], useNeuronWriter: boolean }`
- [ ] Returns Server-Sent Events for streaming progress
- [ ] Proper error responses

**API Contract:**
```typescript
// Request
POST /api/generate
{
  "keywords": ["20代 貯金 目安", "30代 投資 始め方"],
  "useNeuronWriter": true
}

// Response (SSE stream)
event: status
data: {"keyword": "20代 貯金 目安", "status": "researching"}

event: status
data: {"keyword": "20代 貯金 目安", "status": "writing"}

event: complete
data: {"keyword": "20代 貯金 目安", "blog": {...}}

event: error
data: {"keyword": "30代 投資 始め方", "error": "Research failed"}
```

**Test Requirements:**
- [ ] Unit test API handler
- [ ] Test SSE format
- [ ] Test error handling
- [ ] Integration test with mocked clients

```json
{
  "task_id": "TASK-11",
  "name": "API Route - Generate",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-7"],
  "estimated_complexity": "medium"
}
```

---

## Testing Architecture

### Unit Tests (Vitest)

```
src/lib/__tests__/
├── habitto-context.test.ts
├── openrouter.test.ts
├── neuronwriter.test.ts
└── generate-blog.test.ts
```

**Mocking Strategy:**
- Mock `fetch` for all API calls
- Use fixtures for API responses
- Test pure functions in isolation

### E2E Tests (Playwright)

```
tests/e2e/
├── full-flow.spec.ts        # Complete generation flow
├── input-validation.spec.ts # Form validation
└── error-handling.spec.ts   # API failure scenarios
```

### Test Commands

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:all": "vitest run && playwright test"
  }
}
```

---

## Instructions for AI Coding Agent

### Development Methodology

You MUST follow **Test-Driven Development (TDD)** and **Spec-Driven Development (SDD)**:

1. **Read the spec first** - Understand the full requirement before writing code
2. **Write tests first** - Create failing tests that define expected behavior
3. **Implement minimally** - Write only enough code to pass tests
4. **Refactor** - Clean up while keeping tests green
5. **Update this document** - Mark checkboxes and update JSON blocks

### Web Search & Documentation Protocol

- Use web search to find current documentation for packages
- Always verify API signatures against latest docs
- Search for known issues/bugs before implementing workarounds
- Key docs to reference:
  - [OpenRouter API](https://openrouter.ai/docs/api/reference/overview)
  - [NeuronWriter API](https://neuronwriter.com/faqs/neuronwriter-api-how-to-use/)
  - [Next.js 15 App Router](https://nextjs.org/docs/app)
  - [Vitest](https://vitest.dev/)

### Test Execution Protocol

After completing each task:
1. Run the current task's unit tests
2. Run the previous 2 tasks' unit tests (regression check)
3. Run all integration tests that touch modified code
4. Only mark task complete if ALL tests pass

### Document Update Protocol

When a task is complete:
1. Check off all acceptance criteria boxes
2. Update the JSON block:
   - Set `"status": "completed"`
   - Set `"tests_status": "passing"`
   - Set `"unit_tests_passing": true`
   - Set `"integration_tests_passing": true`
3. Add completion timestamp as comment

### Error Handling Standards

- Never silently swallow errors
- Log with appropriate severity levels
- Provide actionable error messages in Japanese when user-facing
- Include error recovery paths where applicable

### Code Quality Standards

- TypeScript strict mode required
- No `any` types allowed
- Use meaningful variable/function names
- Keep functions small and focused
- Document complex logic with comments
- No hardcoded values - use configuration
- Japanese text must be properly typed

### Prompt Engineering Focus

The key differentiator of this tool is the **prompt quality**. The prompt sent to Claude for writing should:

1. Include full research context from Perplexity
2. Include NeuronWriter keyword recommendations with usage counts
3. Include complete Habitto brand voice guidelines
4. Include internal linking rules with service page restrictions
5. Include product differentiators emphasizing "条件なし"
6. Request specific structure (word count, headings, links)

**Sample Writing Prompt Structure:**
```
あなたはHabittoのブログライターです。

## リサーチ結果
{researchContent}

## SEOキーワード（必ず使用してください）
{neuronWriterKeywords}

## ブランドボイス
- トーン: 親しみやすく教育的
- です・ます調で書いてください
- 避けるべき表現: 「絶対」「必ず」など断定的な表現
- 推奨表現: 「かもしれません」「考えられます」

## 内部リンク（3-6個挿入）
{internalLinksList}
※サービスページ（貯蓄口座、デビットカード、アドバイザー）は記事の後半でのみリンクしてください

## Habittoの差別化ポイント（必ず強調）
- 貯蓄口座: {accountDifferentiator}
- デビットカード: {cardDifferentiator}
- アドバイザー: {advisorDifferentiator}
※「条件なし」「無条件で」という点を必ず強調してください

## 要件
- 2500語程度
- H2、H3で適切に構造化
- メタディスクリプション（120文字）も作成
- SEOスコア60以上を目指す

キーワード: {keyword}

ブログ記事を書いてください。
```

---

## Project State (External Memory)

### Completed Tasks
<!-- Agent: Add completed task IDs here -->

### Current Task
<!-- Agent: Update with current task ID -->
TASK-1 (next to start)

### Blockers & Notes
<!-- Agent: Document any blockers or important discoveries -->

### Test Results Log
<!-- Agent: Log test run results with timestamps -->

---

## Dependency Graph

```
TASK-1 (Scaffolding)
  ├── TASK-2 (Environment) ─────┐
  │     ├── TASK-5 (OpenRouter)─┤
  │     └── TASK-6 (NeuronWriter)┤
  │                             │
  ├── TASK-3 (Testing) ─────────┤
  │     └── TASK-8 (UI Input)───┼── TASK-9 (UI Progress) ── TASK-10 (UI Results)
  │                             │
  └── TASK-4 (Habitto Context)──┘
                               │
                    TASK-7 (Pipeline) ── TASK-11 (API Route)
```

**Critical Path:** TASK-1 → TASK-2 → TASK-5 + TASK-6 (parallel) → TASK-7 → TASK-11

---

## File Structure (Final)

```
habitto-blog-simple/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── generate/
│   │   │       └── route.ts          # API handler (TASK-11)
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Main UI (TASK-8,9,10)
│   │   └── globals.css
│   ├── lib/
│   │   ├── __tests__/
│   │   │   ├── habitto-context.test.ts
│   │   │   ├── openrouter.test.ts
│   │   │   ├── neuronwriter.test.ts
│   │   │   └── generate-blog.test.ts
│   │   ├── habitto-context.ts        # TASK-4
│   │   ├── openrouter.ts             # TASK-5
│   │   ├── neuronwriter.ts           # TASK-6
│   │   └── generate-blog.ts          # TASK-7
│   └── components/
│       ├── KeywordInput.tsx
│       ├── ProgressList.tsx
│       └── ResultsView.tsx
├── tests/
│   └── e2e/
│       ├── full-flow.spec.ts
│       └── input-validation.spec.ts
├── .env.local.example
├── PRD.md                            # This file
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vitest.config.ts
└── playwright.config.ts
```

---

## Sources

- [Next.js 15 Best Practices 2025](https://dev.to/bajrayejoon/best-practices-for-organizing-your-nextjs-15-2025-53ji)
- [Next.js Project Structure](https://nextjs.org/docs/app/getting-started/project-structure)
- [OpenRouter API Reference](https://openrouter.ai/docs/api/reference/overview)
- [OpenRouter Streaming](https://openrouter.ai/docs/api/reference/streaming)
- [NeuronWriter API Documentation](https://neuronwriter.com/faqs/neuronwriter-api-how-to-use/)
- [NeuronWriter Integration Guide](https://neuronwriter.com/revolutionize-your-content-creation-ai-powered-automation-with-neuronwriter-api/)
