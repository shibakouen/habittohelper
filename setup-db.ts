import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://udolfppdjnncwtqdoaat.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkb2xmcHBkam5uY3d0cWRvYWF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTg0ODQxOSwiZXhwIjoyMDgxNDI0NDE5fQ.zx2ZirxFiKl8MY9vVIC-2CTuMdG9pZqOzWD4_wi86wY'
)

async function setupDatabase() {
  // Test connection by checking if tables exist
  const { data: batches, error: batchError } = await supabase.from('simple_batches').select('id').limit(1)

  if (batchError && batchError.code === '42P01') {
    console.log('Tables do not exist yet.')
    console.log('\nPlease run this SQL in your Supabase Dashboard SQL Editor:')
    console.log('Go to: https://supabase.com/dashboard/project/udolfppdjnncwtqdoaat/sql/new')
    console.log('\n--- COPY BELOW ---\n')
    console.log(`
-- Simple Blog Generator Schema

-- Batch jobs table
CREATE TABLE IF NOT EXISTS simple_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  use_neuronwriter BOOLEAN NOT NULL DEFAULT true,
  total_keywords INTEGER NOT NULL,
  completed_keywords INTEGER NOT NULL DEFAULT 0,
  failed_keywords INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual keyword jobs
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
);

-- Generated blogs
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
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_simple_jobs_batch_id ON simple_jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_simple_jobs_status ON simple_jobs(status);
CREATE INDEX IF NOT EXISTS idx_simple_blogs_job_id ON simple_blogs(job_id);
CREATE INDEX IF NOT EXISTS idx_simple_batches_status ON simple_batches(status);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS simple_batches_updated_at ON simple_batches;
CREATE TRIGGER simple_batches_updated_at
  BEFORE UPDATE ON simple_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
`)
    console.log('\n--- END COPY ---')
  } else if (batchError) {
    console.log('Connection error:', batchError.message)
  } else {
    console.log('✓ Tables already exist! Connection working.')
    console.log('Found batches:', batches)
  }
}

setupDatabase()
