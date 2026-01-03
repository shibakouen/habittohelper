-- Habitto Writer v2: Deep Research Feature
-- Stores web research results for blog content generation

-- Research results table
CREATE TABLE IF NOT EXISTS writer_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES writer_conversations(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  research_data JSONB NOT NULL,
  -- research_data structure:
  -- {
  --   "queries": ["query1", "query2", ...],
  --   "results": [
  --     {
  --       "url": "...",
  --       "title": "...",
  --       "pageAge": "...",
  --       "keyFindings": "...",
  --       "citedText": "..."
  --     }
  --   ],
  --   "summary": "...",
  --   "generatedAt": "ISO timestamp"
  -- }
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_writer_research_conversation ON writer_research(conversation_id);
CREATE INDEX IF NOT EXISTS idx_writer_research_keyword ON writer_research(keyword);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS update_writer_research_updated_at ON writer_research;
CREATE TRIGGER update_writer_research_updated_at
    BEFORE UPDATE ON writer_research
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
