'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// Table configuration
const TABLE_CONFIG = {
  writer_projects: {
    label: 'Projects',
    icon: '📁',
    columns: ['id', 'name', 'description', 'created_at'],
    truncate: { description: 50, system_prompt: 50 },
  },
  writer_conversations: {
    label: 'Conversations',
    icon: '💬',
    columns: ['id', 'project_id', 'title', 'keyword', 'created_at'],
    truncate: { title: 40 },
  },
  writer_messages: {
    label: 'Messages',
    icon: '✉️',
    columns: ['id', 'conversation_id', 'role', 'content', 'created_at'],
    truncate: { content: 100 },
  },
  writer_files: {
    label: 'Files',
    icon: '📄',
    columns: ['id', 'project_id', 'name', 'file_type', 'token_count', 'created_at'],
    truncate: { content: 50 },
  },
  writer_nw_queries: {
    label: 'NW Queries',
    icon: '🔍',
    columns: ['id', 'project_id', 'keyword', 'query_id', 'created_at'],
    truncate: {},
  },
  writer_scores: {
    label: 'Scores',
    icon: '📊',
    columns: ['id', 'conversation_id', 'score', 'content_preview', 'created_at'],
    truncate: { content_preview: 50 },
  },
  writer_research: {
    label: 'Research',
    icon: '🔬',
    columns: ['id', 'conversation_id', 'keyword', 'created_at'],
    truncate: {},
  },
  writer_blogs: {
    label: 'Blogs',
    icon: '📝',
    columns: ['id', 'keyword', 'title', 'status', 'score', 'created_at'],
    truncate: { title: 50, meta_description: 50 },
  },
}

type TableName = keyof typeof TABLE_CONFIG

interface TableData {
  [key: string]: unknown[]
}

interface Counts {
  [key: string]: number
}

export default function TablesPage() {
  const [activeTable, setActiveTable] = useState<TableName>('writer_blogs')
  const [data, setData] = useState<TableData>({})
  const [counts, setCounts] = useState<Counts>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Load all data on mount
  useEffect(() => {
    fetch('/api/tables')
      .then(res => res.json())
      .then(result => {
        const { counts: c, ...tables } = result
        setData(tables)
        setCounts(c || {})
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load tables:', err)
        setLoading(false)
      })
  }, [])

  const currentConfig = TABLE_CONFIG[activeTable]
  const currentData = data[activeTable] || []

  // Filter data
  const filteredData = filter
    ? currentData.filter((row: unknown) =>
        JSON.stringify(row).toLowerCase().includes(filter.toLowerCase())
      )
    : currentData

  // Format cell value
  const formatCell = (key: string, value: unknown): string => {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'object') return JSON.stringify(value).slice(0, 100) + '...'
    if (key === 'created_at' || key === 'updated_at') {
      return new Date(value as string).toLocaleString('ja-JP', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
    const str = String(value)
    const truncateLen = currentConfig.truncate[key as keyof typeof currentConfig.truncate]
    if (truncateLen && str.length > truncateLen) {
      return str.slice(0, truncateLen) + '...'
    }
    return str
  }

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'published': return 'bg-green-500/20 text-green-400'
      case 'approved': return 'bg-blue-500/20 text-blue-400'
      case 'review': return 'bg-yellow-500/20 text-yellow-400'
      case 'draft': return 'bg-gray-500/20 text-gray-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Database Tables</h1>
            <span className="text-sm text-gray-500">
              {Object.values(counts).reduce((a, b) => a + b, 0)} total records
            </span>
          </div>
          <Link
            href="/writer"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
          >
            ← Back to Writer
          </Link>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Table Tabs */}
        <aside className="w-56 bg-gray-900 border-r border-gray-800 min-h-[calc(100vh-73px)]">
          <nav className="p-2">
            {(Object.keys(TABLE_CONFIG) as TableName[]).map(tableName => {
              const config = TABLE_CONFIG[tableName]
              const count = counts[tableName] || 0
              const isActive = activeTable === tableName

              return (
                <button
                  key={tableName}
                  onClick={() => {
                    setActiveTable(tableName)
                    setExpandedRow(null)
                    setFilter('')
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 flex items-center justify-between transition-colors ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                      : 'hover:bg-gray-800 text-gray-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{config.icon}</span>
                    <span className="text-sm">{config.label}</span>
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    isActive ? 'bg-blue-600/30' : 'bg-gray-800'
                  }`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Table Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <span>{currentConfig.icon}</span>
              <span>{currentConfig.label}</span>
              <span className="text-sm text-gray-500 font-normal">
                ({filteredData.length} rows)
              </span>
            </h2>

            {/* Search */}
            <input
              type="text"
              placeholder="Filter..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm w-64 focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-800/50">
                      {currentConfig.columns.map(col => (
                        <th
                          key={col}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                        >
                          {col.replace(/_/g, ' ')}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-20">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={currentConfig.columns.length + 1}
                          className="px-4 py-8 text-center text-gray-500"
                        >
                          No data found
                        </td>
                      </tr>
                    ) : (
                      filteredData.map((row: unknown) => {
                        const r = row as Record<string, unknown>
                        const rowId = r.id as string
                        const isExpanded = expandedRow === rowId

                        return (
                          <>
                            <tr
                              key={rowId}
                              className={`hover:bg-gray-800/50 transition-colors ${
                                isExpanded ? 'bg-gray-800/30' : ''
                              }`}
                            >
                              {currentConfig.columns.map(col => (
                                <td key={col} className="px-4 py-3 text-sm">
                                  {col === 'status' ? (
                                    <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(r[col] as string)}`}>
                                      {r[col] as string}
                                    </span>
                                  ) : col === 'score' && r[col] !== null ? (
                                    <span className={`font-medium ${
                                      (r[col] as number) >= 60 ? 'text-green-400' :
                                      (r[col] as number) >= 40 ? 'text-yellow-400' : 'text-red-400'
                                    }`}>
                                      {r[col] as number}
                                    </span>
                                  ) : col === 'id' ? (
                                    <span className="font-mono text-xs text-gray-500">
                                      {(r[col] as string).slice(0, 8)}...
                                    </span>
                                  ) : col === 'role' ? (
                                    <span className={`px-2 py-0.5 rounded text-xs ${
                                      r[col] === 'user' ? 'bg-purple-500/20 text-purple-400' : 'bg-cyan-500/20 text-cyan-400'
                                    }`}>
                                      {r[col] as string}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">
                                      {formatCell(col, r[col])}
                                    </span>
                                  )}
                                </td>
                              ))}
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => setExpandedRow(isExpanded ? null : rowId)}
                                  className="text-xs text-blue-400 hover:text-blue-300"
                                >
                                  {isExpanded ? 'Hide' : 'View'}
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr key={`${rowId}-expanded`}>
                                <td
                                  colSpan={currentConfig.columns.length + 1}
                                  className="px-4 py-4 bg-gray-800/20"
                                >
                                  <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                                    {JSON.stringify(r, null, 2)}
                                  </pre>
                                </td>
                              </tr>
                            )}
                          </>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
