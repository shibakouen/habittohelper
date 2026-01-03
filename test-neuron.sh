#!/bin/bash
cd /Users/matteo/firecrawl/habitto-ultimate/habitto-blog-simple
source .env.local

echo "=== Testing /get-query endpoint ==="
curl -s -X POST "https://app.neuronwriter.com/neuron-api/0.5/writer/get-query" \
  -H "X-API-KEY: $NEURONWRITER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "f239bc9bab2e88d4"}' | head -100
