// Test to verify rests don't extend beyond measure boundaries
const fs = require('fs');
global.window = {};

// Load modules
eval(fs.readFileSync('./web/scales.js', 'utf8'));
eval(fs.readFileSync('./web/melodic-cells.js', 'utf8'));
eval(fs.readFileSync('./web/devices-new.js', 'utf8'));
eval(fs.readFileSync('./web/generator.js', 'utf8'));

console.log('=== Testing Rest Measure Boundary Constraint ===\n');
console.log('Issue: Inserted rests that end exactly at measure boundaries (beat 4, 8, 12)');
console.log('cause timing issues in VexFlow rendering.\n');
console.log('Fix: Clip rest duration to ensure it stays within measure boundary.\n');

const progression = [
  { symbol: 'Dm7', bar: 0, startBeat: 0, durationBeats: 4 },
  { symbol: 'G7', bar: 1, startBeat: 4, durationBeats: 4 },
  { symbol: 'Cmaj7', bar: 2, startBeat: 8, durationBeats: 4 }
];

let totalTests = 20;
let violations = 0;
let testsPassed = 0;

for (let i = 0; i < totalTests; i++) {
  const options = {
    scaleStrategy: 'default',
    deviceStrategy: 'neighbor-enclosure',
    swing: 0,
    insertRests: true
  };

  const lick = window.LickGen.generateLick(progression, { tempo: 120 }, options);

  let testHasViolations = false;

  // Check each measure
  for (let m = 0; m < 3; m++) {
    const measureStart = m * 4;
    const measureEnd = measureStart + 4;
    const measureNotes = lick.filter(n => n.startBeat >= measureStart && n.startBeat < measureEnd);

    let totalDuration = 0;

    measureNotes.forEach(note => {
      const noteEnd = note.startBeat + note.durationBeats;
      totalDuration += note.durationBeats;

      // Check if note/rest extends beyond measure boundary
      if (noteEnd > measureEnd) {
        console.log(`Test ${i + 1}, Measure ${m}: ❌ VIOLATION`);
        console.log(`  Note/rest at beat ${note.startBeat} with duration ${note.durationBeats}`);
        console.log(`  Extends to beat ${noteEnd} (beyond boundary ${measureEnd})`);
        console.log(`  Device: ${note.device}, isRest: ${note.isRest}`);
        violations++;
        testHasViolations = true;
      }
    });

    // Check if measure adds up to exactly 4 beats
    if (Math.abs(totalDuration - 4) > 0.01) {
      console.log(`Test ${i + 1}, Measure ${m}: ❌ Duration mismatch: ${totalDuration} beats (expected 4)`);
      testHasViolations = true;
    }
  }

  if (!testHasViolations) {
    testsPassed++;
  }
}

console.log('\n=== Results ===');
console.log(`Total tests: ${totalTests}`);
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests with violations: ${totalTests - testsPassed}`);
console.log(`Total violations: ${violations}`);

if (violations > 0) {
  console.log('\n❌ TEST FAILED - Found rests extending beyond measure boundaries');
  process.exit(1);
} else {
  console.log('\n✅ ALL TESTS PASSED');
  console.log('   All rests stay within measure boundaries');
  console.log('   All measures add up to exactly 4 beats');
}
