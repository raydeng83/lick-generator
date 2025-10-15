// Test the new per-measure rest insertion logic
const fs = require('fs');
global.window = {};

// Load modules
eval(fs.readFileSync('./web/scales.js', 'utf8'));
eval(fs.readFileSync('./web/melodic-cells.js', 'utf8'));
eval(fs.readFileSync('./web/devices-new.js', 'utf8'));
eval(fs.readFileSync('./web/generator.js', 'utf8'));

console.log('=== Testing Per-Measure Rest Insertion ===\n');

const progression = [
  { symbol: 'Dm7', bar: 0, startBeat: 0, durationBeats: 4 },
  { symbol: 'G7', bar: 1, startBeat: 4, durationBeats: 4 },
  { symbol: 'Cmaj7', bar: 2, startBeat: 8, durationBeats: 4 }
];

// Test with multiple generations to verify behavior
let totalTests = 10;
let testsWithRestsInAllMeasures = 0;
let testsWithRestsInSomeMeasures = 0;
let testsWithNoRests = 0;

for (let i = 0; i < totalTests; i++) {
  console.log(`\n--- Test ${i + 1} ---`);

  const options = {
    scaleStrategy: 'default',
    deviceStrategy: 'neighbor-enclosure',
    swing: 0,
    insertRests: true  // Enable rest insertion
  };

  const lick = window.LickGen.generateLick(progression, { tempo: 120 }, options);

  // Find inserted rests (device = 'rest-inserted')
  const insertedRests = lick.filter(n => n.isRest && n.device === 'rest-inserted');

  console.log(`Total notes/rests: ${lick.length}`);
  console.log(`Inserted rests: ${insertedRests.length}`);

  if (insertedRests.length === 0) {
    console.log('⚠️ No rests were inserted (might be due to protection rules)');
    testsWithNoRests++;
    continue;
  }

  // Group inserted rests by measure
  const restsByMeasure = new Map();
  insertedRests.forEach(rest => {
    const measureNum = Math.floor(rest.startBeat / 4);
    if (!restsByMeasure.has(measureNum)) {
      restsByMeasure.set(measureNum, []);
    }
    restsByMeasure.get(measureNum).push(rest);
  });

  console.log(`\nRests distributed across ${restsByMeasure.size} measures:`);

  let hasMultipleRestsInSameMeasure = false;
  for (const [measureNum, rests] of restsByMeasure.entries()) {
    console.log(`  Measure ${measureNum}: ${rests.length} rest(s)`);
    rests.forEach(rest => {
      console.log(`    - Beat ${rest.startBeat.toFixed(1)}, duration ${rest.durationBeats} beats`);
    });

    if (rests.length > 1) {
      console.log(`    ❌ ERROR: Multiple rests in same measure!`);
      hasMultipleRestsInSameMeasure = true;
    }
  }

  // Check if each measure has at most one rest
  if (hasMultipleRestsInSameMeasure) {
    console.log('\n❌ TEST FAILED: Found multiple rests in the same measure');
  } else {
    console.log('\n✓ TEST PASSED: Each measure has at most one rest');
  }

  // Track statistics
  if (restsByMeasure.size === 3) {
    testsWithRestsInAllMeasures++;
  } else if (restsByMeasure.size > 0) {
    testsWithRestsInSomeMeasures++;
  }

  // Verify protection rules
  const firstNote = lick[0];
  const lastNonRest = [...lick].reverse().find(n => !n.isRest);

  console.log('\nProtection check:');
  console.log(`  First note: ${firstNote.isRest ? 'REST ❌' : 'NOTE ✓'} at beat ${firstNote.startBeat}`);
  console.log(`  Last non-rest note: at beat ${lastNonRest.startBeat}${lastNonRest.isRest ? ' ❌ (should not be rest)' : ' ✓'}`);
}

console.log('\n=== Summary ===');
console.log(`Total tests: ${totalTests}`);
console.log(`Tests with rests in all 3 measures: ${testsWithRestsInAllMeasures}`);
console.log(`Tests with rests in some measures: ${testsWithRestsInSomeMeasures}`);
console.log(`Tests with no rests: ${testsWithNoRests}`);

console.log('\n=== Detailed Example ===');
// Generate one more and show full details
const options = {
  scaleStrategy: 'default',
  deviceStrategy: 'neighbor-enclosure',
  swing: 0,
  insertRests: true
};

const exampleLick = window.LickGen.generateLick(progression, { tempo: 120 }, options);
console.log('\nFull lick structure:');
exampleLick.forEach((note, idx) => {
  const type = note.isRest ? 'REST' : 'NOTE';
  const device = note.device || 'unknown';
  const measureNum = Math.floor(note.startBeat / 4);
  console.log(`[${idx}] ${type} (${device}): beat ${note.startBeat.toFixed(1)}, duration ${note.durationBeats}, measure ${measureNum}`);
});

console.log('\n✅ Test complete - Check that each measure has at most one inserted rest');
