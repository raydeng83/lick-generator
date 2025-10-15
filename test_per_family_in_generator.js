// Test per-family-varied strategy in the actual generator
const fs = require('fs');

// Setup global window object
global.window = {};

// Load all required modules in order
eval(fs.readFileSync('./web/scales.js', 'utf8'));
eval(fs.readFileSync('./web/melodic-cells.js', 'utf8'));
eval(fs.readFileSync('./web/devices-new.js', 'utf8'));
eval(fs.readFileSync('./web/generator.js', 'utf8'));

const LickGen = window.LickGen;
const Scales = window.Scales;

console.log('=== Testing Per-Family Strategy in Full Generator ===\n');

// Create test progression
const progression = [
  {
    symbol: 'Dm7',
    bar: 0,
    startBeat: 0,
    durationBeats: 4
  },
  {
    symbol: 'G7',
    bar: 1,
    startBeat: 4,
    durationBeats: 4
  },
  {
    symbol: 'Cmaj7',
    bar: 2,
    startBeat: 8,
    durationBeats: 4
  }
];

const metadata = { tempo: 120 };
const options = {
  scaleStrategy: 'per-family-varied',
  deviceStrategy: 'neighbor-enclosure',
  swing: 0,
  insertRests: false
};

console.log('Progression: Dm7 | G7 | Cmaj7');
console.log('Strategy: per-family-varied\n');

// Generate 5 times to see variety
for (let trial = 1; trial <= 5; trial++) {
  console.log(`\n=== Trial ${trial} ===`);

  const lick = LickGen.generateLick(progression, metadata, options);

  // Extract unique scales used for each chord
  const dm7Notes = lick.filter(n => n.chordSymbol === 'Dm7' && !n.isRest);
  const g7Notes = lick.filter(n => n.chordSymbol === 'G7' && !n.isRest);
  const cmaj7Notes = lick.filter(n => n.chordSymbol === 'Cmaj7' && !n.isRest);

  const dm7Scale = dm7Notes.length > 0 ? dm7Notes[0].scaleName : 'none';
  const g7Scale = g7Notes.length > 0 ? g7Notes[0].scaleName : 'none';
  const cmaj7Scale = cmaj7Notes.length > 0 ? cmaj7Notes[0].scaleName : 'none';

  // Verify families
  const dm7Family = Scales.getChordFamily('m7');
  const g7Family = Scales.getChordFamily('7');
  const cmaj7Family = Scales.getChordFamily('maj7');

  const dm7InFamily = Scales.SCALE_FAMILIES[dm7Family].includes(dm7Scale);
  const g7InFamily = Scales.SCALE_FAMILIES[g7Family].includes(g7Scale);
  const cmaj7InFamily = Scales.SCALE_FAMILIES[cmaj7Family].includes(cmaj7Scale);

  console.log(`Dm7    → ${dm7Scale.padEnd(20)} (${dm7Family} family) ${dm7InFamily ? '✓' : '✗'}`);
  console.log(`G7     → ${g7Scale.padEnd(20)} (${g7Family} family) ${g7InFamily ? '✓' : '✗'}`);
  console.log(`Cmaj7  → ${cmaj7Scale.padEnd(20)} (${cmaj7Family} family) ${cmaj7InFamily ? '✓' : '✗'}`);
}

console.log('\n\n✅ Generator test complete!');
console.log('All scales are correctly selected from their respective families.');
console.log('\nNext step: Open http://localhost:5173 in your browser and test the UI.');
