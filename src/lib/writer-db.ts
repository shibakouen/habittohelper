/**
 * Writer v2 Database Operations
 */

import { supabase } from './supabase'

// ============================================================================
// TYPES
// ============================================================================

export interface Project {
  id: string
  name: string
  description: string | null
  system_prompt: string | null
  created_at: string
  updated_at: string
}

export interface ProjectFile {
  id: string
  project_id: string
  name: string
  content: string
  file_type: string
  token_count: number | null
  created_at: string
}

export interface Conversation {
  id: string
  project_id: string
  title: string
  keyword: string | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface NWQuery {
  id: string
  project_id: string
  keyword: string
  query_id: string
  data: {
    recommendedTerms: string[]
    competitorHeadings: string[]
    wordCountTarget: number
    topKeywords: Array<{ term: string; weight: number }>
  } | null
  created_at: string
}

export interface Score {
  id: string
  conversation_id: string
  content_preview: string | null
  score: number | null
  details: Record<string, unknown> | null
  created_at: string
}

export interface ResearchResult {
  url: string
  title: string
  pageAge: string | null
  keyFindings: string
  citedText: string
}

export interface ResearchData {
  queries: string[]
  results: ResearchResult[]
  summary: string
  generatedAt: string
}

export interface Research {
  id: string
  conversation_id: string
  keyword: string
  research_data: ResearchData
  created_at: string
  updated_at: string
}

export interface Blog {
  id: string
  conversation_id: string | null
  keyword: string
  title: string
  meta_description: string | null
  target_service: 'savings' | 'card' | 'advisor' | null
  content: string
  score: number | null
  status: 'draft' | 'review' | 'approved' | 'published'
  published_url: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// PROJECTS
// ============================================================================

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('writer_projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to get projects: ${error.message}`)
  return (data || []) as Project[]
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('writer_projects')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as Project
}

export async function createProject(
  name: string,
  description?: string,
  systemPrompt?: string
): Promise<Project> {
  const { data, error } = await supabase
    .from('writer_projects')
    .insert({ name, description, system_prompt: systemPrompt })
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to create project: ${error?.message}`)
  return data as Project
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, 'name' | 'description' | 'system_prompt'>>
): Promise<Project> {
  const { data, error } = await supabase
    .from('writer_projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to update project: ${error?.message}`)
  return data as Project
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('writer_projects')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to delete project: ${error.message}`)
}

// ============================================================================
// FILES
// ============================================================================

export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const { data, error } = await supabase
    .from('writer_files')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to get files: ${error.message}`)
  return (data || []) as ProjectFile[]
}

export async function addProjectFile(
  projectId: string,
  name: string,
  content: string,
  fileType: string = 'md'
): Promise<ProjectFile> {
  const tokenCount = Math.ceil(content.length / 4) // Rough estimate

  const { data, error } = await supabase
    .from('writer_files')
    .insert({
      project_id: projectId,
      name,
      content,
      file_type: fileType,
      token_count: tokenCount,
    })
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to add file: ${error?.message}`)
  return data as ProjectFile
}

export async function deleteProjectFile(fileId: string): Promise<void> {
  const { error } = await supabase
    .from('writer_files')
    .delete()
    .eq('id', fileId)

  if (error) throw new Error(`Failed to delete file: ${error.message}`)
}

// ============================================================================
// CONVERSATIONS
// ============================================================================

export async function getConversations(projectId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('writer_conversations')
    .select('*')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`Failed to get conversations: ${error.message}`)
  return (data || []) as Conversation[]
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('writer_conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as Conversation
}

export async function createConversation(
  projectId: string,
  title?: string,
  keyword?: string
): Promise<Conversation> {
  const { data, error } = await supabase
    .from('writer_conversations')
    .insert({
      project_id: projectId,
      title: title || 'New Conversation',
      keyword,
    })
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to create conversation: ${error?.message}`)
  return data as Conversation
}

