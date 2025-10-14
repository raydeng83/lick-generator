// Comprehensive test of enharmonic spelling for all key types
const fs = require('fs');

// Load dependencies
global.window = {};
eval(fs.readFileSync('./web/scales.js', 'utf8'));
eval(fs.readFileSync('./web/melodic-cells.js', 'utf8'));
eval(fs.readFileSync('./web/devices-new.js', 'utf8'));
eval(fs.readFileSync('./web/generator.js', 'utf8'));

console.log('Comprehensive Enharmonic Spelling Test\n');
console.log('=' .repeat(60));

// Test cases for each key type
const testCases = [
  {
    name: 'C Major (Flat Key)',
    progression: [{ bar: 0, startBeat: 0, durationBeats: 4, symbol: 'Cmaj7' }],
    expected: 'flats',
    rootPc: 0
  },
  {
    name: 'F Major (Flat Key)',
    progression: [{ bar: 0, startBeat: 0, durationBeats: 4, symbol: 'Fmaj7' }],
    expected: 'flats',
    rootPc: 5
  },
  {
    name: 'Bb Major (Flat Key)',
    progression: [{ bar: 0, startBeat: 0, durationBeats: 4, symbol: 'Bbmaj7' }],
    expected: 'flats',
    rootPc: 10
  },
  {
    name: 'Eb Major (Flat Key)',
    progression: [{ bar: 0, startBeat: 0, durationBeats: 4, symbol: 'Ebmaj7' }],
    expected: 'flats',
    rootPc: 3
  },
  {
    name: 'G Major (Sharp Key)',
    progression: [{ bar: 0, startBeat: 0, durationBeats: 4, symbol: 'Gmaj7' }],
    expected: 'sharps',
    rootPc: 7
  },
  {
    name: 'D Major (Sharp Key)',
    progression: [{ bar: 0, startBeat: 0, durationBeats: 4, symbol: 'Dmaj7' }],
    expected: 'sharps',
    rootPc: 2
  },
  {
    name: 'A Major (Sharp Key)',
    progression: [{ bar: 0, startBeat: 0, durationBeats: 4, symbol: 'Amaj7' }],
    expected: 'sharps',
    rootPc: 9
  },
];

const metadata = { title: 'Test', tempo: 120 };
const options = { deviceStrategy: 'arpeggio-focused', swing: 0 };

testCases.forEach(test => {
  const lick = window.LickGen.generateLick(test.progression, metadata, options);

  let sharpCount = 0;
  let flatCount = 0;

  lick.forEach(note => {
    if (note.noteName && note.noteName.includes('#')) sharpCount++;
    if (note.noteName && note.noteName.includes('b')) flatCount++;
  });

  const result = sharpCount > 0 && flatCount === 0 ? 'sharps' :
                 flatCount > 0 && sharpCount === 0 ? 'flats' :
                 sharpCount === 0 && flatCount === 0 ? 'none' : 'mixed';

  const pass = result === test.expected || (result === 'none' && test.expected);
  const symbol = pass ? '✓' : '✗';

  console.log(`${symbol} ${test.name.padEnd(25)} | Expected: ${test.expected.padEnd(6)} | Got: ${result.padEnd(6)} | (♯:${sharpCount} ♭:${flatCount})`);
});

console.log('=' .repeat(60));
console.log('\n✓ All tests complete!');
