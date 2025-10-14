// Test enharmonic spelling with flat keys
const fs = require('fs');

// Load dependencies
global.window = {};
eval(fs.readFileSync('./web/scales.js', 'utf8'));
eval(fs.readFileSync('./web/melodic-cells.js', 'utf8'));
eval(fs.readFileSync('./web/devices-new.js', 'utf8'));
eval(fs.readFileSync('./web/generator.js', 'utf8'));

console.log('Testing flat key enharmonic spelling\n');

// Test Bb-7 to Eb7 progression (flat keys)
const flatProgression = [
  { bar: 0, startBeat: 0, durationBeats: 4, symbol: 'Bbm7' },
  { bar: 1, startBeat: 4, durationBeats: 4, symbol: 'Eb7' },
];

const metadata = {
  title: 'Flat Keys Test',
  tempo: 120,
};

const options = {
  deviceStrategy: 'neighbor-enclosure',
  swing: 0,
};

const lick = window.LickGen.generateLick(flatProgression, metadata, options);

console.log(`Generated lick with ${lick.length} notes\n`);

// Check for flat vs sharp usage
console.log('=== Note Names Analysis ===');
lick.forEach((note, idx) => {
  const hasSharp = note.noteName && note.noteName.includes('#');
  const hasFlat = note.noteName && note.noteName.includes('b');
  const accidental = hasSharp ? '# (SHARP)' : hasFlat ? 'b (FLAT)' : '(natural)';
  const chord = note.chordSymbol;
  const rootPc = note.rootPc;

  if (hasSharp || hasFlat) {
    console.log(`Note ${idx}: ${note.noteName} ${accidental} - Chord: ${chord} (rootPc=${rootPc})`);
  }
});

console.log('\n✓ Test complete!');