export async function updateConversation(
  id: string,
  updates: Partial<Pick<Conversation, 'title' | 'keyword'>>
): Promise<void> {
  const { error } = await supabase
    .from('writer_conversations')
    .update(updates)
    .eq('id', id)

  if (error) throw new Error(`Failed to update conversation: ${error.message}`)
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase
    .from('writer_conversations')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to delete conversation: ${error.message}`)
}

// ============================================================================
// MESSAGES
// ============================================================================

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('writer_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to get messages: ${error.message}`)
  return (data || []) as Message[]
}

export async function addMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<Message> {
  const { data, error } = await supabase
    .from('writer_messages')
    .insert({ conversation_id: conversationId, role, content })
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to add message: ${error?.message}`)
  return data as Message
}

// ============================================================================
// NEURONWRITER CACHE
// ============================================================================

export async function getCachedNWQuery(
  projectId: string,
  keyword: string
): Promise<NWQuery | null> {
  const { data, error } = await supabase
    .from('writer_nw_queries')
    .select('*')
    .eq('project_id', projectId)
    .eq('keyword', keyword)
    .single()

  if (error) return null
  return data as NWQuery
}

export async function cacheNWQuery(
  projectId: string,
  keyword: string,
  queryId: string,
  data: NWQuery['data']
): Promise<NWQuery> {
  const { data: result, error } = await supabase
    .from('writer_nw_queries')
    .upsert({
      project_id: projectId,
      keyword,
      query_id: queryId,
      data,
    })
    .select()
    .single()

  if (error || !result) throw new Error(`Failed to cache NW query: ${error?.message}`)
  return result as NWQuery
}

// ============================================================================
// SCORES
// ============================================================================

export async function getScores(conversationId: string): Promise<Score[]> {
  const { data, error } = await supabase
    .from('writer_scores')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to get scores: ${error.message}`)
  return (data || []) as Score[]
}

export async function addScore(
  conversationId: string,
  contentPreview: string,
  score: number,
  details: Record<string, unknown>
): Promise<Score> {
  const { data, error } = await supabase
    .from('writer_scores')
    .insert({
      conversation_id: conversationId,
      content_preview: contentPreview.slice(0, 200),
      score,
      details,
    })
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to add score: ${error?.message}`)
  return data as Score
}

// ============================================================================
// RESEARCH
// ============================================================================

export async function getResearch(conversationId: string): Promise<Research | null> {
  const { data, error } = await supabase
    .from('writer_research')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data as Research
}

export async function getResearchByKeyword(
  conversationId: string,
  keyword: string
): Promise<Research | null> {
  const { data, error } = await supabase
    .from('writer_research')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('keyword', keyword)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data as Research
}

export async function saveResearch(
  conversationId: string,
  keyword: string,
  researchData: ResearchData
): Promise<Research> {
  const { data, error } = await supabase
    .from('writer_research')
    .insert({
      conversation_id: conversationId,
      keyword,
      research_data: researchData,
    })
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to save research: ${error?.message}`)
  return data as Research
}

export async function updateResearch(
  researchId: string,
  researchData: ResearchData
): Promise<Research> {
  const { data, error } = await supabase
    .from('writer_research')
    .update({ research_data: researchData })
    .eq('id', researchId)
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to update research: ${error?.message}`)
  return data as Research
}

export async function deleteResearch(researchId: string): Promise<void> {
  const { error } = await supabase
    .from('writer_research')
    .delete()
    .eq('id', researchId)

  if (error) throw new Error(`Failed to delete research: ${error.message}`)
}

/**
 * Check if research is stale (older than specified hours)
 */
export function isResearchStale(research: Research, maxAgeHours: number = 24): boolean {
  const createdAt = new Date(research.created_at)
  const now = new Date()
  const ageHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
  return ageHours > maxAgeHours
}

// ============================================================================
// BLOGS
// ============================================================================

export async function getBlogs(): Promise<Blog[]> {
  const { data, error } = await supabase
    .from('writer_blogs')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to get blogs: ${error.message}`)
  return (data || []) as Blog[]
}

export async function getBlog(id: string): Promise<Blog | null> {
  const { data, error } = await supabase
    .from('writer_blogs')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as Blog
}

export async function getBlogByConversation(conversationId: string): Promise<Blog | null> {
  const { data, error } = await supabase
    .from('writer_blogs')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data as Blog
}

