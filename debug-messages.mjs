import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://udolfppdjnncwtqdoaat.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkb2xmcHBkam5uY3d0cWRvYWF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTg0ODQxOSwiZXhwIjoyMDgxNDI0NDE5fQ.zx2ZirxFiKl8MY9vVIC-2CTuMdG9pZqOzWD4_wi86wY'
)

async function check() {
  const { data: convs } = await supabase
    .from('writer_conversations')
    .select('id, keyword, title, created_at')
    .eq('keyword', '利息とは')
    .order('created_at', { ascending: false })
    .limit(1)

  if (!convs || convs.length === 0) {
    console.log('No conversation found for 利息とは')
    return
  }

  const conv = convs[0]
  console.log('Conversation:', JSON.stringify(conv, null, 2))

  const { data: msgs } = await supabase
    .from('writer_messages')
    .select('id, role, created_at, content')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true })

  console.log('\nMessages (' + (msgs?.length || 0) + ' total):')
  msgs?.forEach((m, i) => {
    console.log((i + 1) + '. [' + m.role + '] ' + m.created_at)
    console.log('   Content length: ' + m.content.length + ' chars')
    console.log('   Preview: ' + m.content.substring(0, 100) + '...')
  })
}

check().catch(console.error)
