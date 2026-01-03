# PRD: Habitto Writer v2
## Claude Project-Style Interface with NeuronWriter Integration

**Version:** 1.0
**Date:** January 2, 2026
**Status:** Draft

---

## 1. Executive Summary

Habitto Writer v2 replaces the complex batch processing pipeline with a simple, conversational interface modeled after Claude Projects. Users chat with Claude to generate SEO-optimized Japanese blog content, with NeuronWriter integration for keyword research and content scoring.

**Key Insight:** The previous pipeline was over-engineered. Users just want to chat with Claude, provide context, and get scored content back.

---

## 2. Problem Statement

### Current Pain Points
- Batch processing pipeline is complex and fragile
- OpenRouter introduces latency, cost, and timeout issues
- Too many moving parts: Edge Functions, batch jobs, polling, status tracking
- Difficult to iterate on content - no conversational back-and-forth
- Cost overruns from slow models timing out and retrying

### What Users Actually Want
- Chat interface like Claude Projects
- Upload brand guidelines and research as context
- Get SEO-optimized content scored by NeuronWriter
- Iterate on content through conversation
- Simple, predictable costs

---

## 3. Product Vision

A chat-based blog writing tool that:
1. Feels like using Claude Projects
2. Has NeuronWriter baked in for SEO keywords and scoring
3. Uses Claude directly (not via OpenRouter) for reliability
4. Costs ~$0.50/article instead of $5+

---

## 4. User Stories

### Primary User: Marketing Manager (Matteo)

**US1: Project Setup**
> As a user, I want to create a "project" with my brand guidelines and context files pre-loaded, so Claude always knows how to write for Habitto.

**US2: Keyword Research**
> As a user, I want to fetch NeuronWriter keywords/recommendations for a topic before writing, so I know what SEO terms to target.

**US3: Content Generation**
> As a user, I want to chat with Claude to generate blog content, iterating until I'm happy with the output.

**US4: Content Scoring**
> As a user, I want to send my content to NeuronWriter for scoring, so I know how SEO-optimized it is.

**US5: Iteration**
> As a user, I want to ask Claude to improve specific sections based on NeuronWriter feedback, then re-score.

---

## 5. Features

### 5.1 Project System

| Feature | Description |
|---------|-------------|
| **Create Project** | Name, description, default settings |
| **Project Instructions** | Custom system prompt (Habitto brand voice) |
| **Context Files** | Upload .txt, .md, .csv, .pdf files as persistent context |
| **File Management** | Add, remove, view uploaded files |

**Pre-loaded for Habitto:**
- `habitto-brand-voice-guidelines.md` (727 lines)
- Any additional research/context files

### 5.2 Chat Interface

| Feature | Description |
|---------|-------------|
| **Conversation History** | Persisted per-project conversations |
| **Streaming Responses** | Real-time token streaming from Claude |
| **Message Threading** | Clear back-and-forth structure |
| **Copy/Export** | Copy content or export as Markdown |

### 5.3 NeuronWriter Integration

| Feature | Description |
|---------|-------------|
| **Fetch Keywords** | Pull NeuronWriter query data for a keyword |
| **Display Keywords** | Show recommended terms, competitor analysis |
| **Score Content** | Send content to NeuronWriter, display score |
| **Score History** | Track scores over iterations |

**NeuronWriter API Endpoints Used:**
- `POST /new-query` - Create keyword analysis
- `GET /get-query` - Fetch recommendations
- `POST /import-content` - Score content

### 5.4 Claude Integration

| Feature | Description |
|---------|-------------|
| **Direct API** | Use Anthropic API directly (not OpenRouter) |
| **Model** | Claude Sonnet 4.5 (claude-sonnet-4-5-20241022) |
| **Streaming** | Server-sent events for real-time responses |
| **Context Window** | Combine project files + conversation history |

---

## 6. Technical Architecture

### 6.1 Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | Next.js 14 (App Router) |
| **Hosting** | Vercel |
| **Database** | Supabase Postgres |
| **Auth** | Supabase Auth |
| **File Storage** | Supabase Storage |
| **LLM** | Anthropic API (Claude Sonnet 4.5) |
| **SEO** | NeuronWriter API |

### 6.2 Database Schema

```sql
-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT, -- Custom instructions
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Project files (context)
CREATE TABLE project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL, -- File content (text)
  file_type TEXT, -- md, txt, csv, pdf
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user' | 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- NeuronWriter queries (cached)
CREATE TABLE neuronwriter_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  keyword TEXT NOT NULL,
  query_id TEXT NOT NULL, -- NeuronWriter query ID
  data JSONB, -- Cached recommendations
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Content scores
CREATE TABLE content_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  content_hash TEXT, -- To track which version
  score INTEGER,
  details JSONB, -- NeuronWriter response
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 6.3 API Routes

```
/api/projects
  GET    - List projects
  POST   - Create project

/api/projects/[id]
  GET    - Get project details
  PATCH  - Update project
  DELETE - Delete project

/api/projects/[id]/files
  GET    - List files
  POST   - Upload file

/api/projects/[id]/files/[fileId]
  DELETE - Remove file

/api/projects/[id]/conversations
  GET    - List conversations
  POST   - Create conversation

/api/conversations/[id]
  GET    - Get conversation with messages

/api/conversations/[id]/messages
  POST   - Send message (streaming response)

/api/neuronwriter/query
  POST   - Create/fetch keyword analysis

/api/neuronwriter/score
  POST   - Score content
```

### 6.4 Chat Flow

```
User sends message
    ↓
API route receives message
    ↓
Build context:
  1. Project system prompt
  2. Project files (concatenated)
  3. NeuronWriter data (if fetched)
  4. Conversation history
    ↓
