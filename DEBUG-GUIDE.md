# Debug Guide - Habitto Helper

## Issue: Disappearing Blog Content (2026-01-03)

### Symptom
- User clicked "Generate" for keyword "利息とは"
- NeuronWriter and Research completed successfully
- Blog started writing but then disappeared from chat
- Only the user prompt remained: `「利息とは」についてブログ記事を書いてください。`
- Clicking "Score Content" did nothing
- After page refresh, blog was gone

### Root Cause
**Frontend was silently ignoring error events from streaming API**

1. When Claude API fails, backend sends: `data: {"error": "Stream failed"}`
2. Frontend only checked for `data.text` and `data.done` events
3. Error events fell through to `catch {}` block and were ignored
4. User message was saved to DB, but assistant response failed silently

### Investigation Process

#### Step 1: Check Database
```bash
cd /Users/matteo/habittohelper
node debug-messages.mjs
```

**Result:**
```
Conversation: {
  "id": "cee5cda5-9199-407b-af25-e23e69a6c4b7",
  "keyword": "利息とは",
  "title": "「利息とは」についてブログ記事を書いてください。",
  "created_at": "2026-01-03T04:17:52.794054+00:00"
}

Messages (1 total):
1. [user] 2026-01-03T04:21:24.871719+00:00
   Content length: 24 chars
```

**Finding:** Only user message exists, no assistant response saved.

#### Step 2: Review Code Flow

**Frontend streaming parser** (`page.tsx:263-284`):
```typescript
for (const line of lines) {
  if (line.startsWith('data: ')) {
    try {
      const data = JSON.parse(line.slice(6))
      if (data.text) { ... }      // ✓ Handled
      if (data.done) { ... }      // ✓ Handled
      // ❌ data.error NOT handled!
    } catch {
      // ❌ Silent failure
    }
  }
}
```

**Backend error handling** (`route.ts:121-127`):
```typescript
} catch (error) {
  console.error('Stream error:', error)  // Logged to server
  controller.enqueue(
    encoder.encode(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`)
  )
  controller.close()
}
```

**Problem:** Backend sends error event, but frontend ignores it.

### Fix Applied

#### Frontend Changes (`page.tsx`)

**Added error event handling:**
```typescript
const data = JSON.parse(line.slice(6))

// NEW: Handle error from server
if (data.error) {
  console.error('[Stream] Server error:', data.error)
  setGenerationStatus(`Error: ${data.error}`)

  // Show error message in chat
  const errorMsg: Message = {
    id: `error-${Date.now()}`,
    role: 'assistant',
    content: `⚠️ エラーが発生しました: ${data.error}\n\nもう一度お試しください。`,
  }
  setMessages(prev => [...prev, errorMsg])
  setStreamingContent('')
  break
}
```

**Applied to:**
- `generateBlog()` function (auto-generation flow)
- `sendMessage()` function (manual chat)

#### Backend Changes (`route.ts`)

**Enhanced error logging:**
```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  const errorStack = error instanceof Error ? error.stack : ''

  console.error('=== STREAM ERROR ===')
  console.error('Conversation ID:', conversationId)
  console.error('Error:', errorMessage)
  console.error('Stack:', errorStack)
  console.error('System prompt length:', systemPrompt.length)
  console.error('Messages count:', messages.length)
  console.error('====================')

  controller.enqueue(
    encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
  )
  controller.close()
}
```

**Added context logging:**
```typescript
console.log('[Chat] === BUILDING CONTEXT ===')
console.log('[Chat] Conversation ID:', conversationId)
console.log('[Chat] Conversation keyword:', conversation.keyword)
console.log('[Chat] User message:', message)
console.log('[Chat] Files count:', files.length)
console.log('[Chat] NW Query found:', !!nwQuery)
console.log('[Chat] Research found:', !!research)
console.log('[Chat] Research results count:', research?.research_data?.results?.length || 0)
```

---

## How to Debug Future Issues

### 1. Check Database First

Use the debug script to see what's actually saved:

```bash
cd /Users/matteo/habittohelper
node debug-messages.mjs
```

This will show:
- Conversation details
- All messages and their lengths
- Preview of content

### 2. Check Browser Console

Open DevTools → Console and look for:
- `[Stream] Server error:` - Backend errors
- `[Chat] Server error:` - Chat errors
- Network tab → Filter by `/api/writer/chat` → Check response

### 3. Check Server Logs (Production)

```bash
cd /Users/matteo/habittohelper
vercel logs
```

Look for:
- `=== STREAM ERROR ===` - Streaming failures
- `[Chat] === BUILDING CONTEXT ===` - Context assembly
- Any error messages or stack traces

### 4. Check Vercel Dashboard

https://vercel.com/dashboard → habittohelper → Logs

Filter by:
- Time range
- Function: `api/writer/chat`
- Log level: Error

### 5. Test Locally

```bash
cd /Users/matteo/habittohelper
pnpm dev
```

Open http://localhost:3000/writer and try to reproduce. Check terminal for logs.

---

## Common Issues & Solutions

### Issue: "No assistant response saved"

**Symptoms:**
- User message exists in DB
- No assistant message
- Chat shows only user prompt

**Debug:**
1. Check browser console for errors
2. Check server logs for `=== STREAM ERROR ===`
3. Look for error message in chat UI (after fix)

**Common causes:**
- Anthropic API key expired/invalid
- Rate limit exceeded
- System prompt too large (>200K tokens)
- Network timeout

### Issue: "Research not loading"

**Symptoms:**
- NeuronWriter data shows up
- Research panel empty

**Debug:**
```bash
cd /Users/matteo/habittohelper
node -e "
import { createClient } from '@supabase/supabase-js'
const supabase = createClient('URL', 'KEY')
const { data } = await supabase.from('writer_research').select('*').eq('keyword', 'YOUR_KEYWORD')
console.log(data)
"
```

**Common causes:**
- Web search API rate limit
- Research failed silently
- Keyword mismatch in query

### Issue: "Score returns null"

**Symptoms:**
- Blog generated successfully
- Score button does nothing or returns null

**Debug:**
1. Check NeuronWriter API key: `echo $NEURONWRITER_API_KEY`
2. Check project ID matches: `echo $NEURONWRITER_PROJECT_ID`
3. Test API manually:
```bash
curl -X POST https://app.neuronwriter.com/api/v2/score \
  -H "Authorization: Bearer $NEURONWRITER_API_KEY" \
  -d '{"project_id": "...", "keyword": "...", "content": "..."}'
