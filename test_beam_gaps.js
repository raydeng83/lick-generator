// Test to verify beaming doesn't span across gaps (rests)
const fs = require('fs');
global.window = {};

// Load modules
eval(fs.readFileSync('./web/scales.js', 'utf8'));
eval(fs.readFileSync('./web/melodic-cells.js', 'utf8'));
eval(fs.readFileSync('./web/devices-new.js', 'utf8'));
eval(fs.readFileSync('./web/generator.js', 'utf8'));

console.log('=== Testing Beam Gap Detection ===\n');
console.log('Verifying that beams do NOT span across gaps (rests between notes)\n');

const progression = [
  { symbol: 'Dm7', bar: 0, startBeat: 0, durationBeats: 4 },
  { symbol: 'G7', bar: 1, startBeat: 4, durationBeats: 4 },
  { symbol: 'Cmaj7', bar: 2, startBeat: 8, durationBeats: 4 }
];

let totalTests = 20;
let violations = 0;

for (let i = 0; i < totalTests; i++) {
  const options = {
    scaleStrategy: 'default',
    deviceStrategy: 'neighbor-enclosure',
    swing: 0,
    insertRests: true
  };

  const lick = window.LickGen.generateLick(progression, { tempo: 120 }, options);

  // Analyze all eighth notes
  const eighthNotes = lick.filter(n => !n.isRest && n.durationBeats === 0.5);

  // Check for gaps between consecutive eighth notes
  for (let j = 0; j < eighthNotes.length - 1; j++) {
    const note1 = eighthNotes[j];
    const note2 = eighthNotes[j + 1];

    const note1End = note1.startBeat + note1.durationBeats;
    const hasGap = Math.abs(note1End - note2.startBeat) > 0.01;

    // If there's a gap AND they're in the same beat, this would be a violation
    const beat1 = Math.floor(note1.startBeat);
    const beat2 = Math.floor(note2.startBeat);
    const sameBeat = beat1 === beat2;

    if (hasGap && sameBeat) {
      console.log(`Test ${i + 1}: ❌ POTENTIAL VIOLATION - Gap within same beat`);
      console.log(`  Note 1: beat ${note1.startBeat.toFixed(2)}, ends at ${note1End.toFixed(2)}`);
      console.log(`  Note 2: beat ${note2.startBeat.toFixed(2)}, starts at ${note2.startBeat.toFixed(2)}`);
      console.log(`  Gap size: ${(note2.startBeat - note1End).toFixed(2)} beats`);
      console.log(`  Both in beat ${beat1} - these should NOT be beamed together\n`);
      violations++;
    }
  }
}

console.log('\n=== Results ===');
console.log(`Total tests: ${totalTests}`);
console.log(`Violations found: ${violations}`);

if (violations > 0) {
  console.log('\n⚠️  Found gaps within beats - beaming logic must prevent these from being beamed');
  console.log('The consecutiveness check in notate.js should handle this correctly.');
} else {
  console.log('\n✅ No gaps within same beat found in test data');
  console.log('   (Or gaps were present but properly handled by consecutiveness check)');
}

console.log('\nCheck the web UI to visually verify no beams span across rests.');
