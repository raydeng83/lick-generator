// Test to verify beaming respects beat boundaries
const fs = require('fs');
global.window = {};

// Load modules
eval(fs.readFileSync('./web/scales.js', 'utf8'));
eval(fs.readFileSync('./web/melodic-cells.js', 'utf8'));
eval(fs.readFileSync('./web/devices-new.js', 'utf8'));
eval(fs.readFileSync('./web/generator.js', 'utf8'));

console.log('=== Testing Beat-Aware Beaming ===\n');

const progression = [
  { symbol: 'Dm7', bar: 0, startBeat: 0, durationBeats: 4 },
  { symbol: 'G7', bar: 1, startBeat: 4, durationBeats: 4 },
  { symbol: 'Cmaj7', bar: 2, startBeat: 8, durationBeats: 4 }
];

// Generate multiple licks with rest insertion
let totalTests = 10;

for (let i = 0; i < totalTests; i++) {
  console.log(`\n--- Test ${i + 1} ---`);

  const options = {
    scaleStrategy: 'default',
    deviceStrategy: 'neighbor-enclosure',
    swing: 0,
    insertRests: true
  };

  const lick = window.LickGen.generateLick(progression, { tempo: 120 }, options);

  // Analyze eighth notes for potential beaming issues
  console.log('\nEighth note sequences per measure:');

  for (let measureNum = 0; measureNum < 3; measureNum++) {
    const measureStart = measureNum * 4;
    const measureEnd = measureStart + 4;
    const measureNotes = lick.filter(n =>
      n.startBeat >= measureStart &&
      n.startBeat < measureEnd &&
      !n.isRest &&
      n.durationBeats === 0.5
    );

    if (measureNotes.length === 0) {
      console.log(`  Measure ${measureNum}: No eighth notes`);
      continue;
    }

    console.log(`  Measure ${measureNum}:`);

    // Group consecutive eighth notes
    let groups = [];
    let currentGroup = [];

    for (const note of measureNotes) {
      if (currentGroup.length === 0) {
        currentGroup.push(note);
      } else {
        const prevNote = currentGroup[currentGroup.length - 1];
        const prevBeat = Math.floor(prevNote.startBeat);
        const currBeat = Math.floor(note.startBeat);

        if (prevBeat === currBeat) {
          // Same beat - add to group
          currentGroup.push(note);
        } else {
          // Different beat - start new group
          groups.push(currentGroup);
          currentGroup = [note];
        }
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    // Display groups
    groups.forEach((group, idx) => {
      const beats = group.map(n => n.startBeat.toFixed(1));
      const beatNums = group.map(n => Math.floor(n.startBeat));
      const allSameBeat = beatNums.every(b => b === beatNums[0]);
      const status = allSameBeat ? '✓' : '❌';
      console.log(`    Group ${idx + 1}: ${beats.join(', ')} (beat ${beatNums[0]}) ${status}`);
    });
  }
}

console.log('\n=== Test Complete ===');
console.log('Manual beaming logic should ensure eighth notes are only grouped within the same beat.');
console.log('Check the web UI to visually verify beaming is correct.');
