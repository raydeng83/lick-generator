// Test to find chromatic notes incorrectly labeled as chord-tone or scale-step
// when using arpeggio-scale-mix strategy
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

console.log('=== Testing Arpeggio-Scale-Mix for Chromatic Note Coloring ===\n');
console.log('Looking for chromatic notes incorrectly labeled as chord-tone or scale-step\n');

let totalNotes = 0;
let chromaticNotes = 0;
let incorrectlyLabeled = [];

// Generate 50 licks to find examples
for (let i = 0; i < 50; i++) {
  const options = {
    scaleStrategy: 'default',
    deviceStrategy: 'arpeggio-scale-mix',  // User-specified strategy
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

    // Is this a chromatic note (outside scale)?
    if (!inScale) {
      chromaticNotes++;

      // Check if it's incorrectly labeled
      if (harmonicFunction === 'chord-tone' || harmonicFunction === 'scale-step') {
        incorrectlyLabeled.push({
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
          harmonicFunction: harmonicFunction,
          device: note.device,
          ruleId: note.ruleId,
          degree: note.degree
        });
      }
    }
  });
}

console.log('=== Results ===');
console.log(`Total notes generated: ${totalNotes}`);
console.log(`Chromatic notes (outside scale): ${chromaticNotes}`);
console.log(`Incorrectly labeled chromatic notes: ${incorrectlyLabeled.length}`);
console.log();

if (incorrectlyLabeled.length > 0) {
  console.log(`❌ EVIDENCE FOUND: ${incorrectlyLabeled.length} chromatic notes are incorrectly labeled!\n`);

  // Group by harmonicFunction to see patterns
  const byFunction = {};
  incorrectlyLabeled.forEach(err => {
    if (!byFunction[err.harmonicFunction]) {
      byFunction[err.harmonicFunction] = [];
    }
    byFunction[err.harmonicFunction].push(err);
  });

  console.log('Breakdown by incorrect label:');
  Object.keys(byFunction).forEach(func => {
    console.log(`  ${func}: ${byFunction[func].length} notes`);
  });
  console.log();

  // Group by device to identify which devices are causing the issue
  const byDevice = {};
  incorrectlyLabeled.forEach(err => {
    if (!byDevice[err.device]) {
      byDevice[err.device] = [];
    }
    byDevice[err.device].push(err);
  });

  console.log('Breakdown by device:');
  Object.keys(byDevice).forEach(device => {
    console.log(`  ${device}: ${byDevice[device].length} notes`);
  });
  console.log();

  // Show first 10 examples with full details
  const showCount = Math.min(10, incorrectlyLabeled.length);
  console.log(`\n=== First ${showCount} Examples ===\n`);

  for (let i = 0; i < showCount; i++) {
    const err = incorrectlyLabeled[i];
    console.log(`Example ${i + 1}:`);
    console.log(`  Lick ${err.lickNum}, Note ${err.noteIdx}: ${err.noteName} (MIDI ${err.midi}, pc ${err.pc})`);
    console.log(`  Chord: ${err.chord} (root pc ${err.rootPc}), Scale: ${err.scaleName}`);
    console.log(`  Scale pitch classes: [${err.scalePcs.join(', ')}]`);
    console.log(`  Chord intervals: [${err.chordPcs.join(', ')}]`);
    console.log(`  Note interval: ${err.relPc}`);
    console.log(`  In chord: ${err.inChord}, In scale: ${err.inScale}`);
    console.log(`  Device: ${err.device}, Rule: ${err.ruleId}`);
    console.log(`  INCORRECT LABEL: harmonicFunction='${err.harmonicFunction}' (should be 'chromatic')`);
    if (err.degree) {
      console.log(`  Also has degree='${err.degree}' (chromatic notes should NOT have degree!)`);
    }
    console.log();
  }

  process.exit(1);
} else {
  console.log('✅ No incorrectly labeled chromatic notes found!');
  console.log('   All chromatic notes have harmonicFunction="chromatic"');
}
