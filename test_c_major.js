// Test enharmonic spelling with C major (should use flats)
const fs = require('fs');

// Load dependencies
global.window = {};
eval(fs.readFileSync('./web/scales.js', 'utf8'));
eval(fs.readFileSync('./web/melodic-cells.js', 'utf8'));
eval(fs.readFileSync('./web/devices-new.js', 'utf8'));
eval(fs.readFileSync('./web/generator.js', 'utf8'));

console.log('Testing C major enharmonic spelling (should use flats)\n');

// Test C major progression
const cMajorProgression = [
  { bar: 0, startBeat: 0, durationBeats: 4, symbol: 'Cmaj7' },
  { bar: 1, startBeat: 4, durationBeats: 4, symbol: 'Fmaj7' },
];

const metadata = {
  title: 'C Major Test',
  tempo: 120,
};

const options = {
  deviceStrategy: 'neighbor-enclosure',
  swing: 0,
};

const lick = window.LickGen.generateLick(cMajorProgression, metadata, options);

console.log(`Generated lick with ${lick.length} notes\n`);

// Check for flat vs sharp usage
console.log('=== Note Names Analysis ===');
let sharpCount = 0;
let flatCount = 0;

lick.forEach((note, idx) => {
  const hasSharp = note.noteName && note.noteName.includes('#');
  const hasFlat = note.noteName && note.noteName.includes('b');

  if (hasSharp) {
    sharpCount++;
    console.log(`Note ${idx}: ${note.noteName} # (SHARP) - Chord: ${note.chordSymbol} (rootPc=${note.rootPc})`);
  } else if (hasFlat) {
    flatCount++;
    console.log(`Note ${idx}: ${note.noteName} b (FLAT) - Chord: ${note.chordSymbol} (rootPc=${note.rootPc})`);
  }
});

console.log(`\n=== Summary ===`);
console.log(`Sharps: ${sharpCount}`);
console.log(`Flats: ${flatCount}`);

if (flatCount > 0 && sharpCount === 0) {
  console.log('\n✓ Test PASSED: C major is using flats');
} else if (sharpCount > 0 && flatCount === 0) {
  console.log('\n✗ Test FAILED: C major is using sharps (should use flats)');
} else if (sharpCount === 0 && flatCount === 0) {
  console.log('\n- No accidentals found in this lick (all natural notes)');
} else {
  console.log('\n⚠ Mixed sharps and flats (unusual)');
}