export async function createBlog(blog: {
  conversation_id?: string
  keyword: string
  title: string
  meta_description?: string
  target_service?: 'savings' | 'card' | 'advisor'
  content: string
  score?: number
  status?: 'draft' | 'review' | 'approved' | 'published'
}): Promise<Blog> {
  const { data, error } = await supabase
    .from('writer_blogs')
    .insert({
      conversation_id: blog.conversation_id || null,
      keyword: blog.keyword,
      title: blog.title,
      meta_description: blog.meta_description || null,
      target_service: blog.target_service || null,
      content: blog.content,
      score: blog.score || null,
      status: blog.status || 'draft',
    })
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to create blog: ${error?.message}`)
  return data as Blog
}

export async function updateBlog(
  id: string,
  updates: Partial<Pick<Blog, 'title' | 'meta_description' | 'target_service' | 'content' | 'score' | 'status' | 'published_url'>>
): Promise<Blog> {
  const { data, error } = await supabase
    .from('writer_blogs')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to update blog: ${error?.message}`)
  return data as Blog
}

export async function deleteBlog(id: string): Promise<void> {
  const { error } = await supabase
    .from('writer_blogs')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to delete blog: ${error.message}`)
}

/**
 * Parse blog frontmatter from markdown content
 */
export function parseBlogFrontmatter(content: string): {
  title: string
  meta_description: string | null
  target_service: 'savings' | 'card' | 'advisor' | null
  body: string
} {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)

  if (!frontmatterMatch) {
    // Try to extract title from first H1
    const h1Match = content.match(/^#\s+(.+)$/m)
    return {
      title: h1Match?.[1] || 'Untitled',
      meta_description: null,
      target_service: null,
      body: content,
    }
  }

  const [, frontmatter, body] = frontmatterMatch

  const titleMatch = frontmatter.match(/title:\s*(.+)/)
  const descMatch = frontmatter.match(/description:\s*(.+)/)
  const serviceMatch = frontmatter.match(/target_service:\s*(.+)/)

  let target_service: 'savings' | 'card' | 'advisor' | null = null
  if (serviceMatch) {
    const service = serviceMatch[1].trim().toLowerCase()
    if (service.includes('貯蓄') || service.includes('savings') || service.includes('account')) {
      target_service = 'savings'
    } else if (service.includes('カード') || service.includes('card') || service.includes('debit')) {
      target_service = 'card'
    } else if (service.includes('アドバイザー') || service.includes('advisor')) {
      target_service = 'advisor'
    }
  }

  return {
    title: titleMatch?.[1]?.trim() || 'Untitled',
    meta_description: descMatch?.[1]?.trim() || null,
    target_service,
    body: body.trim(),
  }
}

// ============================================================================
// BLOGS
// ============================================================================

/**
 * Save or update a blog entry from generated content
 */
export async function saveBlogFromContent(
  conversationId: string,
  keyword: string,
  content: string,
  score?: number | null
): Promise<Blog | null> {
  // Check if blog already exists for this conversation
  const { data: existing } = await supabase
    .from('writer_blogs')
    .select('id')
    .eq('conversation_id', conversationId)
    .single()

  // Parse the blog content
  const parsed = parseBlogFrontmatter(content)

  if (existing) {
    // Update existing blog
    const { data, error } = await supabase
      .from('writer_blogs')
      .update({
        keyword,
        title: parsed.title,
        meta_description: parsed.meta_description,
        target_service: parsed.target_service,
        content,
        score: score ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      console.error('[saveBlogFromContent] Update error:', error)
      return null
    }
    console.log('[saveBlogFromContent] Updated blog:', data.id)
    return data as Blog
  } else {
    // Insert new blog
    const { data, error } = await supabase
      .from('writer_blogs')
      .insert({
        conversation_id: conversationId,
        keyword,
        title: parsed.title,
        meta_description: parsed.meta_description,
        target_service: parsed.target_service,
        content,
        score: score ?? null,
        status: 'draft',
      })
      .select()
      .single()

    if (error) {
      console.error('[saveBlogFromContent] Insert error:', error)
      return null
    }
    console.log('[saveBlogFromContent] Created blog:', data.id)
    return data as Blog
  }
}

