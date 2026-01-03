'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

// Types
interface Project {
  id: string
  name: string
  description: string | null
  system_prompt: string | null
}

interface Conversation {
  id: string
  title: string
  keyword: string | null
  updated_at: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface NWData {
  recommendedTerms: string[]
  topKeywords: Array<{ term: string; weight: number }>
  competitorHeadings: string[]
  wordCountTarget: number
}

interface ResearchResult {
  url: string
  title: string
  pageAge: string | null
  keyFindings: string
  citedText: string
}

interface ResearchData {
  queries: string[]
  results: ResearchResult[]
  summary: string
  generatedAt: string
}

export default function WriterPage() {
  // State
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')

  // NeuronWriter state
  const [keyword, setKeyword] = useState('')
  const [nwData, setNwData] = useState<NWData | null>(null)
  const [score, setScore] = useState<number | null>(null)
  const [scoring, setScoring] = useState(false)

  // Research state
  const [researchData, setResearchData] = useState<ResearchData | null>(null)
  const [researchExpanded, setResearchExpanded] = useState(false)

  // Generation state (combined workflow)
  const [generating, setGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState('')
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load projects on mount
  useEffect(() => {
    fetch('/api/writer/projects')
      .then(res => res.json())
      .then(data => {
        setProjects(data)
        // Auto-select first project (Habitto)
        if (data.length > 0) {
          setSelectedProject(data[0])
        }
      })
      .catch(console.error)
  }, [])

  // Load conversations when project changes
  useEffect(() => {
    if (!selectedProject) return
    fetch(`/api/writer/conversations?projectId=${selectedProject.id}`)
      .then(res => res.json())
      .then(setConversations)
      .catch(console.error)
  }, [selectedProject])

  // Load messages when conversation changes
  useEffect(() => {
    if (!selectedConversation) {
      setMessages([])
      setNwData(null)
      setScore(null)
      setResearchData(null)
      setResearchExpanded(false)
      return
    }
    fetch(`/api/writer/conversations?id=${selectedConversation.id}`)
      .then(res => res.json())
      .then(data => {
        setMessages(data.messages || [])
        if (data.keyword) {
          setKeyword(data.keyword)
          // Load cached NW data
          if (selectedProject) {
            fetch(`/api/writer/neuronwriter?projectId=${selectedProject.id}&keyword=${encodeURIComponent(data.keyword)}`)
              .then(res => res.json())
              .then(setNwData)
              .catch(console.error)
          }
          // Load cached research
          fetch(`/api/writer/research?conversationId=${selectedConversation.id}&keyword=${encodeURIComponent(data.keyword)}`)
            .then(res => res.json())
            .then(data => {
              if (data.research) {
                setResearchData(data.research)
              }
            })
            .catch(console.error)
        }
      })
      .catch(console.error)
  }, [selectedConversation, selectedProject])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Create new conversation
  const createConversation = async () => {
    if (!selectedProject) return
    const res = await fetch('/api/writer/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: selectedProject.id }),
    })
    const conv = await res.json()
    setConversations(prev => [conv, ...prev])
    setSelectedConversation(conv)
    setMessages([])
    setNwData(null)
    setScore(null)
    setKeyword('')
    setResearchData(null)
    setResearchExpanded(false)
    setAwaitingConfirm(false)
  }

  // Combined generate blog workflow: SEO + Research + Auto-write
  const generateBlog = async () => {
    if (!keyword.trim() || !selectedProject || !selectedConversation || generating) return

    setGenerating(true)
    setGenerationStatus('Setting keyword...')

    try {
      // Step 1: Set keyword on conversation
      await fetch('/api/writer/neuronwriter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setKeyword',
          projectId: selectedProject.id,
          conversationId: selectedConversation.id,
          keyword: keyword.trim(),
        }),
      })

      // Step 2: Run NW fetch and Research in parallel
      setGenerationStatus('Fetching SEO keywords & researching...')