Call Anthropic API (streaming)
    ↓
Stream tokens to frontend via SSE
    ↓
Save complete message to database
    ↓
Display in chat UI
```

### 6.5 NeuronWriter Flow

```
User clicks "Fetch Keywords" for topic
    ↓
POST /api/neuronwriter/query
    ↓
Check cache (neuronwriter_queries table)
    ↓
If not cached:
  1. POST /new-query to NeuronWriter
  2. Poll /get-query until ready
  3. Cache results
    ↓
Display keywords/recommendations in sidebar
    ↓
User writes content via chat
    ↓
User clicks "Score Content"
    ↓
POST /api/neuronwriter/score
    ↓
POST /import-content to NeuronWriter
    ↓
Display score in UI
    ↓
User iterates via chat, re-scores
```

---

## 7. UI/UX Design

### 7.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Logo   │ Project: Habitto Blog  │  [Settings] [New Chat]  │
├─────────┼───────────────────────────────────────────────────┤
│         │                                                   │
│ SIDEBAR │                    CHAT AREA                      │
│         │                                                   │
│ Context │  ┌─────────────────────────────────────────────┐  │
│ Files   │  │ User: Write a blog about 20代の貯金方法     │  │
│ ─────── │  └─────────────────────────────────────────────┘  │
│ habitto │                                                   │
│ brand.. │  ┌─────────────────────────────────────────────┐  │
│ ─────── │  │ Claude: [streaming response...]             │  │
│         │  │                                             │  │
│ Keywords│  │ ## 20代の貯金方法完全ガイド                  │  │
│ ─────── │  │ ...                                         │  │
│ [Fetch] │  └─────────────────────────────────────────────┘  │
│         │                                                   │
│ Score   │  ┌─────────────────────────────────────────────┐  │
│ ─────── │  │ [Copy] [Score Content] [Export]             │  │
│ 65/100  │  └─────────────────────────────────────────────┘  │
│ [Score] │                                                   │
│         │  ┌─────────────────────────────────────────────┐  │
│         │  │ Type your message...              [Send]    │  │
│         │  └─────────────────────────────────────────────┘  │
└─────────┴───────────────────────────────────────────────────┘
```

### 7.2 Key Screens

1. **Project List** - Grid of projects, create new
2. **Project Settings** - Name, instructions, manage files
3. **Chat View** - Main interface (see layout above)
4. **Keyword Panel** - Expandable sidebar with NeuronWriter data
5. **Score Modal** - Detailed breakdown from NeuronWriter

---

## 8. Cost Analysis

### Previous Pipeline (OpenRouter)
- Claude Sonnet 4.5 via OpenRouter: ~$3-6/article
- Timeout retries: Additional $2-5
- **Total: $5-11/article**

### New Direct API
- Claude Sonnet 4.5 direct: ~$0.30-0.50/article
- No timeout issues (streaming)
- **Total: ~$0.40/article**

### Monthly Projection (50 articles)
- Old: $250-550
- New: ~$20-25
- **Savings: 90%+**

---

## 9. Implementation Phases

### Phase 1: Core Chat (Week 1)
- [ ] Database schema setup
- [ ] Project CRUD
- [ ] Basic chat UI
- [ ] Anthropic API integration (streaming)
- [ ] Message persistence

### Phase 2: Context System (Week 2)
- [ ] File upload to Supabase Storage
- [ ] File content extraction (PDF, etc.)
- [ ] Context injection into Claude calls
- [ ] Pre-load Habitto guidelines

### Phase 3: NeuronWriter Integration (Week 3)
- [ ] Keyword fetch API
- [ ] Keyword display in sidebar
- [ ] Content scoring API
- [ ] Score display and history

### Phase 4: Polish (Week 4)
- [ ] Export functionality
- [ ] Conversation management
- [ ] Mobile responsive
- [ ] Error handling

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| Time to generate article | < 5 minutes (was 15+) |
| Cost per article | < $0.50 (was $5+) |
| NeuronWriter score | 60+ average |
| User satisfaction | Can iterate easily |

---

## 11. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Claude API rate limits | Implement retry with backoff |
| NeuronWriter API instability | Cache aggressively, fallback gracefully |
| Large context window | Chunk files, summarize if needed |
| Cost creep | Monitor usage, set alerts |

---

## 12. Open Questions

1. **Multi-user support?** - Currently single-user (Matteo). Add auth later?
2. **Conversation branching?** - Keep it simple (linear) for v1
3. **Template system?** - Pre-built prompts for common article types?
4. **WordPress integration?** - Direct publish to Habitto blog?

---

## 13. Appendix

### A. NeuronWriter API Reference

**Base URL:** `https://app.neuronwriter.com/neuron-api/0.5/writer`

**Headers:**
```
X-API-KEY: [your-api-key]
Content-Type: application/json
```

**Endpoints:**
- `POST /new-query` - Create keyword analysis
- `GET /get-query?query=[id]` - Fetch recommendations
- `POST /import-content` - Score content

### B. Anthropic API Reference

**Streaming Messages:**
```typescript
const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4-5-20241022',
  max_tokens: 8192,
  system: projectSystemPrompt + '\n\n' + contextFiles,
  messages: conversationHistory,
});

for await (const chunk of stream) {
  // Send to client via SSE
}
```

### C. Existing Assets

- Brand guidelines: `/habitto-brand-voice-guidelines.md`
- NeuronWriter project ID: `f7ca0f7ccd27f28e`
- Supabase project: `udolfppdjnncwtqdoaat`

---

**Document History:**
- 2026-01-02: Initial draft
