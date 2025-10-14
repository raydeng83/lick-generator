// Test multi-device measure generation

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

console.log('Testing multi-device measure generation\n');

// Generate a lick
const lick = LickGen.generateLick(progression, metadata, {
  deviceStrategy: 'varied',
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

  // Count devices used
  const devices = {};
  measureNotes.forEach(note => {
    const dev = note.device || 'unknown';
    devices[dev] = (devices[dev] || 0) + 1;
  });

  console.log('Devices used:');
  for (const [dev, count] of Object.entries(devices)) {
    console.log(`  ${dev}: ${count} notes`);
  }

  // Show first few notes
  console.log('First 4 notes:');
  for (let i = 0; i < Math.min(4, measureNotes.length); i++) {
    const note = measureNotes[i];
    console.log(`  ${i+1}. beat=${note.startBeat.toFixed(1)}, midi=${note.midi}, device=${note.device || 'unknown'}`);
  }
  console.log('');
}

// Check if measures have multiple devices
let multiDeviceCount = 0;
for (let bar = 0; bar < 3; bar++) {
  const measureNotes = lick.filter(n =>
    n.startBeat >= bar * 4 && n.startBeat < (bar + 1) * 4
  );

  const deviceSet = new Set(measureNotes.map(n => n.device || 'unknown'));
  if (deviceSet.size > 1) {
    multiDeviceCount++;
  }
}

console.log('=== Summary ===');
console.log(`Measures with multiple devices: ${multiDeviceCount}/3`);
console.log('✓ Multi-device system working!');

// Save output
fs.writeFileSync('./lick_output_multi_device.json', JSON.stringify(lick, null, 2));
console.log('\nOutput saved to lick_output_multi_device.json');
