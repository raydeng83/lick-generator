// Test to verify rest notation follows "break the middle of the bar" rule
const fs = require('fs');
global.window = {};

// Load modules
eval(fs.readFileSync('./web/scales.js', 'utf8'));
eval(fs.readFileSync('./web/melodic-cells.js', 'utf8'));
eval(fs.readFileSync('./web/devices-new.js', 'utf8'));

// Access the private generateCombinedRests function by exposing it
// We need to test it directly, so we'll create a simple wrapper in devices-new.js
// For now, let's test indirectly by generating licks with the neighbor-enclosure device

console.log('=== Testing Rest Notation - Break the Middle of the Bar Rule ===\n');

// Test helper to check if a rest crosses the measure midpoint
function checkRestCrossesMidpoint(rest) {
  const startBeat = rest.startBeat;
  const endBeat = startBeat + rest.durationBeats;

  // Get midpoint for start and end
  const measureStart = Math.floor(startBeat / 4) * 4;
  const midpoint = measureStart + 2;

  // Check if rest spans across the midpoint
  if (startBeat < midpoint && endBeat > midpoint) {
    return {
      crosses: true,
      startBeat,
      endBeat,
      duration: rest.durationBeats,
      midpoint
    };
  }

  return { crosses: false };
}

// Test Case 1: Direct unit tests with mock chord context
console.log('=== Unit Tests ===\n');

const mockChord = {
  symbol: 'Cmaj7',
  rootPc: 0,
  quality: 'maj7',
  scaleName: 'major'
};

// Test helper function (we'll need to expose this from devices-new.js)
// For now, we can only test indirectly through generated licks

console.log('Test 1: Rest at beat 1.5, duration 2.5 (should NOT cross midpoint at 2.0)');
console.log('  Expected: Should break into rests that don\'t cross beat 2.0');
console.log('  This will be tested via generated licks.\n');

console.log('Test 2: Rest at beat 0.0, duration 2.0 (stays in first half)');
console.log('  Expected: One half rest (2 beats) from 0.0-2.0');
console.log('  This should work correctly.\n');

console.log('Test 3: Rest at beat 2.0, duration 2.0 (stays in second half)');
console.log('  Expected: One half rest (2 beats) from 2.0-4.0');
console.log('  This should work correctly.\n');

console.log('Test 4: Rest at beat 1.0, duration 3.0 (crosses midpoint)');
console.log('  Expected: Break at midpoint - quarter rest (1.0-2.0) + half rest (2.0-4.0)');
console.log('  This will be tested via generated licks.\n');

// Test Case 2: Integration test - generate licks and check for violations
console.log('\n=== Integration Tests - Checking Generated Licks ===\n');

eval(fs.readFileSync('./web/generator.js', 'utf8'));

const progression = [
  { symbol: 'Dm7', bar: 0, startBeat: 0, durationBeats: 4 },
  { symbol: 'G7', bar: 1, startBeat: 4, durationBeats: 4 },
  { symbol: 'Cmaj7', bar: 2, startBeat: 8, durationBeats: 4 }
];

let totalRests = 0;
let restsWithViolations = 0;
const violations = [];

// Generate several licks with neighbor-enclosure device (which uses rests)
for (let i = 0; i < 20; i++) {
  const options = {
    scaleStrategy: 'default',
    deviceStrategy: 'neighbor-enclosure',
    swing: 0,
    insertRests: false
  };

  const lick = window.LickGen.generateLick(progression, { tempo: 120 }, options);

  // Check all rests in the lick
  lick.forEach((note, idx) => {
    if (note.isRest) {
      totalRests++;
      const check = checkRestCrossesMidpoint(note);

      if (check.crosses) {
        restsWithViolations++;
        if (violations.length < 5) {  // Collect first 5 examples
          violations.push({
            lickNum: i + 1,
            noteIdx: idx,
            ...check
          });
        }
      }
    }
  });
}

console.log('=== Results ===');
console.log(`Total rests generated: ${totalRests}`);
console.log(`Rests violating midpoint rule: ${restsWithViolations}`);

if (restsWithViolations > 0) {
  console.log(`\n❌ VIOLATIONS DETECTED!\n`);
  console.log(`Found ${restsWithViolations} rests that cross the measure midpoint.\n`);

  console.log('=== First 5 Examples ===\n');
  violations.forEach((v, idx) => {
    console.log(`Example ${idx + 1}:`);
    console.log(`  Lick ${v.lickNum}, Rest ${v.noteIdx}`);
    console.log(`  Start beat: ${v.startBeat}, End beat: ${v.endBeat}, Duration: ${v.duration}`);
    console.log(`  Measure midpoint: ${v.midpoint}`);
    console.log(`  ⚠️ Rest crosses midpoint from ${v.startBeat} to ${v.endBeat}!`);
    console.log();
  });

  process.exit(1);
} else {
  console.log('\n✅ No violations found!');
  console.log('   All rests respect the "break the middle of the bar" rule.');
  console.log('   No rests cross the measure midpoint.');
}