```

---

## Debug Utilities

### debug-messages.mjs
Check messages for a specific keyword:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://udolfppdjnncwtqdoaat.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function check() {
  const { data: convs } = await supabase
    .from('writer_conversations')
    .select('id, keyword, title, created_at')
    .eq('keyword', 'YOUR_KEYWORD')
    .order('created_at', { ascending: false })
    .limit(1)

  const conv = convs[0]
  const { data: msgs } = await supabase
    .from('writer_messages')
    .select('*')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true })

  console.log('Messages:', msgs.length)
  msgs.forEach((m, i) => {
    console.log(`${i+1}. [${m.role}] ${m.content.substring(0, 100)}...`)
  })
}

check()
```

### Check Environment Variables

```bash
cd /Users/matteo/habittohelper
cat .env.local
```

Verify:
- `ANTHROPIC_API_KEY` - Claude API
- `SUPABASE_SERVICE_ROLE_KEY` - Database
- `NEURONWRITER_API_KEY` - SEO scoring
- `NEURONWRITER_PROJECT_ID` - NW project

### Check Vercel Environment

```bash
vercel env ls
```

Make sure all variables are set for `production`.

---

## Monitoring Recommendations

### Add Error Tracking (Future)

1. **Sentry Integration**
   ```bash
   pnpm add @sentry/nextjs
   ```

2. **Error Boundaries** (React)
   Wrap writer page in ErrorBoundary

3. **Health Check Endpoint**
   `/api/health` → Check DB, APIs

### Key Metrics to Monitor

- **API Response Time** - Chat API should respond within 30s
- **Error Rate** - Track streaming failures
- **NeuronWriter Success Rate** - Track keyword fetch failures
- **Database Query Time** - Monitor slow queries

---

## Deployment Checklist

Before deploying fixes:

- [ ] Build passes locally: `pnpm build`
- [ ] TypeScript checks pass
- [ ] Test error scenarios manually
- [ ] Check environment variables match
- [ ] Commit with descriptive message
- [ ] Push to GitHub
- [ ] Deploy to Vercel: `vercel --prod`
- [ ] Verify deployment: `curl https://habittohelper.vercel.app/writer`
- [ ] Test in production UI

---

## Contact & Escalation

When debugging fails:

1. **Check GitHub Issues**: https://github.com/shibakouen/habittohelper/issues
2. **Review commit history** for recent changes
3. **Rollback if needed**: `vercel rollback`
4. **Anthropic API Status**: https://status.anthropic.com
5. **Supabase Status**: https://status.supabase.com

---

**Last Updated:** 2026-01-03
**Fixed By:** Claude Code (Opus 4.5)
