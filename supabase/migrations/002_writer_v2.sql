-- Habitto Writer v2 Schema
-- Claude Project-style chat interface with NeuronWriter integration

-- Projects table
CREATE TABLE IF NOT EXISTS writer_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT, -- Custom instructions (Habitto brand voice)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Project files (context documents)
CREATE TABLE IF NOT EXISTS writer_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES writer_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  file_type TEXT DEFAULT 'md', -- md, txt, csv
  token_count INTEGER, -- Approximate tokens for context management
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Conversations
CREATE TABLE IF NOT EXISTS writer_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES writer_projects(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'New Conversation',
  keyword TEXT, -- Target SEO keyword if set
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Messages
CREATE TABLE IF NOT EXISTS writer_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES writer_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- NeuronWriter queries (cached keyword analysis)
CREATE TABLE IF NOT EXISTS writer_nw_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES writer_projects(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  query_id TEXT NOT NULL, -- NeuronWriter internal ID
  data JSONB, -- Cached recommendations (terms, headings, etc)
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, keyword)
);

-- Content scores history
CREATE TABLE IF NOT EXISTS writer_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES writer_conversations(id) ON DELETE CASCADE,
  content_preview TEXT, -- First 200 chars for reference
  score INTEGER,
  details JSONB, -- Full NeuronWriter response
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_writer_files_project ON writer_files(project_id);
CREATE INDEX IF NOT EXISTS idx_writer_conversations_project ON writer_conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_writer_messages_conversation ON writer_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_writer_nw_queries_project_keyword ON writer_nw_queries(project_id, keyword);
CREATE INDEX IF NOT EXISTS idx_writer_scores_conversation ON writer_scores(conversation_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to projects and conversations
DROP TRIGGER IF EXISTS update_writer_projects_updated_at ON writer_projects;
CREATE TRIGGER update_writer_projects_updated_at
    BEFORE UPDATE ON writer_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_writer_conversations_updated_at ON writer_conversations;
CREATE TRIGGER update_writer_conversations_updated_at
    BEFORE UPDATE ON writer_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default Habitto project
INSERT INTO writer_projects (name, description, system_prompt) VALUES (
  'Habitto Blog',
  'Habitto brand blog content generation',
  E'あなたはHabittoのコンテンツライターです。以下のガイドラインに従って日本語コンテンツを作成してください：\n\n【トーン】\n- 親しみやすく、でも軽すぎない\n- 金融初心者に寄り添う\n- 押し売りしない、安心感を与える\n- 前向きで可能性を示す\n\n【文体】\n- です・ます調（敬体）\n- 短い文と中程度の文を組み合わせる\n- 専門用語は平易に言い換える\n\n【キーフレーズ】\n- 「お金を育てる」（資産運用の代わりに）\n- 「ムリなく」「コツコツ」「おトク」（カタカナで柔らかく）\n- 「寄り添う」「一緒に考える」（パートナーシップ）\n\n【避けること】\n- 押し売り表現（今すぐ！限定！）\n- 恐怖訴求（老後破綻！手遅れ！）\n- 堅すぎる敬語（ございます、賜る）\n- 専門用語の多用\n- 上から目線の説教調\n\n【ターゲット】\n- 20〜40代の若い世代\n- 金融初心者、投資未経験者\n- 貯蓄を始めたい・増やしたい人'
) ON CONFLICT DO NOTHING;