      const [nwResult, researchResult] = await Promise.all([
        // NeuronWriter fetch
        fetch(`/api/writer/neuronwriter?projectId=${selectedProject.id}&keyword=${encodeURIComponent(keyword.trim())}`)
          .then(res => res.json())
          .catch(err => {
            console.error('NW fetch failed:', err)
            return null
          }),
        // Research fetch
        fetch('/api/writer/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: selectedConversation.id,
            keyword: keyword.trim(),
            forceRefresh: false,
          }),
        })
          .then(res => res.json())
          .catch(err => {
            console.error('Research failed:', err)
            return null
          }),
      ])

      // Update state with results
      if (nwResult) setNwData(nwResult)
      if (researchResult?.research) {
        setResearchData(researchResult.research)
        setResearchExpanded(true)
      }

      // Step 3: Auto-send message to start writing
      setGenerationStatus('Writing blog...')

      // Trigger the chat with auto-prompt
      const autoPrompt = `「${keyword.trim()}」についてブログ記事を書いてください。`

      // Set input and trigger send
      setInput('')
      setIsStreaming(true)
      setStreamingContent('')

      // Add user message to UI
      const userMsg: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: autoPrompt,
      }
      setMessages(prev => [...prev, userMsg])

      // Send to API
      const response = await fetch('/api/writer/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          message: autoPrompt,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Generate] Chat API failed:', response.status, errorText)
        throw new Error(`Chat API failed (${response.status}): ${errorText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              // Handle error from server
              if (data.error) {
                console.error('[Stream] Server error:', data.error)
                setGenerationStatus(`Error: ${data.error}`)
                // Show error message in chat
                const errorMsg: Message = {
                  id: `error-${Date.now()}`,
                  role: 'assistant',
                  content: `⚠️ エラーが発生しました: ${data.error}\n\nもう一度お試しください。`,
                }
                setMessages(prev => [...prev, errorMsg])
                setStreamingContent('')
                break
              }

              if (data.text) {
                fullContent += data.text
                setStreamingContent(fullContent)
              }
              if (data.done) {
                const assistantMsg: Message = {
                  id: `msg-${Date.now()}`,
                  role: 'assistant',
                  content: fullContent,
                }
                setMessages(prev => [...prev, assistantMsg])
                setStreamingContent('')
              }
            } catch (parseError) {
              console.warn('[Stream] Failed to parse SSE data:', line, parseError)
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Generate blog failed:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setGenerationStatus(`❌ Error: ${errorMsg}`)

      // Show error in chat
      const errorChatMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ エラーが発生しました: ${errorMsg}\n\n詳細はコンソールをご確認ください。`,
      }
      setMessages(prev => [...prev, errorChatMsg])
    } finally {
      setGenerating(false)
      setIsStreaming(false)
      // Don't clear status on error - let user see it
    }
  }

  // Score content
  const scoreContent = async () => {
    if (!messages.length || !keyword || !selectedProject) return
    setScoring(true)
    try {
      // Get last assistant message content
      const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
      if (!lastAssistant) return

      const res = await fetch('/api/writer/neuronwriter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'score',
          projectId: selectedProject.id,
          conversationId: selectedConversation?.id,
          keyword,
          content: lastAssistant.content,
        }),
      })
      const data = await res.json()
      setScore(data.score)
    } catch (error) {
      console.error('Failed to score content:', error)
    } finally {
      setScoring(false)
    }
  }

  // Send message
  const sendMessage = useCallback(async () => {
    if (!input.trim() || !selectedConversation || isStreaming) return

    const userMessage = input.trim()
    setInput('')
    setIsStreaming(true)
    setStreamingContent('')

    // Add user message to UI immediately
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
    }
    setMessages(prev => [...prev, userMsg])

    try {
      const response = await fetch('/api/writer/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          message: userMessage,
        }),
      })

      if (!response.ok) throw new Error('Chat failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              // Handle error from server
              if (data.error) {
                console.error('[Chat] Server error:', data.error)
                const errorMsg: Message = {
                  id: `error-${Date.now()}`,
                  role: 'assistant',
                  content: `⚠️ エラーが発生しました: ${data.error}\n\nもう一度お試しください。`,
                }
                setMessages(prev => [...prev, errorMsg])
                setStreamingContent('')
                break
              }

              if (data.text) {
                fullContent += data.text
                setStreamingContent(fullContent)
              }
              if (data.done) {
                // Add complete message
                const assistantMsg: Message = {
                  id: `msg-${Date.now()}`,
                  role: 'assistant',
                  content: fullContent,
                }
                setMessages(prev => [...prev, assistantMsg])
                setStreamingContent('')
              }
            } catch (parseError) {
              console.warn('[Chat] Failed to parse SSE data:', line, parseError)
            }
          }
        }
      }
    } catch (error) {
      console.error('Send message error:', error)
    } finally {
      setIsStreaming(false)
    }
  }, [input, selectedConversation, isStreaming])

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Copy last response
  const copyLastResponse = () => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
    if (lastAssistant) {
      navigator.clipboard.writeText(lastAssistant.content)
    }
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Project selector */}
        <div className="p-4 border-b border-gray-800">
          <select
            value={selectedProject?.id || ''}
            onChange={e => {
              const proj = projects.find(p => p.id === e.target.value)
              setSelectedProject(proj || null)
              setSelectedConversation(null)
            }}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <button
              onClick={createConversation}
              className="w-full px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded mb-2"
            >
              + New Chat
            </button>
          </div>
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => setSelectedConversation(conv)}
              className={`w-full text-left px-4 py-3 text-sm border-b border-gray-800 hover:bg-gray-800 ${
                selectedConversation?.id === conv.id ? 'bg-gray-800' : ''
              }`}
            >
              <div className="truncate">{conv.title}</div>
              {conv.keyword && (
                <div className="text-xs text-gray-500 mt-1">KW: {conv.keyword}</div>
              )}
            </button>
          ))}
        </div>

        {/* Blog Generation panel */}
        <div className="border-t border-gray-800 p-4">
          <div className="text-xs text-gray-500 mb-2">Blog Keyword</div>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={keyword}
              onChange={e => {
                setKeyword(e.target.value)
                setAwaitingConfirm(false) // Reset confirm when keyword changes
              }}
              placeholder="Enter keyword..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
              disabled={generating}
            />
            {!awaitingConfirm ? (
              <button
                onClick={() => setAwaitingConfirm(true)}
                disabled={generating || !keyword.trim() || !selectedConversation}
                className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 rounded disabled:opacity-50 min-w-[70px]"
                title="Generate blog with SEO + Research"
              >
                {generating ? '...' : 'Generate'}
              </button>
            ) : (
              <button
                onClick={() => {
                  setAwaitingConfirm(false)
                  generateBlog()
                }}
                disabled={generating}
                className="px-3 py-1 text-xs bg-orange-500 hover:bg-orange-600 rounded disabled:opacity-50 min-w-[70px] animate-pulse"
                title="Click to confirm and start generation"
              >
                Confirm?
              </button>
            )}
          </div>
          {/* Generation status */}
          {generationStatus && (
            <div className="text-xs text-yellow-400 mb-2 animate-pulse">
              {generationStatus}
            </div>
          )}

          {nwData && (
            <div className="text-xs space-y-2 max-h-48 overflow-y-auto">
              <div className="text-gray-400">Top keywords:</div>
              <div className="flex flex-wrap gap-1">
                {nwData.topKeywords.slice(0, 10).map((k, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-300">
                    {k.term}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Score */}
          {score !== null && (
            <div className="mt-3 p-2 bg-gray-800 rounded">
              <div className="text-xs text-gray-400">Content Score</div>
              <div className={`text-2xl font-bold ${score >= 60 ? 'text-green-400' : score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                {score}
              </div>
            </div>
          )}

          {/* Research Panel */}
          {researchData && (
            <div className="mt-3 border-t border-gray-700 pt-3">
              <button
                onClick={() => setResearchExpanded(!researchExpanded)}
                className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-gray-300"
              >
                <span>🔍 Research ({researchData.results.length} sources)</span>
                <span>{researchExpanded ? '▼' : '▶'}</span>
              </button>

              {researchExpanded && (
                <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                  {/* Summary */}
                  <div className="text-xs text-gray-300 bg-gray-800 p-2 rounded">
                    <div className="text-gray-500 mb-1">Summary:</div>
                    <div className="line-clamp-4">{researchData.summary.substring(0, 300)}...</div>
                  </div>

                  {/* Sources */}
                  <div className="space-y-1">
                    {researchData.results.slice(0, 5).map((result, i) => (
                      <a
                        key={i}
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs p-2 bg-gray-800 rounded hover:bg-gray-750"
                      >
                        <div className="text-blue-400 truncate">{result.title}</div>
                        {result.pageAge && (
                          <div className="text-gray-500 mt-0.5">{result.pageAge}</div>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-14 border-b border-gray-800 flex items-center justify-between px-4">
          <div className="text-sm font-medium">
            {selectedConversation?.title || 'Select or create a conversation'}
          </div>
          <div className="flex gap-2">
            {messages.length > 0 && (
              <>
                <button
                  onClick={copyLastResponse}
                  className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded"
                >
                  Copy
                </button>
                {keyword && (
                  <button
                    onClick={scoreContent}
                    disabled={scoring}
                    className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 rounded disabled:opacity-50"
                  >
                    {scoring ? 'Scoring...' : 'Score Content'}
                  </button>
                )}
              </>
            )}
            <Link
              href="/tables"
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-1"
            >
              <span>📊</span> Tables
            </Link>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!selectedConversation && (
            <div className="flex items-center justify-center h-full text-gray-500">
              Create a new chat to get started
            </div>
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl rounded-lg px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-100'
                }`}
              >
                <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
              </div>
            </div>
          ))}

          {/* Streaming content */}
          {streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-3xl rounded-lg px-4 py-3 bg-gray-800 text-gray-100">
                <div className="whitespace-pre-wrap text-sm">{streamingContent}</div>
                <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        {selectedConversation && (
          <div className="border-t border-gray-800 p-4">
            <div className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message... (Shift+Enter for new line)"
                rows={3}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                className="px-6 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isStreaming ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  'Send'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
