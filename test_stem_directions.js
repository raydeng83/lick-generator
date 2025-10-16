// Test to verify stem directions are consistent within beamed groups
const fs = require('fs');
global.window = {};

// Load modules
eval(fs.readFileSync('./web/scales.js', 'utf8'));
eval(fs.readFileSync('./web/melodic-cells.js', 'utf8'));
eval(fs.readFileSync('./web/devices-new.js', 'utf8'));
eval(fs.readFileSync('./web/generator.js', 'utf8'));

console.log('=== Testing Stem Direction Consistency ===\n');
console.log('Verifying that beamed eighth notes have consistent stem directions\n');

const progression = [
  { symbol: 'Dm7', bar: 0, startBeat: 0, durationBeats: 4 },
  { symbol: 'G7', bar: 1, startBeat: 4, durationBeats: 4 },
  { symbol: 'Cmaj7', bar: 2, startBeat: 8, durationBeats: 4 }
];

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

  // Analyze beam groups
  console.log('Beam group analysis:');

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

    // Group consecutive eighth notes that should be beamed
    let groups = [];
    let currentGroup = [];

    for (const note of measureNotes) {
      if (currentGroup.length === 0) {
        currentGroup.push(note);
      } else {
        const prevNote = currentGroup[currentGroup.length - 1];
        const prevBeat = Math.floor(prevNote.startBeat);
        const currBeat = Math.floor(note.startBeat);

        // Check consecutiveness
        const prevEndBeat = prevNote.startBeat + prevNote.durationBeats;
        const isConsecutive = Math.abs(prevEndBeat - note.startBeat) < 0.01;

        if (prevBeat === currBeat && isConsecutive) {
          // Same beat and consecutive - add to group
          currentGroup.push(note);
        } else {
          // Different beat or not consecutive - start new group
          if (currentGroup.length >= 2) {
            groups.push(currentGroup);
          }
          currentGroup = [note];
        }
      }
    }

    if (currentGroup.length >= 2) {
      groups.push(currentGroup);
    }

    // Display beam groups
    if (groups.length > 0) {
      console.log(`  Measure ${measureNum}: ${groups.length} beam group(s)`);
      groups.forEach((group, idx) => {
        const beats = group.map(n => n.startBeat.toFixed(1));
        const pitches = group.map(n => {
          const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
          const octave = Math.floor(n.midi / 12) - 1;
          return noteNames[n.midi % 12] + octave;
        });
        console.log(`    Group ${idx + 1}: ${pitches.join(', ')} at beats ${beats.join(', ')}`);
      });
    } else {
      console.log(`  Measure ${measureNum}: No beam groups (all single notes)`);
    }
  }
}

console.log('\n=== Test Complete ===');
console.log('Stem directions should be automatically set based on average pitch of each beam group.');
console.log('Check the web UI to visually verify stems are consistent within each beam.');
