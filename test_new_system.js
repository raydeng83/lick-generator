// Test new generation system (simple version without JSDOM)
const fs = require('fs');

// Create fake global objects
global.window = {};

// Make Math.random deterministic for testing
let seed = 12345;
Math.random = function() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
};

function loadScript(path) {
  const content = fs.readFileSync(path, 'utf-8');
  eval(content);
}

// Load all modules
console.log('Loading modules...');
loadScript('web/schema.js');
loadScript('web/scales.js');
loadScript('web/melodic-cells.js');
loadScript('web/devices.js');
loadScript('web/variations.js');
loadScript('web/devices-new.js');
loadScript('web/generator.js');

// Make modules available as globals
global.Schema = window.Schema;
global.Scales = window.Scales;
global.MelodicCells = window.MelodicCells;
global.Devices = window.Devices;
global.Variations = window.Variations;
global.DevicesNew = window.DevicesNew;
global.LickGen = window.LickGen;

console.log('✓ All modules loaded\n');

// Test progression: Dm7 | G7 | Cmaj7
const prog = [
  { bar: 0, symbol: 'Dm7', startBeat: 0, durationBeats: 4 },
  { bar: 1, symbol: 'G7', startBeat: 4, durationBeats: 4 },
  { bar: 2, symbol: 'Cmaj7', startBeat: 8, durationBeats: 4 },
];

const meta = { tempo: 100, key: 'C', timeSignature: [4, 4] };

const options = {
  scaleStrategy: 'default',
  deviceStrategy: 'varied',
  startPitch: 69, // A4
};

console.log('=== Testing New Generation System ===\n');
console.log('Progression: Dm7 | G7 | Cmaj7');
console.log('Device Strategy:', options.deviceStrategy);
console.log('');

// Generate lick
const lick = window.LickGen.generateLick(prog, meta, options);

console.log('\n=== Generation Results ===\n');
console.log('Total notes generated:', lick.length);
console.log('');

// Analyze by measure
for (let bar = 0; bar < 3; bar++) {
  const measureNotes = lick.filter(n => n.startBeat >= bar * 4 && n.startBeat < (bar + 1) * 4);
  const chord = prog[bar].symbol;

  console.log(`\n--- Measure ${bar + 1}: ${chord} ---`);
  console.log(`  Note count: ${measureNotes.length}`);

  // Check if device was used
  if (measureNotes.length > 0 && measureNotes[0].device) {
    console.log(`  Device: ${measureNotes[0].device}`);
  }

  // Show first few notes
  console.log('  Notes:');
  measureNotes.slice(0, 4).forEach((note, i) => {
    console.log(`    [${i}] Beat ${note.startBeat}: MIDI ${note.midi} (${note.ruleId || note.harmonicFunction}) ${note.degree ? `deg=${note.degree}` : ''}`);
  });

  if (measureNotes.length > 4) {
    console.log(`    ... and ${measureNotes.length - 4} more notes`);
  }
}

// Save output
fs.writeFileSync('lick_output_new.json', JSON.stringify(lick, null, 2));
console.log('\n✓ Saved output to lick_output_new.json');

console.log('\n=== Test Complete ===');
