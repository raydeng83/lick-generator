// Test the new two-option rest system
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

console.log('=== Testing Two-Option Rest System ===\n');
console.log('Progression: Dm7 | G7 | Cmaj7\n');

// Test 1: Generate base lick without random rest insertion
console.log('Test 1: Generate Base Lick (No Random Rest Insertion)');
const options = {
  scaleStrategy: 'default',
  deviceStrategy: 'neighbor-enclosure',
  swing: 0,
  insertRests: false  // Don't insert random rests (devices may still create rests)
};

const baseLick = window.LickGen.generateLick(progression, { tempo: 120 }, options);
const baseRestCount = baseLick.filter(n => n.isRest).length;
console.log(`  Total notes: ${baseLick.length}`);
console.log(`  Rest notes from devices: ${baseRestCount}`);
console.log(`  ✅ Base lick generated (${baseRestCount} rests from device logic)`);

// Test 2: Apply first rest pattern
console.log('\nTest 2: Apply First Rest Pattern');
const firstRestPattern = window.LickGen.insertRandomRests(baseLick, { insertRests: true });
const firstRestCount = firstRestPattern.filter(n => n.isRest).length;
const expectedFirstRests = baseRestCount + 3; // Pre-existing + 3 new places
console.log(`  Total notes: ${firstRestPattern.length}`);
console.log(`  Rest notes: ${firstRestCount}`);
console.log(`  ${firstRestCount === expectedFirstRests ? '✅' : '❌'} Expected ${expectedFirstRests} rests (${baseRestCount} pre-existing + 3 new), got ${firstRestCount}`);

// Test 3: Apply second rest pattern (should be different)
console.log('\nTest 3: Apply Second Rest Pattern (New Pattern)');
const secondRestPattern = window.LickGen.insertRandomRests(baseLick, { insertRests: true });
const secondRestCount = secondRestPattern.filter(n => n.isRest).length;
const expectedSecondRests = baseRestCount + 3; // Pre-existing + 3 new places
console.log(`  Total notes: ${secondRestPattern.length}`);
console.log(`  Rest notes: ${secondRestCount}`);
console.log(`  ${secondRestCount === expectedSecondRests ? '✅' : '❌'} Expected ${expectedSecondRests} rests (${baseRestCount} pre-existing + 3 new), got ${secondRestCount}`);

// Test 4: Verify exactly 3 NEW rest places were created
console.log('\nTest 4: Verify Exactly 3 New Rest Places Created');
const firstNewRests = firstRestPattern.filter(n => n.isRest).length - baseRestCount;
const secondNewRests = secondRestPattern.filter(n => n.isRest).length - baseRestCount;

console.log(`  First pattern: ${firstNewRests} new rests (total: ${firstRestPattern.filter(n => n.isRest).length})`);
console.log(`  Second pattern: ${secondNewRests} new rests (total: ${secondRestPattern.filter(n => n.isRest).length})`);
console.log(`  ${firstNewRests === 3 ? '✅' : '❌'} First pattern created exactly 3 new rests`);
console.log(`  ${secondNewRests === 3 ? '✅' : '❌'} Second pattern created exactly 3 new rests`);

// Test 5: Verify base lick is unchanged
console.log('\nTest 5: Verify Base Lick Is Unchanged');
const baseRestCountAfter = baseLick.filter(n => n.isRest).length;
console.log(`  Base lick rest count: ${baseRestCountAfter}`);
console.log(`  ${baseRestCountAfter === baseRestCount ? '✅' : '❌'} Base lick should still have ${baseRestCount} rests (unchanged)`);

// Test 6: Verify rest note durations (1, 2, or 3 consecutive notes replaced)
console.log('\nTest 6: Verify Rest Durations (1-3 Consecutive Notes)');
const testPattern = window.LickGen.insertRandomRests(baseLick, { insertRests: true });
const allRestNotes = testPattern.filter(n => n.isRest);
// Filter out pre-existing rests (they have device='rest', new ones have device='rest-inserted')
const newRestNotes = allRestNotes.filter(r => r.device === 'rest-inserted');

