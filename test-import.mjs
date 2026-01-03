try {
  const { habittoData, getVerifiedFactsContext } = await import('./src/lib/habitto-data.ts');
  console.log('Import successful');
  console.log('Data keys:', Object.keys(habittoData));
  console.log('Facts context length:', getVerifiedFactsContext().length);
} catch (err) {
  console.error('Import failed:', err.message);
  console.error('Stack:', err.stack);
}
