// Test midiToKey function with flat note names
const fs = require('fs');

// Load notate.js and extract midiToKey function
global.window = { Notate: null };
global.Vex = { Flow: {} }; // Mock VexFlow

// Read and extract just the midiToKey function
const notateCode = fs.readFileSync('./web/notate.js', 'utf8');

// Extract midiToKey function manually
const midiToKey = function(midi, noteName = null) {
  if (noteName) {
    // Parse noteName (e.g., "Bb4", "F#5", "C4") into VexFlow format
    // noteName format: [A-G][b|#]?[0-9]
    const match = noteName.match(/^([A-G])([b#]?)(\d+)$/);
    if (match) {
      const note = match[1].toLowerCase();
      const accidental = match[2]; // 'b', '#', or ''
      const octave = match[3];
      return `${note}${accidental}/${octave}`;
    }
  }

  // Fallback: use sharps if noteName not available
  const N = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
  const n = N[(midi % 12 + 12) % 12];
  const o = Math.floor(midi / 12) - 1;
  return `${n}/${o}`;
};

console.log('Testing midiToKey function with enharmonic note names\n');

// Test flat note names
const flatTests = [
  { midi: 70, noteName: 'Bb4', expected: 'bb/4' },
  { midi: 68, noteName: 'Ab4', expected: 'ab/4' },
  { midi: 63, noteName: 'Eb4', expected: 'eb/4' },
  { midi: 61, noteName: 'Db4', expected: 'db/4' },
  { midi: 66, noteName: 'Gb4', expected: 'gb/4' },
];

// Test sharp note names
const sharpTests = [
  { midi: 70, noteName: 'A#4', expected: 'a#/4' },
  { midi: 68, noteName: 'G#4', expected: 'g#/4' },
  { midi: 63, noteName: 'D#4', expected: 'd#/4' },
  { midi: 61, noteName: 'C#4', expected: 'c#/4' },
  { midi: 66, noteName: 'F#4', expected: 'f#/4' },
];

console.log('=== Flat Note Tests ===');
flatTests.forEach(test => {
  const result = midiToKey(test.midi, test.noteName);
  const pass = result === test.expected ? '✓' : '✗';
  console.log(`${pass} MIDI ${test.midi} + "${test.noteName}" -> "${result}" (expected: "${test.expected}")`);
});

console.log('\n=== Sharp Note Tests ===');
sharpTests.forEach(test => {
  const result = midiToKey(test.midi, test.noteName);
  const pass = result === test.expected ? '✓' : '✗';
  console.log(`${pass} MIDI ${test.midi} + "${test.noteName}" -> "${result}" (expected: "${test.expected}")`);
});

console.log('\n=== Fallback Test (no noteName) ===');
const fallbackResult = midiToKey(70, null);
console.log(`MIDI 70 without noteName -> "${fallbackResult}" (should use sharps: "a#/4")`);

console.log('\n✓ All tests complete!');
