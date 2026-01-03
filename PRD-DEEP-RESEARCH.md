# PRD: Deep Research Feature for Habitto Writer

## Project Overview

### Summary
Add a "Deep Research" feature to the Habitto Writer v2 chat interface that leverages Claude's native web search tool to gather up-to-date, relevant information based on the user's keyword and saved Habitto context. When a user enters a keyword, Claude performs semantic web searches, filters for recent/dated content, and compiles research findings that can be used to write authoritative blog posts.

### Problem Statement
Currently, blog content is generated using only the static context files (brand guidelines, etc.) and NeuronWriter SEO data. Writers lack access to:
- Current statistics and trends
- Recent news and developments
- Competitor content analysis
- Up-to-date regulatory information (important for finance content)

### Solution
Integrate Claude's native `web_search_20250305` tool to perform intelligent, multi-query research when triggered by the user. The research results are compiled into a structured brief that feeds into the blog writing process.

### Success Criteria
- [ ] User can trigger research with a single click after entering a keyword
- [ ] Claude performs 3-5 semantic searches automatically
- [ ] Results include source URLs, titles, publication dates, and key findings
- [ ] Research prioritizes content from the last 12 months
- [ ] Research results are displayed in the UI and saved to the conversation
- [ ] Integration with existing Habitto context (brand voice, guidelines) for query formulation

### Technology Stack
- **Runtime**: Next.js 16.x (existing)
- **AI**: Anthropic Claude API with web_search tool (`@anthropic-ai/sdk` ^0.71.2)
- **Database**: Supabase (existing)
- **Frontend**: React 19, TypeScript, Tailwind CSS (existing)

---

## Architecture & Setup Phase

### Task 0: Verify SDK Support for Web Search Tool

**Description**: Verify that the current `@anthropic-ai/sdk` version (0.71.2) supports the web search tool, and update if necessary.

**Acceptance Criteria**:
- [ ] SDK version confirmed to support `web_search_20250305` tool type
- [ ] Test API call with web search tool succeeds
- [ ] No beta headers required (web search is GA as of late 2025)

```json
{
  "task_id": "TASK-0",
  "name": "Verify SDK Web Search Support",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": [],
  "estimated_complexity": "low"
}
```

---

### Task 1: Database Schema for Research Results

**Description**: Add a new table to store research results linked to conversations. This allows research to be cached and reused across chat messages.

**Schema**:
```sql
CREATE TABLE writer_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES writer_conversations(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  research_data JSONB NOT NULL,
  -- research_data structure:
  -- {
  --   "queries": ["query1", "query2", ...],
  --   "results": [
  --     {
  --       "url": "...",
  --       "title": "...",
  --       "page_age": "...",
  --       "key_findings": "...",
  --       "cited_text": "..."
  --     }
  --   ],
  --   "summary": "...",
  --   "generated_at": "ISO timestamp"
  -- }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_research_conversation ON writer_research(conversation_id);
CREATE INDEX idx_research_keyword ON writer_research(keyword);
```

**Acceptance Criteria**:
- [ ] Migration file created
- [ ] Migration applied to Supabase
- [ ] TypeScript types added to `writer-db.ts`
- [ ] CRUD functions added: `getResearch`, `saveResearch`, `deleteResearch`

**Test Requirements**:
- [ ] Unit test: Insert research record
- [ ] Unit test: Retrieve research by conversation_id
- [ ] Unit test: Update existing research
- [ ] Edge case: Empty results array

```json
{
  "task_id": "TASK-1",
  "name": "Database Schema for Research",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-0"],
  "estimated_complexity": "low"
}
```

---

## Feature Implementation

### Task 2: Research Service Module

**Description**: Create a new service module `/src/lib/research.ts` that encapsulates all web search logic. This module will:
1. Build intelligent search queries from keyword + Habitto context
2. Call Claude API with web_search tool
3. Parse and structure results
4. Filter for recency (prefer content < 12 months old)

**File**: `/src/lib/research.ts`

**Key Functions**:
```typescript
interface ResearchResult {
  url: string
  title: string
  pageAge: string | null
  keyFindings: string
  citedText: string
}

interface ResearchBrief {
  keyword: string
  queries: string[]
  results: ResearchResult[]
  summary: string
  generatedAt: string
}

// Build search queries combining keyword with Habitto context
function buildSearchQueries(
  keyword: string,
  context: { brandVoice?: string; targetAudience?: string }
): string[]

// Execute research using Claude's web search tool
async function executeResearch(
  keyword: string,
  projectContext: ProjectContext,
  options?: { maxSearches?: number; locale?: string }
): Promise<ResearchBrief>

// Filter results by recency
function filterByRecency(
  results: ResearchResult[],
  maxAgeMonths: number
): ResearchResult[]
```

