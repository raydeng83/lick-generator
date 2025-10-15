// Test that harmonicFunction labels correctly distinguish between scale-step and chromatic
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

console.log('=== Testing Harmonic Function Labels ===\n');
console.log('Progression: Dm7 | G7 | Cmaj7');
console.log('D Dorian scale: D, E, F, G, A, B, C (pitch classes: 2, 4, 5, 7, 9, 11, 0)\n');

let totalNotes = 0;
let invalidLabels = 0;
const errors = [];

// Generate 20 licks to test
for (let i = 0; i < 20; i++) {
  const options = {
    scaleStrategy: 'default',
    deviceStrategy: 'neighbor-enclosure',
    swing: 0,
    insertRests: false
  };

  const lick = window.LickGen.generateLick(progression, { tempo: 120 }, options);

  // Check each note
  lick.forEach((note, idx) => {
    if (note.isRest) return;

    totalNotes++;

    const rootPc = note.rootPc;
    const quality = note.quality;
    const scaleName = note.scaleName;
    const harmonicFunction = note.harmonicFunction;

    // Get scale and chord pitch classes
    const scalePcs = window.Scales.getScalePitchClasses(rootPc, scaleName);
    const chordPcs = window.LickGen.chordPitchClasses(rootPc, quality);

    // Check note against scale and chord
    const pc = note.midi % 12;
    const relPc = (pc - rootPc + 12) % 12;

    const inChord = chordPcs.includes(relPc);
    const inScale = scalePcs.includes(pc);

    // Determine expected harmonic function
    let expectedFunction;
    if (inChord) {
      expectedFunction = 'chord-tone';
    } else if (inScale) {
      expectedFunction = 'scale-step';
    } else {
      expectedFunction = 'chromatic';
    }

    // Validate
    if (harmonicFunction !== expectedFunction) {
      invalidLabels++;
      errors.push({
        lickNum: i + 1,
        noteIdx: idx,
        noteName: note.noteName,
        midi: note.midi,
        pc: pc,
        chord: note.chordSymbol,
        rootPc: rootPc,
        scaleName: scaleName,
        scalePcs: scalePcs,
        chordPcs: chordPcs,
        relPc: relPc,
        inChord: inChord,
        inScale: inScale,
        expected: expectedFunction,
        actual: harmonicFunction,
        device: note.device,
        ruleId: note.ruleId
      });
    }
  });
}

console.log('=== Results ===');
console.log(`Total notes generated: ${totalNotes}`);
console.log(`Invalid harmonic function labels: ${invalidLabels}`);
console.log();

if (invalidLabels > 0) {
  console.log(`❌ FAILURE: Found ${invalidLabels} invalid harmonic function labels!\n`);

  // Show first 10 errors
  const showCount = Math.min(10, errors.length);
  console.log(`Showing first ${showCount} errors:\n`);

  for (let i = 0; i < showCount; i++) {
    const err = errors[i];
    console.log(`Error ${i + 1}:`);
    console.log(`  Lick ${err.lickNum}, Note ${err.noteIdx}: ${err.noteName} (MIDI ${err.midi}, pc ${err.pc})`);
    console.log(`  Chord: ${err.chord} (root pc ${err.rootPc}), Scale: ${err.scaleName}`);
    console.log(`  Scale pitch classes: [${err.scalePcs.join(', ')}]`);
    console.log(`  Chord intervals: [${err.chordPcs.join(', ')}]`);
    console.log(`  Note interval: ${err.relPc}`);
    console.log(`  In chord: ${err.inChord}, In scale: ${err.inScale}`);
    console.log(`  Expected: '${err.expected}', Got: '${err.actual}'`);
    console.log(`  Device: ${err.device}, Rule: ${err.ruleId}`);
    console.log();
  }

  process.exit(1);
} else {
  console.log('✅ SUCCESS: All harmonic function labels are correct!');
  console.log('   - chord-tone: Notes in the chord');
  console.log('   - scale-step: Notes in the scale but not in the chord');
  console.log('   - chromatic: Notes outside the scale');
}
