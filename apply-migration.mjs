/**
 * Apply migration to Supabase
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Load .env.local
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

const migrationSQL = readFileSync('supabase/migrations/003_writer_research.sql', 'utf8')

async function applyMigration() {
  console.log('Applying migration 003_writer_research.sql...\n')

  // Split by semicolons but preserve function bodies
  const statements = migrationSQL
    .split(/;(?=\s*(?:--|CREATE|DROP|INSERT|ALTER|$))/g)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'))

  for (const statement of statements) {
    if (!statement) continue
    console.log('Running:', statement.substring(0, 60) + '...')

    const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })

    if (error) {
      // Try direct query if rpc doesn't work
      const { error: error2 } = await supabase.from('_temp').select().limit(0)
      if (error2) {
        console.error('Note: Direct SQL not available, trying alternative...')
      }
    }
  }

  // Test if table exists by trying to select from it
  const { error: testError } = await supabase
    .from('writer_research')
    .select('id')
    .limit(1)

  if (testError) {
    console.log('\nTable does not exist yet. Creating via SQL...')
    // Will need to run via Supabase dashboard
    console.log('\n⚠️  Please run the following SQL in Supabase Dashboard > SQL Editor:\n')
    console.log(migrationSQL)
  } else {
    console.log('\n✓ Table writer_research exists!')
  }
}

applyMigration()
