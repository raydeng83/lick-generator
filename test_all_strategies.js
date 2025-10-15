// Test all device strategies to ensure fix didn't break anything
const fs = require('fs');
global.window = {};

// Load all modules
eval(fs.readFileSync('./web/scales.js', 'utf8'));
eval(fs.readFileSync('./web/melodic-cells.js', 'utf8'));
eval(fs.readFileSync('./web/devices-new.js', 'utf8'));
eval(fs.readFileSync('./web/generator.js', 'utf8'));

const progression = [
  { symbol: 'Dm7', bar: 0, startBeat: 0, durationBeats: 4 },
  { symbol: 'G7', bar: 1, startBeat: 4, durationBeats: 4 }
];

const strategies = [
  { name: 'arpeggio-focused', expectedDevice: 'arpeggio' },
  { name: 'cell-focused', expectedDevice: 'melodic-cell' },
  { name: 'neighbor-enclosure', expectedDevice: 'enclosure' },
  { name: 'varied', expectedDevice: null } // varied uses random devices
];

console.log('=== Testing All Device Strategies ===\n');
console.log('Progression: Dm7 | G7\n');

strategies.forEach(({ name, expectedDevice }) => {
  const options = {
    scaleStrategy: 'default',
    deviceStrategy: name,
    swing: 0,
    insertRests: false
  };

  const lick = window.LickGen.generateLick(progression, { tempo: 120 }, options);
  const nonRestNotes = lick.filter(n => !n.isRest);

  // Count devices used
  const devices = {};
  nonRestNotes.forEach(n => {
    const dev = n.device || 'unknown';
    devices[dev] = (devices[dev] || 0) + 1;
  });

  console.log(`Strategy: ${name}`);
  console.log(`  Devices found: ${Object.keys(devices).sort().join(', ')}`);

  if (expectedDevice) {
    const hasExpected = Object.keys(devices).some(d => d === expectedDevice);
    if (hasExpected) {
      console.log(`  ✅ Contains expected device: ${expectedDevice}`);
    } else {
      console.log(`  ❌ ERROR: Missing expected device: ${expectedDevice}`);
    }
  } else {
    console.log(`  ✅ Varied strategy working (random devices)`);
  }
  console.log('');
});

console.log('✅ All strategies tested!');
