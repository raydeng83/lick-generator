// Test that the fix works in actual lick generation
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

console.log('=== Testing Degree Assignment in Generated Licks ===\n');
console.log('Progression: Dm7 | G7 | Cmaj7\n');

let totalNotes = 0;
let notesWithDegree = 0;
let notesWithoutDegree = 0;
let invalidDegrees = 0;

// Generate 10 licks to test
for (let i = 0; i < 10; i++) {
  const options = {
    scaleStrategy: 'default',
    deviceStrategy: 'neighbor-enclosure',
    swing: 0,
    insertRests: false
  };

  const lick = window.LickGen.generateLick(progression, { tempo: 120 }, options);

  // Check each note
  lick.forEach(note => {
    if (note.isRest) return;

    totalNotes++;

    // If note has a degree, validate it
    if (note.degree !== undefined && note.degree !== null) {
      notesWithDegree++;

      // Validate: if degree is present, the note MUST be in the chord
      const rootPc = note.rootPc;
      const quality = note.quality;
      const chordPcs = window.LickGen.chordPitchClasses(rootPc, quality);
      const pc = note.midi % 12;
      const relPc = (pc - rootPc + 12) % 12;

      const inChord = chordPcs.includes(relPc);

      if (!inChord) {
        invalidDegrees++;
        console.log(`❌ INVALID DEGREE at lick ${i + 1}:`);
        console.log(`   Note: ${note.noteName} (MIDI ${note.midi}, pc ${pc})`);
        console.log(`   Chord: ${note.chordSymbol} (root pc ${rootPc})`);
        console.log(`   Interval: ${relPc}`);
        console.log(`   Degree: ${note.degree}`);
        console.log(`   Chord pitch classes: [${chordPcs.join(', ')}]`);
        console.log(`   Error: Note has degree "${note.degree}" but is NOT in the chord!`);
        console.log();
      }
    } else {
      notesWithoutDegree++;
    }
  });
}

console.log('=== Results ===');
console.log(`Total notes generated: ${totalNotes}`);
console.log(`Notes with degree: ${notesWithDegree}`);
console.log(`Notes without degree: ${notesWithoutDegree} (scale steps, chromatic, etc.)`);
console.log(`Invalid degrees found: ${invalidDegrees}`);
console.log();

if (invalidDegrees === 0) {
  console.log('✅ SUCCESS: All notes with degree labels are valid chord tones!');
  console.log('   The fix correctly prevents non-chord-tones from getting degree labels.');
} else {
  console.log(`❌ FAILURE: Found ${invalidDegrees} invalid degree assignments!`);
  process.exit(1);
}
