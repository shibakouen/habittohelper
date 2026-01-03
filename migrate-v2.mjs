import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const supabaseUrl = 'https://udolfppdjnncwtqdoaat.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkb2xmcHBkam5uY3d0cWRvYWF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTg0ODQxOSwiZXhwIjoyMDgxNDI0NDE5fQ.zx2ZirxFiKl8MY9vVIC-2CTuMdG9pZqOzWD4_wi86wY'
const supabase = createClient(supabaseUrl, supabaseKey)

console.log('Setting up Writer v2...')

const systemPrompt = `あなたはHabittoのコンテンツライターです。以下のガイドラインに従って日本語コンテンツを作成してください：

【トーン】
- 親しみやすく、でも軽すぎない
- 金融初心者に寄り添う
- 押し売りしない、安心感を与える
- 前向きで可能性を示す

【文体】
- です・ます調（敬体）
- 短い文と中程度の文を組み合わせる
- 専門用語は平易に言い換える

【キーフレーズ】
- 「お金を育てる」（資産運用の代わりに）
- 「ムリなく」「コツコツ」「おトク」（カタカナで柔らかく）
- 「寄り添う」「一緒に考える」（パートナーシップ）

【避けること】
- 押し売り表現（今すぐ！限定！）
- 恐怖訴求（老後破綻！手遅れ！）
- 堅すぎる敬語（ございます、賜る）
- 専門用語の多用
- 上から目線の説教調

【ターゲット】
- 20〜40代の若い世代
- 金融初心者、投資未経験者
- 貯蓄を始めたい・増やしたい人`

// Check if tables exist by trying to query them
async function checkTables() {
  const { error } = await supabase.from('writer_projects').select('id').limit(1)
  return !error
}

// Seed default data
async function seedData() {
  // Check if Habitto project exists
  const { data: existing } = await supabase
    .from('writer_projects')
    .select('id')
    .eq('name', 'Habitto Blog')
    .single()

  let projectId = existing?.id

  if (!projectId) {
    // Create default project
    const { data: project, error: projectError } = await supabase
      .from('writer_projects')
      .insert({
        name: 'Habitto Blog',
        description: 'Habitto brand blog content generation',
        system_prompt: systemPrompt
      })
      .select()
      .single()

    if (projectError) {
      console.error('Failed to create project:', projectError)
      return
    }
    projectId = project.id
    console.log('Created Habitto project:', projectId)
  } else {
    console.log('Habitto project exists:', projectId)
  }

  // Check if brand guidelines file exists
  const { data: existingFile } = await supabase
    .from('writer_files')
    .select('id')
    .eq('project_id', projectId)
    .eq('name', 'habitto-brand-voice-guidelines.md')
    .single()

  if (!existingFile) {
    // Load and add brand guidelines
    try {
      const brandGuidelines = readFileSync('/Users/matteo/firecrawl/habitto-brand-voice-guidelines.md', 'utf-8')
      const { error: fileError } = await supabase
        .from('writer_files')
        .insert({
          project_id: projectId,
          name: 'habitto-brand-voice-guidelines.md',
          content: brandGuidelines,
          file_type: 'md',
          token_count: Math.ceil(brandGuidelines.length / 4)
        })

      if (fileError) {
        console.error('Failed to add brand guidelines:', fileError)
      } else {
        console.log('Added brand guidelines file')
      }
    } catch (e) {
      console.log('Could not load brand guidelines:', e.message)
    }
  } else {
    console.log('Brand guidelines file exists')
  }
}

// Main
const tablesExist = await checkTables()

if (!tablesExist) {
  console.log('\n===========================================')
  console.log('Tables do not exist. Please run this SQL in Supabase Dashboard:')
  console.log('===========================================\n')
  console.log(readFileSync('./supabase/migrations/002_writer_v2.sql', 'utf-8'))
  console.log('\n===========================================')
  console.log('After running the SQL, run this script again.')
  console.log('===========================================')
  process.exit(1)
}

await seedData()
console.log('Setup complete!')
