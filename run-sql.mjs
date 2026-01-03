/**
 * Run SQL via Supabase postgres connection
 */

import postgres from 'postgres'
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

// Extract project ref from URL
const urlMatch = env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)
const projectRef = urlMatch ? urlMatch[1] : null

if (!projectRef) {
  console.error('Could not extract project ref from URL')
  process.exit(1)
}

// Construct connection string (pooler mode for serverless)
const connectionString = `postgresql://postgres.${projectRef}:${env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`

console.log('Connecting to Supabase...')

const sql = postgres(connectionString, {
  ssl: 'require',
})

const migrationSQL = readFileSync('supabase/migrations/003_writer_research.sql', 'utf8')

async function runMigration() {
  try {
    console.log('Running migration...\n')

    // Run the migration
    await sql.unsafe(migrationSQL)

    console.log('✓ Migration completed!')

    // Verify table exists
    const result = await sql`SELECT COUNT(*) FROM writer_research`
    console.log('Table verified, row count:', result[0].count)

  } catch (error) {
    console.error('Error:', error.message)

    // If connection failed, show manual instructions
    if (error.message.includes('connection') || error.message.includes('password')) {
      console.log('\n⚠️  Could not connect directly. Please run the SQL manually:')
      console.log('1. Go to https://supabase.com/dashboard/project/' + projectRef + '/sql/new')
      console.log('2. Paste the following SQL and run it:\n')
      console.log(migrationSQL)
    }
  } finally {
    await sql.end()
  }
}

runMigration()
