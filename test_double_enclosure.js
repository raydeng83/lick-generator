// Test double enclosure pattern

const fs = require('fs');

// Load modules
const generatorCode = fs.readFileSync('./web/generator.js', 'utf8');
const scalesCode = fs.readFileSync('./web/scales.js', 'utf8');
const melodicCellsCode = fs.readFileSync('./web/melodic-cells.js', 'utf8');
const devicesCode = fs.readFileSync('./web/devices-new.js', 'utf8');

// Setup window namespace
global.window = {
  LickGen: null,
  Scales: null,
  MelodicCells: null,
  DevicesNew: null
};

// Load modules
eval(scalesCode);
eval(melodicCellsCode);
eval(devicesCode);
eval(generatorCode);

const { LickGen } = global.window;

// Test progression
const progression = [
  { bar: 0, startBeat: 0, durationBeats: 4, symbol: 'Dm7' },
  { bar: 1, startBeat: 4, durationBeats: 4, symbol: 'G7' },
  { bar: 2, startBeat: 8, durationBeats: 4, symbol: 'Cmaj7' }
];

const metadata = { tempo: 120 };

console.log('Testing double enclosure pattern\n');

const lick = LickGen.generateLick(progression, metadata, {
  deviceStrategy: 'neighbor-enclosure',
  swing: 0
});

console.log('Generated lick with', lick.length, 'notes\n');

// Analyze each measure
for (let bar = 0; bar < 3; bar++) {
  const measureNotes = lick.filter(n =>
    n.startBeat >= bar * 4 && n.startBeat < (bar + 1) * 4
  );

  console.log(`=== Measure ${bar + 1} (${progression[bar].symbol}) ===`);
  console.log(`Total notes: ${measureNotes.length}`);

  // Show note structure
  console.log('\nNote structure:');
  measureNotes.forEach((note, idx) => {
    const slot = Math.floor((note.startBeat - bar * 4) / 0.5);
    console.log(`  Slot ${slot} (beat ${note.startBeat.toFixed(1)}): midi=${note.midi}, device=${note.device || 'unknown'}, ruleId=${note.ruleId || 'N/A'}`);
  });

  // Count enclosure notes
  const enclosureNotes = measureNotes.filter(n => n.device === 'enclosure');
  console.log(`\nEnclosure notes: ${enclosureNotes.length}`);

  // Count target notes
  const targetNotes = measureNotes.filter(n => n.ruleId === 'chord-tone');
  console.log(`Target notes (chord tones): ${targetNotes.length}`);

  // Check structure
  const hasSlot0Target = measureNotes[0]?.ruleId === 'chord-tone';
  const hasSlot5Target = measureNotes[5]?.ruleId === 'chord-tone';
  const hasEnclosureAt34 = measureNotes[3]?.device === 'enclosure' && measureNotes[4]?.device === 'enclosure';
  const hasEnclosureAt67 = measureNotes[6]?.device === 'enclosure' && measureNotes[7]?.device === 'enclosure';

  console.log(`\nStructure validation:`);
  console.log(`  Slot 0 is target: ${hasSlot0Target ? '✓' : '✗'}`);
  console.log(`  Slots 3-4 are enclosure: ${hasEnclosureAt34 ? '✓' : '✗'}`);
  console.log(`  Slot 5 is target: ${hasSlot5Target ? '✓' : '✗'}`);
  console.log(`  Slots 6-7 are enclosure: ${hasEnclosureAt67 ? '✓' : '✗'}`);

  console.log('');
}

// Save output
fs.writeFileSync('./lick_output_double_enclosure.json', JSON.stringify(lick, null, 2));
console.log('Output saved to lick_output_double_enclosure.json');
console.log('\n✓ Test complete!');
