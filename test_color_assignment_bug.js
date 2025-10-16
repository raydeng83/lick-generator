// Test to verify the ruleId vs harmonicFunction priority bug in color assignment
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

console.log('=== Testing Color Assignment Bug: ruleId vs harmonicFunction ===\n');
console.log('Bug: Notes with ruleId="scale-step" are colored green even if harmonicFunction="chromatic"\n');

let totalNotes = 0;
let chromaticNotes = 0;
let problematicNotes = [];

// Generate 100 licks to find examples
for (let i = 0; i < 100; i++) {
  const options = {
    scaleStrategy: 'default',
    deviceStrategy: 'arpeggio-scale-mix',
    swing: 0,
    insertRests: false
  };

  const lick = window.LickGen.generateLick(progression, { tempo: 120 }, options);

  // Check each note
  lick.forEach((note, idx) => {
    if (note.isRest) return;

    totalNotes++;

    const rootPc = note.rootPc;
    const scaleName = note.scaleName;
    const harmonicFunction = note.harmonicFunction;
    const ruleId = note.ruleId;

    // Get scale pitch classes
    const scalePcs = window.Scales.getScalePitchClasses(rootPc, scaleName);

    // Check if note is actually in scale
    const pc = note.midi % 12;
    const inScale = scalePcs.includes(pc);

    // Count chromatic notes
    if (!inScale) {
      chromaticNotes++;
    }

    // Simulate NEW notate.js color assignment logic (ONLY checks harmonicFunction)
    let assignedColor;
    if (harmonicFunction === 'chord-tone') {
      assignedColor = 'blue';
    } else if (harmonicFunction === 'scale-step') {
      assignedColor = 'green';
    } else {
      assignedColor = 'orange';
    }

    // Find problematic cases: chromatic notes (not in scale) colored as blue or green
    if (!inScale && assignedColor !== 'orange') {
      problematicNotes.push({
        lickNum: i + 1,
        noteIdx: idx,
        noteName: note.noteName,
        midi: note.midi,
        pc: pc,
        chord: note.chordSymbol,
        rootPc: rootPc,
        scaleName: scaleName,
        scalePcs: scalePcs,
        inScale: inScale,
        harmonicFunction: harmonicFunction,
        ruleId: ruleId,
        assignedColor: assignedColor,
        device: note.device
      });
    }
  });
}

console.log('=== Results ===');
console.log(`Total notes generated: ${totalNotes}`);
console.log(`Chromatic notes (outside scale): ${chromaticNotes}`);
console.log(`Chromatic notes with wrong color (blue/green instead of orange): ${problematicNotes.length}`);
console.log();

if (problematicNotes.length > 0) {
  console.log(`❌ COLOR BUG CONFIRMED: ${problematicNotes.length} chromatic notes colored incorrectly!\n`);

  // Group by assigned color
  const byColor = {};
  problematicNotes.forEach(note => {
    if (!byColor[note.assignedColor]) {
      byColor[note.assignedColor] = [];
    }
    byColor[note.assignedColor].push(note);
  });

  console.log('Breakdown by wrong color:');
  Object.keys(byColor).forEach(color => {
    console.log(`  ${color}: ${byColor[color].length} chromatic notes`);
  });
  console.log();

  // Group by ruleId to see the pattern
  const byRuleId = {};
  problematicNotes.forEach(note => {
    if (!byRuleId[note.ruleId]) {
      byRuleId[note.ruleId] = [];
    }
    byRuleId[note.ruleId].push(note);
  });

  console.log('Breakdown by ruleId:');
  Object.keys(byRuleId).forEach(ruleId => {
    const notes = byRuleId[ruleId];
    const colorCounts = {};
    notes.forEach(n => {
      colorCounts[n.assignedColor] = (colorCounts[n.assignedColor] || 0) + 1;
    });
    console.log(`  ${ruleId}: ${notes.length} notes (${Object.entries(colorCounts).map(([c, n]) => `${n} ${c}`).join(', ')})`);
  });
  console.log();

  // Show first 10 examples
  const showCount = Math.min(10, problematicNotes.length);
  console.log(`\n=== First ${showCount} Examples ===\n`);

  for (let i = 0; i < showCount; i++) {
    const note = problematicNotes[i];
    console.log(`Example ${i + 1}:`);
    console.log(`  Lick ${note.lickNum}, Note ${note.noteIdx}: ${note.noteName} (MIDI ${note.midi}, pc ${note.pc})`);
    console.log(`  Chord: ${note.chord} (root pc ${note.rootPc}), Scale: ${note.scaleName}`);
    console.log(`  Scale pitch classes: [${note.scalePcs.join(', ')}]`);
    console.log(`  In scale: ${note.inScale} (note IS chromatic)`);
    console.log(`  harmonicFunction: '${note.harmonicFunction}'`);
    console.log(`  ruleId: '${note.ruleId}'`);
    console.log(`  device: ${note.device}`);
    console.log(`  WRONG COLOR: ${note.assignedColor} (should be orange)`);
    console.log();
  }

  process.exit(1);
} else {
  console.log('✅ No color assignment bugs found!');
  console.log('   All chromatic notes would be colored orange correctly.');
}
