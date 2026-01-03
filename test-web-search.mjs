/**
 * Test Claude Web Search Tool Support
 * Verifies SDK can use web_search_20250305 tool
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'

// Load .env.local
const envFile = readFileSync('.env.local', 'utf8')
for (const line of envFile.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    process.env[match[1]] = match[2]
  }
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

async function testWebSearch() {
  console.log('Testing Claude Web Search Tool...\n')
  console.log('SDK Version:', Anthropic.VERSION || 'unknown')

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: '日本の2024年の平均貯金額は？最新のデータを教えてください。'
        }
      ],
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 3,
        user_location: {
          type: 'approximate',
          city: 'Tokyo',
          region: 'Tokyo',
          country: 'JP',
          timezone: 'Asia/Tokyo'
        }
      }]
    })

    console.log('✓ API call successful!\n')
    console.log('Stop reason:', response.stop_reason)
    console.log('Usage:', JSON.stringify(response.usage, null, 2))

    // Check for web search results
    let searchCount = 0
    let hasResults = false

    for (const block of response.content) {
      if (block.type === 'server_tool_use' && block.name === 'web_search') {
        searchCount++
        console.log(`\n🔍 Search ${searchCount}:`, block.input?.query)
      }
      if (block.type === 'web_search_tool_result') {
        hasResults = true
        const results = block.content || []
        console.log(`   Found ${results.length} results`)
        for (const result of results.slice(0, 3)) {
          if (result.type === 'web_search_result') {
            console.log(`   - ${result.title}`)
            console.log(`     URL: ${result.url}`)
            console.log(`     Age: ${result.page_age || 'unknown'}`)
          }
        }
      }
      if (block.type === 'text') {
        // Check for citations
        const hasCitations = block.citations && block.citations.length > 0
        console.log(`\n📝 Response (has citations: ${hasCitations}):`)
        console.log(block.text.substring(0, 500) + '...')
      }
    }

    console.log('\n=== SUMMARY ===')
    console.log(`Web searches performed: ${searchCount}`)
    console.log(`Has search results: ${hasResults}`)
    console.log(`Web search requests billed: ${response.usage?.server_tool_use?.web_search_requests || 0}`)

    if (searchCount > 0 && hasResults) {
      console.log('\n✅ Web Search Tool is WORKING!')
    } else {
      console.log('\n⚠️ Web Search may not have been triggered')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.status === 400) {
      console.error('This may indicate the web search tool is not supported or not enabled.')
    }
    process.exit(1)
  }
}

testWebSearch()
