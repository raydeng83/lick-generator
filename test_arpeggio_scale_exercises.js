// Test arpeggio and scale exercise strategies
const fs = require('fs');
global.window = {};

// Load all modules
eval(fs.readFileSync('./web/scales.js', 'utf8'));
eval(fs.readFileSync('./web/melodic-cells.js', 'utf8'));
eval(fs.readFileSync('./web/devices-new.js', 'utf8'));
eval(fs.readFileSync('./web/generator.js', 'utf8'));

const progression = [
  { symbol: 'Dm7', bar: 0, startBeat: 0, durationBeats: 4 },
  { symbol: 'G7', bar: 1, startBeat: 4, durationBeats: 4 },
  { symbol: 'Cmaj7', bar: 2, startBeat: 8, durationBeats: 4 }
];

console.log('=== Testing Arpeggio and Scale Exercise Strategies ===\n');
console.log('Progression: Dm7 | G7 | Cmaj7\n');

// Test 1: Scale-Focused (should only generate scale-run devices)
console.log('Test 1: Scale-Focused Strategy');
console.log('Expected: Only scale-run devices\n');

for (let i = 1; i <= 3; i++) {
  const options = {
    scaleStrategy: 'default',
    deviceStrategy: 'scale-focused',
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

  console.log(`  Generation ${i}:`);
  console.log(`    Devices: ${Object.keys(devices).sort().join(', ')}`);

  // Check if only scale-run is used
  const nonScaleDevices = Object.keys(devices).filter(d => d !== 'scale-run');
  if (nonScaleDevices.length > 0) {
    console.log(`    ❌ ERROR: Found non-scale devices: ${nonScaleDevices.join(', ')}`);
  } else {
    console.log(`    ✅ Only scale-run devices used`);
  }
}

console.log('\n---\n');

// Test 2: Arpeggio + Scale Mix (should only use arpeggio and scale-run devices)
console.log('Test 2: Arpeggio + Scale Mix Strategy');
console.log('Expected: Only arpeggio and scale-run devices (random mix)\n');

const mixDeviceCounts = { arpeggio: 0, 'scale-run': 0 };

for (let i = 1; i <= 10; i++) {
  const options = {
    scaleStrategy: 'default',
    deviceStrategy: 'arpeggio-scale-mix',
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

  // Track which device types were used
  if (devices['arpeggio']) mixDeviceCounts['arpeggio']++;
  if (devices['scale-run']) mixDeviceCounts['scale-run']++;

  console.log(`  Generation ${i}:`);
  console.log(`    Devices: ${Object.keys(devices).sort().join(', ')}`);

  // Check if only arpeggio and scale-run are used
  const invalidDevices = Object.keys(devices).filter(d =>
    d !== 'arpeggio' && d !== 'scale-run'
  );

  if (invalidDevices.length > 0) {
    console.log(`    ❌ ERROR: Found invalid devices: ${invalidDevices.join(', ')}`);
  } else {
    console.log(`    ✅ Only arpeggio and scale-run devices used`);
  }
}

console.log('\n  Summary:');
console.log(`    Generations with arpeggios: ${mixDeviceCounts['arpeggio']}/10`);
console.log(`    Generations with scale-runs: ${mixDeviceCounts['scale-run']}/10`);

if (mixDeviceCounts['arpeggio'] > 0 && mixDeviceCounts['scale-run'] > 0) {
  console.log(`    ✅ Both device types were used (good variety)`);
} else if (mixDeviceCounts['arpeggio'] === 0) {
  console.log(`    ⚠️  WARNING: No arpeggios generated (should be ~50%)`);
} else if (mixDeviceCounts['scale-run'] === 0) {
  console.log(`    ⚠️  WARNING: No scale-runs generated (should be ~50%)`);
}

console.log('\n---\n');

// Test 3: Verify all three exercise modes work together
console.log('Test 3: All Three Exercise Modes');
console.log('Expected: Each mode uses only its designated device types\n');

const exerciseModes = [
  { name: 'arpeggio-focused', expected: ['arpeggio'] },
  { name: 'scale-focused', expected: ['scale-run'] },
  { name: 'arpeggio-scale-mix', expected: ['arpeggio', 'scale-run'] }
];

exerciseModes.forEach(({ name, expected }) => {
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

  const foundDevices = Object.keys(devices);
  const invalidDevices = foundDevices.filter(d => !expected.includes(d));

  console.log(`  ${name}:`);
  console.log(`    Expected: ${expected.join(', ')}`);
  console.log(`    Found: ${foundDevices.join(', ')}`);

  if (invalidDevices.length > 0) {
    console.log(`    ❌ ERROR: Invalid devices found: ${invalidDevices.join(', ')}`);
  } else {
    console.log(`    ✅ Correct device types used`);
  }
});

console.log('\n✅ All tests complete!');
console.log('\nYou can now test these new strategies in the browser at http://localhost:5173');
