import { writeFileSync } from 'fs'

const NEURONWRITER_API_URL = 'https://app.neuronwriter.com/neuron-api/0.5/writer'
const NEURONWRITER_API_KEY = 'n-078c705463b7c6167a690a11804c0eb9'

async function debugResponse() {
  console.log('Fetching query data from NeuronWriter...')

  const response = await fetch(`${NEURONWRITER_API_URL}/get-query`, {
    method: 'POST',
    headers: {
      'X-API-KEY': NEURONWRITER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: '6f938fb8bed32ba3',
    }),
  })

  const data = await response.json()

  // Save full response
  writeFileSync('nw-response-full.json', JSON.stringify(data, null, 2))
  console.log('✓ Saved full response to nw-response-full.json')

  // Print structure overview
  console.log('\nResponse structure:')
  console.log('- Keys:', Object.keys(data))
  console.log('- Status:', data.status)
  console.log('- Competitors count:', data.competitors?.length || 0)

  if (data.competitors && data.competitors.length > 0) {
    console.log('\nFirst competitor keys:', Object.keys(data.competitors[0]))
    console.log('First competitor entities type:', typeof data.competitors[0].entities)
    console.log('First competitor entities:', data.competitors[0].entities ? 'EXISTS' : 'MISSING')

    // Save first competitor
    writeFileSync('nw-first-competitor.json', JSON.stringify(data.competitors[0], null, 2))
    console.log('✓ Saved first competitor to nw-first-competitor.json')
  }
}

debugResponse()
