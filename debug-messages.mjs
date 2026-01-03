import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://udolfppdjnncwtqdoaat.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkb2xmcHBkam5uY3d0cWRvYWF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTg0ODQxOSwiZXhwIjoyMDgxNDI0NDE5fQ.zx2ZirxFiKl8MY9vVIC-2CTuMdG9pZqOzWD4_wi86wY'
)

const keyword = process.argv[2] || '複利とは'

async function check() {
  console.log('=== Checking keyword:', keyword, '===\n')

  // Get conversation
  const { data: convs } = await supabase
    .from('writer_conversations')
    .select('id, keyword, title, created_at')
    .eq('keyword', keyword)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!convs || convs.length === 0) {
    console.log('No conversation found')
    return
  }

  const conv = convs[0]
  console.log('Conversation ID:', conv.id)
  console.log('Created:', conv.created_at)

  // Get messages
  const { data: msgs } = await supabase
    .from('writer_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true })

  console.log('\nMessages:', msgs?.length || 0)
  msgs?.forEach((m, i) => {
    console.log(`  ${i + 1}. [${m.role}] ${m.content.length} chars`)
  })

  // Get blogs
  const { data: blogs } = await supabase
    .from('writer_blogs')
    .select('id, keyword, title, status, score, created_at')
    .eq('keyword', keyword)

  console.log('\nBlogs in writer_blogs:', blogs?.length || 0)
  blogs?.forEach((b, i) => {
    console.log(`  ${i + 1}. "${b.title}" [${b.status}] score=${b.score}`)
  })

  // Get research
  const { data: research } = await supabase
    .from('writer_research')
    .select('keyword, created_at')
    .eq('keyword', keyword)

  console.log('\nResearch entries:', research?.length || 0)
}

check().catch(console.error)
