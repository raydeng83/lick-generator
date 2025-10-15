// Detailed test of rest notation with specific test cases
const fs = require('fs');
global.window = {};

// Load modules
eval(fs.readFileSync('./web/scales.js', 'utf8'));
eval(fs.readFileSync('./web/melodic-cells.js', 'utf8'));
eval(fs.readFileSync('./web/devices-new.js', 'utf8'));
eval(fs.readFileSync('./web/generator.js', 'utf8'));

console.log('=== Detailed Rest Notation Test ===\n');

// Helper to create a mock chord context
function mockChord() {
  return {
    symbol: 'Cmaj7',
    rootPc: 0,
    quality: 'maj7',
    scaleName: 'major'
  };
}

// Test by generating a lick and manually inserting test scenarios
// We'll use the last measure enclosure device which generates rests

const progression = [
  { symbol: 'Dm7', bar: 0, startBeat: 0, durationBeats: 4 },
  { symbol: 'G7', bar: 1, startBeat: 4, durationBeats: 4 },
  { symbol: 'Cmaj7', bar: 2, startBeat: 8, durationBeats: 4 }
];

console.log('Generating licks with neighbor-enclosure device (last measure generates rests)...\n');

let totalLicks = 0;
let licksWithRests = 0;
let totalRests = 0;
let violations = 0;
const restExamples = [];

for (let i = 0; i < 100; i++) {
  const options = {
    scaleStrategy: 'default',
    deviceStrategy: 'neighbor-enclosure',
    swing: 0,
    insertRests: false
  };

  const lick = window.LickGen.generateLick(progression, { tempo: 120 }, options);
  totalLicks++;

  let hasRests = false;
  lick.forEach((note, idx) => {
    if (note.isRest) {
      hasRests = true;
      totalRests++;

      const startBeat = note.startBeat;
      const endBeat = startBeat + note.durationBeats;
      const measureStart = Math.floor(startBeat / 4) * 4;
      const midpoint = measureStart + 2;

      // Check if rest crosses midpoint
      if (startBeat < midpoint && endBeat > midpoint) {
        violations++;
        console.log(`❌ VIOLATION in lick ${i + 1}, note ${idx}:`);
        console.log(`   Rest from ${startBeat} to ${endBeat} (duration ${note.durationBeats})`);
        console.log(`   Crosses midpoint at ${midpoint}`);
      }

      // Collect examples for reporting
      if (restExamples.length < 10) {
        restExamples.push({
          lickNum: i + 1,
          startBeat,
          endBeat,
          duration: note.durationBeats,
          midpoint,
          measureStart,
          crossesMidpoint: startBeat < midpoint && endBeat > midpoint
        });
      }
    }
  });

  if (hasRests) {
    licksWithRests++;
  }
}

console.log('=== Results ===');
console.log(`Total licks generated: ${totalLicks}`);
console.log(`Licks with rests: ${licksWithRests}`);
console.log(`Total rests: ${totalRests}`);
console.log(`Violations: ${violations}\n`);

if (violations > 0) {
  console.log('❌ TEST FAILED - Found rests crossing measure midpoint\n');
  process.exit(1);
}

console.log('=== First 10 Rest Examples ===\n');
restExamples.forEach((ex, idx) => {
  console.log(`Example ${idx + 1} (Lick ${ex.lickNum}):`);
  console.log(`  Measure: beats ${ex.measureStart}-${ex.measureStart + 4}, midpoint at ${ex.midpoint}`);
  console.log(`  Rest: ${ex.startBeat} to ${ex.endBeat} (${ex.duration} beats)`);

  if (ex.crossesMidpoint) {
    console.log(`  ❌ CROSSES MIDPOINT!`);
  } else {
    if (ex.startBeat < ex.midpoint && ex.endBeat <= ex.midpoint) {
      console.log(`  ✓ Stays in first half (before midpoint)`);
    } else if (ex.startBeat >= ex.midpoint) {
      console.log(`  ✓ Stays in second half (at or after midpoint)`);
    } else if (ex.endBeat <= ex.measureStart + 4) {
      console.log(`  ✓ OK (within measure bounds)`);
    }
  }
  console.log();
});

console.log('\n✅ TEST PASSED - All rests respect the measure midpoint rule');
console.log('   No rests cross beat 2, 6, 10, etc. (measure midpoints)');
