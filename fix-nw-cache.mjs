/**
 * Fix NeuronWriter cache - delete invalid entry and refetch
 */

const projectId = '25a33c27-5257-4b00-9e67-e6d9fb2a2390' // Habitto
const keyword = '20代 貯金'

async function fixCache() {
  console.log('Clearing cached NeuronWriter data for keyword:', keyword)

  // Delete the bad cache via API
  const deleteResponse = await fetch('http://localhost:3002/api/writer/neuronwriter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'clearCache',
      projectId,
      keyword,
    }),
  })

  console.log('Clear cache response:', deleteResponse.status)

  // Now fetch fresh data
  console.log('\nFetching fresh NeuronWriter analysis...')
  const fetchResponse = await fetch(
    `http://localhost:3002/api/writer/neuronwriter?projectId=${projectId}&keyword=${encodeURIComponent(keyword)}`
  )

  const data = await fetchResponse.json()
  console.log('\nFresh data:')
  console.log('- Query ID:', data.queryId)
  console.log('- Keywords count:', data.topKeywords?.length || 0)
  console.log('- First 5 keywords:', data.topKeywords?.slice(0, 5).map(k => k.term) || [])
  console.log('- Cached:', data.cached)
}

fixCache()
