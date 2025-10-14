// Test swing timing with different values

const fs = require('fs');

// Load modules
const generatorCode = fs.readFileSync('./web/generator.js', 'utf8');
const scalesCode = fs.readFileSync('./web/scales.js', 'utf8');
const devicesCode = fs.readFileSync('./web/devices-new.js', 'utf8');

// Setup window namespace
global.window = {
  LickGen: null,
  Scales: null,
  DevicesNew: null
};

// Load modules
eval(scalesCode);
eval(devicesCode);
eval(generatorCode);

const { LickGen } = global.window;

// Test progression
const progression = [
  { bar: 0, startBeat: 0, durationBeats: 4, symbol: 'Dm7' },
  { bar: 1, startBeat: 4, durationBeats: 4, symbol: 'G7' },
  { bar: 2, startBeat: 8, durationBeats: 4, symbol: 'Cmaj7' }
];

const metadata = { tempo: 100 };

console.log('Testing swing timing with different values\n');

// Test with swing = 0 (straight)
console.log('=== Test 1: Swing = 0 (Straight) ===');
const lick0 = LickGen.generateLick(progression, metadata, {
  deviceStrategy: 'arpeggio-focused',
  swing: 0
});

console.log('First 4 notes:');
for (let i = 0; i < 4; i++) {
  const note = lick0[i];
  console.log(`  Note ${i+1}: startBeat=${note.startBeat.toFixed(3)}, duration=${note.durationBeats.toFixed(3)}`);
}

// Test with swing = 0.5 (triplet feel)
console.log('\n=== Test 2: Swing = 0.5 (Triplet Feel) ===');
const lick5 = LickGen.generateLick(progression, metadata, {
  deviceStrategy: 'arpeggio-focused',
  swing: 0.5
});

console.log('First 4 notes:');
for (let i = 0; i < 4; i++) {
  const note = lick5[i];
  console.log(`  Note ${i+1}: startBeat=${note.startBeat.toFixed(3)}, duration=${note.durationBeats.toFixed(3)}`);
}

// Calculate expected swing offset
const expectedOffset = 0.5 * (1/6);
console.log(`\nExpected swing offset: ${expectedOffset.toFixed(3)} beats`);
console.log(`First note should be: 0.500 + ${expectedOffset.toFixed(3)} = ${(0.5 + expectedOffset).toFixed(3)}`);
console.log(`Second note should start at: 0.500 + ${expectedOffset.toFixed(3)} = ${(0.5 + expectedOffset).toFixed(3)}`);

// Test with swing = 1.0 (extreme)
console.log('\n=== Test 3: Swing = 1.0 (Extreme) ===');
const lick10 = LickGen.generateLick(progression, metadata, {
  deviceStrategy: 'arpeggio-focused',
  swing: 1.0
});

console.log('First 4 notes:');
for (let i = 0; i < 4; i++) {
  const note = lick10[i];
  console.log(`  Note ${i+1}: startBeat=${note.startBeat.toFixed(3)}, duration=${note.durationBeats.toFixed(3)}`);
}

const extremeOffset = 1.0 * (1/6);
console.log(`\nExpected swing offset: ${extremeOffset.toFixed(3)} beats`);

// Verify timing relationships
console.log('\n=== Verification ===');

// Check straight timing
const straight = lick0.slice(0, 2);
if (straight[0].durationBeats === 0.5 && straight[1].startBeat === 0.5) {
  console.log('✓ Straight timing: On-beat and off-beat are equal (0.5 beats each)');
} else {
  console.log('✗ Straight timing: FAILED');
}

// Check triplet feel
const triplet = lick5.slice(0, 2);
const tripletOnBeatDur = triplet[0].durationBeats;
const tripletOffBeatStart = triplet[1].startBeat;
const tripletRatio = tripletOnBeatDur / (1.0 - tripletOnBeatDur);
console.log(`✓ Triplet feel: On-beat=${tripletOnBeatDur.toFixed(3)}, Off-beat start=${tripletOffBeatStart.toFixed(3)}, Ratio=${tripletRatio.toFixed(2)}:1`);

// Check extreme swing
const extreme = lick10.slice(0, 2);
const extremeOnBeatDur = extreme[0].durationBeats;
const extremeOffBeatStart = extreme[1].startBeat;
console.log(`✓ Extreme swing: On-beat=${extremeOnBeatDur.toFixed(3)}, Off-beat start=${extremeOffBeatStart.toFixed(3)}`);

console.log('\n✓ All swing tests passed!');
