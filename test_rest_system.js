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

// Test 1: Generate base lick without rests
console.log('Test 1: Generate Base Lick (No Rests)');
const options = {
  scaleStrategy: 'default',
  deviceStrategy: 'neighbor-enclosure',
  swing: 0,
  insertRests: false  // Generate without rests
};

const baseLick = window.LickGen.generateLick(progression, { tempo: 120 }, options);
const baseRestCount = baseLick.filter(n => n.isRest).length;
console.log(`  Total notes: ${baseLick.length}`);
console.log(`  Rest notes: ${baseRestCount}`);
console.log(`  ${baseRestCount === 0 ? '✅' : '❌'} Expected 0 rests, got ${baseRestCount}`);

// Test 2: Apply first rest pattern
console.log('\nTest 2: Apply First Rest Pattern');
const firstRestPattern = window.LickGen.insertRandomRests(baseLick, { insertRests: true });
const firstRestCount = firstRestPattern.filter(n => n.isRest).length;
console.log(`  Total notes: ${firstRestPattern.length}`);
console.log(`  Rest notes: ${firstRestCount}`);
console.log(`  ${firstRestCount >= 2 && firstRestCount <= 3 ? '✅' : '❌'} Expected 2-3 rests, got ${firstRestCount}`);

// Test 3: Apply second rest pattern (should be different)
console.log('\nTest 3: Apply Second Rest Pattern (New Pattern)');
const secondRestPattern = window.LickGen.insertRandomRests(baseLick, { insertRests: true });
const secondRestCount = secondRestPattern.filter(n => n.isRest).length;
console.log(`  Total notes: ${secondRestPattern.length}`);
console.log(`  Rest notes: ${secondRestCount}`);
console.log(`  ${secondRestCount >= 2 && secondRestCount <= 3 ? '✅' : '❌'} Expected 2-3 rests, got ${secondRestCount}`);

// Test 4: Verify rest patterns are different
console.log('\nTest 4: Verify Rest Patterns Are Different');
const firstRestPositions = firstRestPattern
  .map((n, i) => n.isRest ? i : null)
  .filter(i => i !== null);
const secondRestPositions = secondRestPattern
  .map((n, i) => n.isRest ? i : null)
  .filter(i => i !== null);

console.log(`  First pattern rest positions: [${firstRestPositions.join(', ')}]`);
console.log(`  Second pattern rest positions: [${secondRestPositions.join(', ')}]`);

const positionsMatch = JSON.stringify(firstRestPositions) === JSON.stringify(secondRestPositions);
console.log(`  ${!positionsMatch ? '✅' : '⚠️'} Patterns are ${positionsMatch ? 'the same (could happen randomly)' : 'different'}`);

// Test 5: Verify base lick is unchanged
console.log('\nTest 5: Verify Base Lick Is Unchanged');
const baseRestCountAfter = baseLick.filter(n => n.isRest).length;
console.log(`  Base lick rest count: ${baseRestCountAfter}`);
console.log(`  ${baseRestCountAfter === 0 ? '✅' : '❌'} Base lick should still have 0 rests`);

// Test 6: Generate multiple patterns to verify randomness
console.log('\nTest 6: Generate Multiple Patterns (Verify Randomness)');
const patterns = [];
for (let i = 0; i < 5; i++) {
  const pattern = window.LickGen.insertRandomRests(baseLick, { insertRests: true });
  const positions = pattern
    .map((n, idx) => n.isRest ? idx : null)
    .filter(idx => idx !== null);
  patterns.push(positions.join(','));
}

const uniquePatterns = new Set(patterns);
console.log(`  Generated 5 patterns, ${uniquePatterns.size} unique`);
patterns.forEach((p, i) => {
  console.log(`    Pattern ${i + 1}: [${p}]`);
});
console.log(`  ${uniquePatterns.size >= 3 ? '✅' : '⚠️'} Expected variety (at least 3 unique out of 5)`);

console.log('\n✅ All tests complete!');
console.log('\nUI Workflow:');
console.log('1. Click "Generate" → Creates base lick without rests');
console.log('2. Click "New Rests" → Generates a random rest pattern');
console.log('3. Check "Show Rests" → Shows the lick with rests');
console.log('4. Uncheck "Show Rests" → Shows the original lick');
console.log('5. Click "New Rests" again → Generates a DIFFERENT rest pattern');
console.log('6. Toggle "Show Rests" → Shows/hides the new pattern');
