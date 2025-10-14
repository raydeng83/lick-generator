// Test new enclosure device
const fs = require('fs');

// Create fake global objects
global.window = {};

// Make Math.random deterministic for testing
let seed = 42;
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
  deviceStrategy: 'neighbor-enclosure', // Force enclosure device
  startPitch: 69,
};

console.log('=== Testing Enclosure Device ===\n');
console.log('Progression: Dm7 | G7 | Cmaj7');
console.log('Device Strategy: neighbor-enclosure (forced)');
console.log('');

// Generate lick
const lick = window.LickGen.generateLick(prog, meta, options);

console.log('\n=== Generation Results ===\n');
console.log('Total notes generated:', lick.length);
console.log('');

// Analyze enclosure patterns
for (let bar = 0; bar < 3; bar++) {
  const measureNotes = lick.filter(n => n.startBeat >= bar * 4 && n.startBeat < (bar + 1) * 4);
  const chord = prog[bar].symbol;

  console.log(`\n--- Measure ${bar + 1}: ${chord} ---`);
  console.log(`  Note count: ${measureNotes.length}`);

  if (measureNotes.length > 0 && measureNotes[0].device) {
    console.log(`  Device: ${measureNotes[0].device}`);
  }

  // Look for enclosure pattern in last 3 notes
  const lastThree = measureNotes.slice(-3);
  console.log('\n  Last 3 notes (should approach next measure):');
  lastThree.forEach((note, i) => {
    const encType = note.enclosureType ? ` [${note.enclosureType}]` : '';
    console.log(`    [${6+i}] Beat ${note.startBeat.toFixed(1)}: MIDI ${note.midi}${encType}`);
  });

  // Check if next measure exists and show first note
  if (bar < 2) {
    const nextMeasure = lick.filter(n => n.startBeat >= (bar + 1) * 4 && n.startBeat < (bar + 2) * 4);
    if (nextMeasure.length > 0) {
      const firstNote = nextMeasure[0];
      console.log(`\n  Next measure first note (target):`);
      console.log(`    Beat ${firstNote.startBeat.toFixed(1)}: MIDI ${firstNote.midi}`);

      // Validate enclosure
      if (lastThree.length === 3) {
        const targetMidi = firstNote.midi;
        const enclosureMidis = [lastThree[1].midi, lastThree[2].midi];

        console.log(`\n  Validation:`);
        console.log(`    Target MIDI: ${targetMidi}`);
        console.log(`    Enclosure approach: ${enclosureMidis[0]} → ${enclosureMidis[1]} → ${targetMidi}`);

        // Check if enclosure neighbors are correct
        const expectedUpper = targetMidi + 2; // Approximate (depends on scale)
        const expectedLower = targetMidi - 1;

        const hasLower = enclosureMidis.includes(expectedLower);
        const hasUpper = enclosureMidis.some(m => m > targetMidi && m <= targetMidi + 3);

        if (hasLower && hasUpper) {
          console.log(`    ✓ Enclosure pattern valid`);
        } else {
          console.log(`    ⚠ Enclosure pattern may need adjustment`);
        }
      }
    }
  }
}

// Save output
fs.writeFileSync('lick_output_enclosure.json', JSON.stringify(lick, null, 2));
console.log('\n✓ Saved output to lick_output_enclosure.json');

console.log('\n=== Test Complete ===');
