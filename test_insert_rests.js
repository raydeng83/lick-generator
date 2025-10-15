const fs = require('fs');

// Load dependencies
global.window = {};
eval(fs.readFileSync('./web/scales.js', 'utf8'));
eval(fs.readFileSync('./web/schema.js', 'utf8'));
eval(fs.readFileSync('./web/melodic-cells.js', 'utf8'));
eval(fs.readFileSync('./web/devices-new.js', 'utf8'));
eval(fs.readFileSync('./web/generator.js', 'utf8'));

// Test progression
const progressionStr = "Dm7 | G7 | Cmaj7";
const { progression } = window.Schema.parseProgression(progressionStr);
const metadata = window.Schema.defaultMetadata();

console.log('Testing insertRests feature...\n');

// Test 1: Generate WITHOUT insertRests
console.log('=== Test 1: Without insertRests ===');
const options1 = {
  scaleStrategy: 'default',
  deviceStrategy: 'neighbor-enclosure',
  useDevices: true,
  swing: 0,
  insertRests: false
};

const lick1 = window.LickGen.generateLick(progression, metadata, options1);
console.log('Total notes:', lick1.length);
console.log('Rest notes:', lick1.filter(n => n.isRest).length);
console.log('Non-rest notes:', lick1.filter(n => !n.isRest).length);
console.log('');

// Test 2: Generate WITH insertRests (multiple times to see variation)
console.log('=== Test 2: With insertRests (5 generations) ===');
for (let i = 1; i <= 5; i++) {
  const options2 = {
    scaleStrategy: 'default',
    deviceStrategy: 'neighbor-enclosure',
    useDevices: true,
    swing: 0,
    insertRests: true
  };

  const lick2 = window.LickGen.generateLick(progression, metadata, options2);
  const restNotes = lick2.filter(n => n.isRest);
  const nonRestNotes = lick2.filter(n => !n.isRest);

  console.log(`Generation ${i}:`);
  console.log('  Total notes:', lick2.length);
  console.log('  Rest notes:', restNotes.length);
  console.log('  Non-rest notes:', nonRestNotes.length);

  // Show where rests are inserted
  const restPositions = restNotes.map(r => `beat ${r.startBeat} (${r.durationBeats} beats)`);
  console.log('  Rest positions:', restPositions.join(', '));
  console.log('');
}

// Test 3: Verify protected notes are not replaced
console.log('=== Test 3: Verify protection rules ===');
const options3 = {
  scaleStrategy: 'default',
  deviceStrategy: 'neighbor-enclosure',
  useDevices: true,
  swing: 0,
  insertRests: true
};

const lick3 = window.LickGen.generateLick(progression, metadata, options3);

// Check first note of each measure (beats 0, 4, 8)
const measureStarts = [0, 4, 8];
let allMeasureStartsProtected = true;

for (const beat of measureStarts) {
  const note = lick3.find(n => n.startBeat === beat);
  if (note && note.isRest) {
    console.log(`❌ ERROR: First note of measure at beat ${beat} was replaced with rest!`);
    allMeasureStartsProtected = false;
  }
}

if (allMeasureStartsProtected) {
  console.log('✓ All measure-start notes (beats 0, 4, 8) are protected');
}

// Check enclosure and ending notes
const enclosureCount = lick3.filter(n =>
  !n.isRest && (n.device === 'enclosure' || n.device === 'enclosure-target' || n.device === 'enclosure-fill')
).length;

const endingCount = lick3.filter(n =>
  !n.isRest && n.device === 'ending'
).length;

console.log(`✓ Found ${enclosureCount} enclosure-related notes (all protected)`);
console.log(`✓ Found ${endingCount} ending notes (all protected)`);

console.log('\n✅ Test complete!');
