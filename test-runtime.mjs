// Test if Next.js can resolve the JSON at runtime
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

console.log('Testing JSON import...');

try {
  // Direct require
  const data = require('./src/data/habitto-verified-data.json');
  console.log('✓ JSON loads via require()');
  console.log('  Company:', data.company?.name);
  console.log('  Crawled pages:', Object.keys(data.crawledPages || {}).length);
} catch (err) {
  console.error('✗ JSON require() failed:', err.message);
}

// Check if the file exists in the expected location
import fs from 'fs';
const jsonPath = './src/data/habitto-verified-data.json';
console.log('\nJSON file exists:', fs.existsSync(jsonPath));
console.log('JSON file size:', fs.statSync(jsonPath).size, 'bytes');

// Check public directory (Next.js copies public to build)
const publicPath = './public/habitto-verified-data.json';
console.log('Public JSON exists:', fs.existsSync(publicPath));
