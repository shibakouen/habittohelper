const NEURONWRITER_API_URL = 'https://app.neuronwriter.com/neuron-api/0.5/writer'
const NEURONWRITER_API_KEY = process.env.NEURONWRITER_API_KEY
const NEURONWRITER_PROJECT_ID = process.env.NEURONWRITER_PROJECT_ID

async function test() {
  console.log('API Key set:', !!NEURONWRITER_API_KEY)
  console.log('Project ID set:', !!NEURONWRITER_PROJECT_ID)
  
  console.log('\nTesting /list-queries...')
  const response = await fetch(`${NEURONWRITER_API_URL}/list-queries`, {
    method: 'POST',
    headers: {
      'X-API-KEY': NEURONWRITER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ project: NEURONWRITER_PROJECT_ID }),
  })
  
  console.log('Status:', response.status)
  console.log('Headers:', Object.fromEntries(response.headers.entries()))
  
  const data = await response.json()
  console.log('Response:', JSON.stringify(data, null, 2))
}

test().catch(console.error)