**Acceptance Criteria**:
- [ ] `buildSearchQueries` generates 3-5 semantic variations
- [ ] `executeResearch` calls Claude with web_search_20250305 tool
- [ ] Results include URLs, titles, page_age, and extracted key findings
- [ ] Japanese locale support (`user_location` set to Japan)
- [ ] Proper error handling for API failures
- [ ] Rate limiting awareness (max 5 searches per request)

**Test Requirements**:
- [ ] Unit test: `buildSearchQueries` generates expected query patterns
- [ ] Unit test: `filterByRecency` correctly filters old content
- [ ] Integration test: Full research flow with mocked API
- [ ] Edge case: API returns error
- [ ] Edge case: No results found
- [ ] Edge case: All results older than threshold

```json
{
  "task_id": "TASK-2",
  "name": "Research Service Module",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-0", "TASK-1"],
  "estimated_complexity": "high"
}
```

---

### Task 3: Research API Route

**Description**: Create a new API route `/api/writer/research` that handles research requests. This route will:
1. Accept keyword and conversation context
2. Check for cached research (< 24 hours old)
3. Execute new research if needed
4. Save results to database
5. Return structured research brief

**File**: `/src/app/api/writer/research/route.ts`

**Endpoints**:
- `POST /api/writer/research` - Execute research
  - Body: `{ conversationId, keyword, forceRefresh?: boolean }`
  - Returns: `ResearchBrief`

- `GET /api/writer/research?conversationId=xxx` - Get cached research
  - Returns: `ResearchBrief | null`

**Acceptance Criteria**:
- [ ] POST endpoint executes research and saves to DB
- [ ] GET endpoint retrieves cached research
- [ ] Cache invalidation after 24 hours
- [ ] `forceRefresh` bypasses cache
- [ ] Proper error responses (400, 404, 500)
- [ ] Request validation

**Test Requirements**:
- [ ] Integration test: POST creates new research
- [ ] Integration test: GET returns cached research
- [ ] Integration test: Cache expiry triggers new research
- [ ] Edge case: Invalid conversationId
- [ ] Edge case: Missing keyword

```json
{
  "task_id": "TASK-3",
  "name": "Research API Route",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-1", "TASK-2"],
  "estimated_complexity": "medium"
}
```

---

### Task 4: Integrate Research into Chat Context

**Description**: Modify the chat API route to include research results in the system prompt when available. Research should be formatted as a structured brief that Claude can reference when writing blog content.

**File to modify**: `/src/app/api/writer/chat/route.ts`
**File to modify**: `/src/lib/anthropic.ts`

**Changes**:
1. Add `getResearch` call in chat route
2. Extend `buildSystemPrompt` to include research brief
3. Format research as structured reference material

**Acceptance Criteria**:
- [ ] Chat route fetches research for conversation
- [ ] Research included in system prompt when available
- [ ] Research formatted with source citations
- [ ] No performance regression (parallel DB calls)

**Test Requirements**:
- [ ] Unit test: `buildSystemPrompt` with research data
- [ ] Integration test: Chat response references research
- [ ] Edge case: No research available (graceful fallback)

```json
{
  "task_id": "TASK-4",
  "name": "Integrate Research into Chat",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-2", "TASK-3"],
  "estimated_complexity": "medium"
}
```

---

### Task 5: Frontend Research UI Component

**Description**: Add a "Research" button and results panel to the Writer UI. When clicked:
1. Shows loading state
2. Calls research API
3. Displays results with expandable source cards
4. Allows user to refresh research

**File to modify**: `/src/app/writer/page.tsx`

**UI Components**:
- Research trigger button (next to keyword input)
- Research loading indicator
- Research results panel (collapsible)
- Source cards with: title, URL, date, key findings
- Refresh button

**Acceptance Criteria**:
- [ ] "Research" button appears when keyword is set
- [ ] Loading state shown during research (can take 10-30s)
- [ ] Results displayed in collapsible panel
- [ ] Each source shows title, URL (clickable), date badge, findings
- [ ] "Refresh Research" button clears cache
- [ ] Mobile-responsive design

**Test Requirements**:
- [ ] Component renders without research
- [ ] Component shows loading state
- [ ] Component displays results correctly
- [ ] Refresh button triggers new research
- [ ] Edge case: Empty results display

```json
{
  "task_id": "TASK-5",
  "name": "Frontend Research UI",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-3"],
  "estimated_complexity": "medium"
}
```

---

