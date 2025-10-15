// Test the new per-family-varied scale strategy
const fs = require('fs');

// Load scales.js in Node environment
global.window = { Scales: {} };
eval(fs.readFileSync('./web/scales.js', 'utf8'));

const Scales = window.Scales;

console.log('=== Testing Per-Family Random Strategy ===\n');

// Test chord qualities from different families
const testChords = [
  { quality: 'm7', expectedFamily: 'minor', familyScales: Scales.SCALE_FAMILIES.minor },
  { quality: '7', expectedFamily: 'dominant', familyScales: Scales.SCALE_FAMILIES.dominant },
  { quality: 'maj7', expectedFamily: 'major', familyScales: Scales.SCALE_FAMILIES.major },
  { quality: 'm7b5', expectedFamily: 'diminished', familyScales: Scales.SCALE_FAMILIES.diminished },
];

testChords.forEach(({ quality, expectedFamily, familyScales }) => {
  console.log(`\nTesting ${quality} chord (expected family: ${expectedFamily}):`);

  // Verify getChordFamily works
  const family = Scales.getChordFamily(quality);
  console.log(`  getChordFamily('${quality}') = '${family}' ${family === expectedFamily ? '✓' : '✗'}`);

  // Test per-family-varied strategy multiple times to see variety
  console.log(`  Available family scales: ${familyScales.join(', ')}`);
  console.log(`  Random selections (10 trials):`);

  const selections = new Set();
  for (let i = 0; i < 10; i++) {
    const scale = Scales.selectScale(quality, 'per-family-varied');
    selections.add(scale);
    process.stdout.write(`    ${i + 1}. ${scale}\n`);

    // Verify the selected scale is in the family
    if (!familyScales.includes(scale)) {
      console.log(`      ⚠️  WARNING: '${scale}' is not in ${expectedFamily} family!`);
    }
  }

  console.log(`  Unique scales selected: ${selections.size} out of ${familyScales.length} available`);
});

// Test with Dm7-G7-Cmaj7 progression
console.log('\n\n=== Testing ii-V-I Progression (Dm7 | G7 | Cmaj7) ===\n');

const progression = [
  { symbol: 'Dm7', quality: 'm7', bar: 0 },
  { symbol: 'G7', quality: '7', bar: 1 },
  { symbol: 'Cmaj7', quality: 'maj7', bar: 2 },
];

for (let trial = 1; trial <= 5; trial++) {
  console.log(`Trial ${trial}:`);
  progression.forEach(({ symbol, quality }) => {
    const scale = Scales.selectScale(quality, 'per-family-varied');
    const family = Scales.getChordFamily(quality);
    console.log(`  ${symbol.padEnd(6)} → ${scale.padEnd(20)} (${family} family)`);
  });
  console.log('');
}

console.log('✅ Test complete! Server is running at http://localhost:5173');
console.log('   Open the page and try the "Per-Family Random (Rule 3)" scale strategy.');