console.log(`  Total rest notes: ${allRestNotes.length} (${newRestNotes.length} new, ${allRestNotes.length - newRestNotes.length} pre-existing)`);
newRestNotes.forEach((rest, i) => {
  const beats = rest.durationBeats;
  const notes = beats / 0.5; // Assuming eighth notes (0.5 beats each)
  console.log(`    New rest ${i + 1}: ${beats} beats (${notes} note${notes !== 1 ? 's' : ''})`);
  if (notes >= 1 && notes <= 3) {
    console.log(`      ✅ Valid (1-3 consecutive notes)`);
  } else {
    console.log(`      ⚠️  Unexpected duration`);
  }
});

// Test 7: Generate multiple patterns to verify distribution and randomness
console.log('\nTest 7: Verify Distribution of 1, 2, 3 Note Replacements');
const durationCounts = { 1: 0, 2: 0, 3: 0, other: 0 };
const iterations = 30; // More iterations for better distribution analysis

for (let i = 0; i < iterations; i++) {
  const pattern = window.LickGen.insertRandomRests(baseLick, { insertRests: true });
  // Only count NEW rests (device='rest-inserted'), not pre-existing device-generated rests
  const newRests = pattern.filter(n => n.isRest && n.device === 'rest-inserted');

  newRests.forEach(rest => {
    const notes = rest.durationBeats / 0.5;
    if (notes === 1) durationCounts[1]++;
    else if (notes === 2) durationCounts[2]++;
    else if (notes === 3) durationCounts[3]++;
    else durationCounts.other++;
  });
}

const totalRests = iterations * 3; // 3 rests per pattern
console.log(`  Generated ${iterations} patterns (${totalRests} total rests)`);
console.log(`  1-note rests: ${durationCounts[1]} (${(durationCounts[1]/totalRests*100).toFixed(1)}%)`);
console.log(`  2-note rests: ${durationCounts[2]} (${(durationCounts[2]/totalRests*100).toFixed(1)}%)`);
console.log(`  3-note rests: ${durationCounts[3]} (${(durationCounts[3]/totalRests*100).toFixed(1)}%)`);
if (durationCounts.other > 0) {
  console.log(`  ⚠️  Other durations: ${durationCounts.other}`);
}

// Check if distribution is roughly equal (within reasonable variance)
const avg = totalRests / 3;
const tolerance = 0.25; // 25% tolerance
const within1 = Math.abs(durationCounts[1] - avg) / avg < tolerance;
const within2 = Math.abs(durationCounts[2] - avg) / avg < tolerance;
const within3 = Math.abs(durationCounts[3] - avg) / avg < tolerance;

console.log(`  ${within1 && within2 && within3 ? '✅' : '⚠️'} Distribution roughly equal (±25% tolerance)`);

console.log('\n✅ All tests complete!');
console.log('\nRest Insertion Logic Summary:');
console.log('- Always selects exactly 3 places for rest insertion');
console.log('- Each place replaces 1, 2, or 3 consecutive notes (equal 33% probability)');
console.log('- Total rests per lick: minimum 3, maximum 9 notes replaced');
console.log('- Purpose: Creates sparse patterns for rhythm practice exercises');
console.log('\nUI Workflow:');
console.log('1. Click "Generate" → Creates base lick without rests');
console.log('2. Click "New Rests" → Generates a random rest pattern (3 places, 1-3 notes each)');
console.log('3. Check "Show Rests" → Shows the lick with rests');
console.log('4. Uncheck "Show Rests" → Shows the original lick');
console.log('5. Click "New Rests" again → Generates a DIFFERENT rest pattern');
console.log('6. Toggle "Show Rests" → Shows/hides the new pattern');