### Task 6: Research Quality Prompting

**Description**: Create optimized prompts for Claude to:
1. Generate diverse, semantically-rich search queries
2. Extract and summarize key findings from search results
3. Prioritize recent, authoritative sources
4. Synthesize a research brief that's useful for blog writing

**File**: `/src/lib/research-prompts.ts`

**Prompts to create**:
- Query generation prompt (keyword → search queries)
- Findings extraction prompt (search results → key points)
- Summary synthesis prompt (all findings → research brief)

**Acceptance Criteria**:
- [ ] Query prompt generates 4-5 diverse angles for any keyword
- [ ] Findings prompt extracts actionable insights
- [ ] Summary prompt creates cohesive research brief
- [ ] Prompts optimized for Japanese financial content
- [ ] Prompts include date-awareness instructions

**Test Requirements**:
- [ ] Manual testing with sample keywords
- [ ] Verify date filtering works
- [ ] Verify Japanese content handling

```json
{
  "task_id": "TASK-6",
  "name": "Research Quality Prompting",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-2"],
  "estimated_complexity": "medium"
}
```

---

### Task 7: End-to-End Testing

**Description**: Create comprehensive E2E tests for the complete research flow.

**Test Scenarios**:
1. User sets keyword → clicks Research → sees results
2. User starts chat → research is included in context
3. Research cache works (second request is faster)
4. Error handling (API failures gracefully handled)

**Acceptance Criteria**:
- [ ] E2E test for research flow
- [ ] E2E test for research + chat integration
- [ ] Performance test (research completes < 30s)
- [ ] Error scenario tests

```json
{
  "task_id": "TASK-7",
  "name": "End-to-End Testing",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-3", "TASK-4", "TASK-5", "TASK-6"],
  "estimated_complexity": "medium"
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

### Web Search Tool Implementation Details

Based on the [official Anthropic documentation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool):

**Tool Definition**:
```typescript
const webSearchTool = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 5,
  user_location: {
    type: "approximate",
    city: "Tokyo",
    region: "Tokyo",
    country: "JP",
    timezone: "Asia/Tokyo"
  }
}
```

**API Call Pattern**:
```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  messages: [{ role: "user", content: researchPrompt }],
  tools: [webSearchTool]
})
```

**Response Handling**:
- Look for `server_tool_use` blocks with `name: "web_search"`
- Extract results from `web_search_tool_result` blocks
- Handle `page_age` for recency filtering
- Preserve `encrypted_content` for multi-turn if needed

**Pricing Awareness**:
- $10 per 1,000 searches
- Limit to 5 searches per research request
- Cache results for 24 hours to minimize costs

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
- Log with `console.error` for errors, `console.warn` for warnings
- Return structured error responses from API routes
- Include error recovery paths (e.g., fallback to cached data)

### Code Quality Standards
- Follow existing codebase patterns (check `/src/lib/neuronwriter.ts` for reference)
- Use TypeScript strict mode
- Use meaningful variable/function names
- Keep functions small and focused
- No hardcoded values - use configuration

---

## Project State (External Memory)

### Completed Tasks
<!-- Agent: Add completed task IDs here -->

### Current Task
<!-- Agent: Update with current task ID -->
TASK-0

### Blockers & Notes
<!-- Agent: Document any blockers or important discoveries -->
- Web search tool is GA (no beta headers needed)
- SDK version 0.71.2 should support web search tool
- Need to verify organization-level web search is enabled in Anthropic Console

### Test Results Log
<!-- Agent: Log test run results with timestamps -->

---

## Dependency Graph

```
TASK-0 (Verify SDK)
   │
   ├──→ TASK-1 (Database Schema)
   │       │
   │       └──→ TASK-2 (Research Service) ←── TASK-6 (Prompts)
   │               │
   │               └──→ TASK-3 (API Route)
   │                       │
   │                       ├──→ TASK-4 (Chat Integration)
   │                       │
   │                       └──→ TASK-5 (Frontend UI)
   │                               │
   │                               └──→ TASK-7 (E2E Tests)
```

**Critical Path**: TASK-0 → TASK-1 → TASK-2 → TASK-3 → TASK-5 → TASK-7

---

## Sources & References

- [Anthropic Web Search Tool Documentation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)
- [Anthropic Web Search API Announcement](https://www.anthropic.com/news/web-search-api)
- [@anthropic-ai/sdk npm package](https://www.npmjs.com/package/@anthropic-ai/sdk)
- [TechCrunch: Anthropic Web Search API](https://techcrunch.com/2025/05/07/anthropic-rolls-out-an-api-for-ai-powered-web-search/)
