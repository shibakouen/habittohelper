/**
 * Test fetching NeuronWriter keywords (should refetch now that cache is cleared)
 */

const projectId = '25a33c27-5257-4b00-9e67-e6d9fb2a2390'
const keyword = '20代 貯金'

async function testFetch() {
  console.log('Fetching NeuronWriter analysis for keyword:', keyword)
  console.log('This should fetch fresh data from NeuronWriter API...\n')

  try {
    const response = await fetch(
      `http://localhost:3002/api/writer/neuronwriter?projectId=${projectId}&keyword=${encodeURIComponent(keyword)}`
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('Error:', response.status, error)
      return
    }

    const data = await response.json()

    console.log('Success!')
    console.log('================')
    console.log('Query ID:', data.queryId)
    console.log('Cached:', data.cached)
    console.log('Recommended terms count:', data.recommendedTerms?.length || 0)
    console.log('Top keywords count:', data.topKeywords?.length || 0)
    console.log('Word count target:', data.wordCountTarget)
    console.log('\nFirst 10 keywords:')
    data.topKeywords?.slice(0, 10).forEach((k, i) => {
      console.log(`  ${i + 1}. ${k.term} (weight: ${k.weight})`)
    })

  } catch (error) {
    console.error('Fetch failed:', error)
  }
}

testFetch()
