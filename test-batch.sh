#!/bin/bash
curl -s -X POST "https://habitto-blog-simple.vercel.app/api/batch" \
  -H "Content-Type: application/json" \
  -d '{"keywords": ["貯金 方法"], "useNeuronwriter": true}'
