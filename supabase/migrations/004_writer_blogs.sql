-- Writer Blogs Table
-- Stores finalized blog content with structured metadata

CREATE TABLE IF NOT EXISTS writer_blogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES writer_conversations(id) ON DELETE SET NULL,
  keyword TEXT NOT NULL,
  title TEXT NOT NULL,
  meta_description TEXT,
  target_service TEXT CHECK (target_service IN ('savings', 'card', 'advisor', NULL)),
  content TEXT NOT NULL, -- Full markdown content
  score INTEGER, -- NeuronWriter SEO score (0-100)
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published')),
  published_url TEXT, -- URL if published to CMS
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_writer_blogs_keyword ON writer_blogs(keyword);
CREATE INDEX IF NOT EXISTS idx_writer_blogs_status ON writer_blogs(status);
CREATE INDEX IF NOT EXISTS idx_writer_blogs_conversation ON writer_blogs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_writer_blogs_created ON writer_blogs(created_at DESC);

-- Update timestamp trigger
DROP TRIGGER IF EXISTS update_writer_blogs_updated_at ON writer_blogs;
CREATE TRIGGER update_writer_blogs_updated_at
    BEFORE UPDATE ON writer_blogs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
