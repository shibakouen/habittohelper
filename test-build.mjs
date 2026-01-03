import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Test if the built version can import the data
try {
  // Simulate what happens in production
  const data = require('./src/data/habitto-verified-data.json');
  console.log('✓ JSON import works');
  console.log('  Keys:', Object.keys(data).length);
  console.log('  Crawled pages:', Object.keys(data.crawledPages).length);
  
  // Test if the loader works
  const fs = require('fs');
  const loaderExists = fs.existsSync('./src/lib/habitto-data.ts');
  console.log('✓ habitto-data.ts exists:', loaderExists);
  
  // Check if it compiles
  const tsCheck = require('child_process').execSync('npx tsc --noEmit src/lib/habitto-data.ts 2>&1', { encoding: 'utf8' });
  console.log('TypeScript check output:', tsCheck || 'No errors');
  
} catch (err) {
  console.error('✗ Error:', err.message);
  process.exit(1);
}
