// Test to detect consecutive duplicate notes in arpeggio-scale-mix strategy
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

console.log('=== Testing for Consecutive Duplicate Notes ===\n');
console.log('Strategy: arpeggio-scale-mix\n');

let totalLicks = 0;
let licksWithDuplicates = 0;
let totalDuplicatePairs = 0;
const duplicateExamples = [];

// Generate 100 licks to find examples
for (let i = 0; i < 100; i++) {
  const options = {
    scaleStrategy: 'default',
    deviceStrategy: 'arpeggio-scale-mix',
    swing: 0,
    insertRests: false
  };

  const lick = window.LickGen.generateLick(progression, { tempo: 120 }, options);
  totalLicks++;

  // Check for consecutive duplicate notes
  let hasDuplicates = false;
  const nonRestNotes = lick.filter(n => !n.isRest);

  for (let j = 1; j < nonRestNotes.length; j++) {
    const prevNote = nonRestNotes[j - 1];
    const currNote = nonRestNotes[j];

    if (prevNote.midi === currNote.midi) {
      hasDuplicates = true;
      totalDuplicatePairs++;

      // Collect examples
      if (duplicateExamples.length < 10) {
        duplicateExamples.push({
          lickNum: i + 1,
          noteIndex: j,
          noteName: currNote.noteName,
          midi: currNote.midi,
          prevDevice: prevNote.device,
          currDevice: currNote.device,
          prevBeat: prevNote.startBeat,
          currBeat: currNote.startBeat,
          prevChord: prevNote.chordSymbol,
          currChord: currNote.chordSymbol,
        });
      }
    }
  }

  if (hasDuplicates) {
    licksWithDuplicates++;
  }
}

console.log('=== Results ===');
console.log(`Total licks generated: ${totalLicks}`);
console.log(`Licks with consecutive duplicates: ${licksWithDuplicates} (${(licksWithDuplicates / totalLicks * 100).toFixed(1)}%)`);
console.log(`Total consecutive duplicate pairs found: ${totalDuplicatePairs}`);
console.log();

if (duplicateExamples.length > 0) {
  console.log(`❌ CONSECUTIVE DUPLICATES DETECTED!\n`);
  console.log(`=== First ${duplicateExamples.length} Examples ===\n`);

  duplicateExamples.forEach((ex, idx) => {
    console.log(`Example ${idx + 1}:`);
    console.log(`  Lick ${ex.lickNum}, Note ${ex.noteIndex}: ${ex.noteName} (MIDI ${ex.midi})`);
    console.log(`  Previous note: Beat ${ex.prevBeat.toFixed(1)}, Device: ${ex.prevDevice}, Chord: ${ex.prevChord}`);
    console.log(`  Current note:  Beat ${ex.currBeat.toFixed(1)}, Device: ${ex.currDevice}, Chord: ${ex.currChord}`);
    console.log(`  ⚠️ Same MIDI note played consecutively!`);
    console.log();
  });

  // Analyze device transitions
  const devicePairs = {};
  duplicateExamples.forEach(ex => {
    const pair = `${ex.prevDevice} → ${ex.currDevice}`;
    devicePairs[pair] = (devicePairs[pair] || 0) + 1;
  });

  console.log('Breakdown by device transition:');
  Object.entries(devicePairs).forEach(([pair, count]) => {
    console.log(`  ${pair}: ${count} occurrences`);
  });
  console.log();

  process.exit(1);
} else {
  console.log('✅ No consecutive duplicate notes found!');
  console.log('   All consecutive notes have different MIDI values.');
}
