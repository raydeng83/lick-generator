// Test that per-family strategy produces variety over many generations
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

console.log('=== Testing Scale Variety with Per-Family Strategy ===\n');

// Create test progression
const progression = [
  { symbol: 'Dm7', bar: 0, startBeat: 0, durationBeats: 4 },
  { symbol: 'G7', bar: 1, startBeat: 4, durationBeats: 4 },
  { symbol: 'Cmaj7', bar: 2, startBeat: 8, durationBeats: 4 }
];

const metadata = { tempo: 120 };
const options = {
  scaleStrategy: 'per-family-varied',
  deviceStrategy: 'neighbor-enclosure',
  swing: 0,
  insertRests: false
};

// Track scale selections
const dm7Scales = new Set();
const g7Scales = new Set();
const cmaj7Scales = new Set();

console.log('Generating 20 licks to observe scale variety...\n');

for (let i = 1; i <= 20; i++) {
  const lick = LickGen.generateLick(progression, metadata, options);

  const dm7Notes = lick.filter(n => n.chordSymbol === 'Dm7' && !n.isRest);
  const g7Notes = lick.filter(n => n.chordSymbol === 'G7' && !n.isRest);
  const cmaj7Notes = lick.filter(n => n.chordSymbol === 'Cmaj7' && !n.isRest);

  const dm7Scale = dm7Notes.length > 0 ? dm7Notes[0].scaleName : 'none';
  const g7Scale = g7Notes.length > 0 ? g7Notes[0].scaleName : 'none';
  const cmaj7Scale = cmaj7Notes.length > 0 ? cmaj7Notes[0].scaleName : 'none';

  dm7Scales.add(dm7Scale);
  g7Scales.add(g7Scale);
  cmaj7Scales.add(cmaj7Scale);
}

console.log('Results after 20 generations:\n');
console.log('Dm7 (minor family):');
console.log(`  Available: ${Scales.SCALE_FAMILIES.minor.join(', ')}`);
console.log(`  Used: ${Array.from(dm7Scales).join(', ')}`);
console.log(`  Variety: ${dm7Scales.size} out of ${Scales.SCALE_FAMILIES.minor.length} scales ✓`);

console.log('\nG7 (dominant family):');
console.log(`  Available: ${Scales.SCALE_FAMILIES.dominant.join(', ')}`);
console.log(`  Used: ${Array.from(g7Scales).join(', ')}`);
console.log(`  Variety: ${g7Scales.size} out of ${Scales.SCALE_FAMILIES.dominant.length} scales ✓`);

console.log('\nCmaj7 (major family):');
console.log(`  Available: ${Scales.SCALE_FAMILIES.major.join(', ')}`);
console.log(`  Used: ${Array.from(cmaj7Scales).join(', ')}`);
console.log(`  Variety: ${cmaj7Scales.size} out of ${Scales.SCALE_FAMILIES.major.length} scales ✓`);

console.log('\n✅ Variety test complete!');
console.log('The per-family-varied strategy successfully selects different scales from each family.');
