import postgres from 'postgres'

const sql = postgres({
  host: 'aws-0-us-west-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  username: 'postgres.udolfppdjnncwtqdoaat',
  password: 'Doraemon1chome#',
  ssl: 'require'
})

await sql`
  CREATE TABLE IF NOT EXISTS simple_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    use_neuronwriter BOOLEAN NOT NULL DEFAULT true,
    total_keywords INTEGER NOT NULL,
    completed_keywords INTEGER NOT NULL DEFAULT 0,
    failed_keywords INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`
console.log('Created simple_batches')

await sql`
  CREATE TABLE IF NOT EXISTS simple_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES simple_batches(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'researching', 'analyzing', 'writing', 'completed', 'failed')),
    error TEXT,
    research_raw TEXT,
    research_analyzed TEXT,
    neuronwriter_data JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`
console.log('Created simple_jobs')

await sql`
  CREATE TABLE IF NOT EXISTS simple_blogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL UNIQUE REFERENCES simple_jobs(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    meta_description TEXT,
    word_count INTEGER,
    internal_links TEXT[] DEFAULT '{}',
    neuronwriter_score INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`
console.log('Created simple_blogs')

await sql`CREATE INDEX IF NOT EXISTS idx_simple_jobs_batch_id ON simple_jobs(batch_id)`
await sql`CREATE INDEX IF NOT EXISTS idx_simple_jobs_status ON simple_jobs(status)`
await sql`CREATE INDEX IF NOT EXISTS idx_simple_blogs_job_id ON simple_blogs(job_id)`
await sql`CREATE INDEX IF NOT EXISTS idx_simple_batches_status ON simple_batches(status)`
console.log('Created indexes')

await sql.end()
console.log('Migration complete!')
