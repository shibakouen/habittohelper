import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Parse .env.local manually
const envFile = readFileSync('.env.local', 'utf8')
const env = {}
for (const line of envFile.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    env[match[1]] = match[2]
  }
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

async function clearCache() {
  console.log('Deleting bad NeuronWriter cache for "20代 貯金"...')

  const { error } = await supabase
    .from('writer_nw_queries')
    .delete()
    .eq('keyword', '20代 貯金')

  if (error) {
    console.error('Error:', error)
  } else {
    console.log('✓ Cache cleared successfully')
  }
}

clearCache()
