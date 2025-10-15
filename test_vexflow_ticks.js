// Test to reproduce "Too many ticks" error
const fs = require('fs');
global.window = {};

// Load modules
eval(fs.readFileSync('./web/scales.js', 'utf8'));
eval(fs.readFileSync('./web/melodic-cells.js', 'utf8'));
eval(fs.readFileSync('./web/devices-new.js', 'utf8'));
eval(fs.readFileSync('./web/generator.js', 'utf8'));

const progression = [
  { symbol: 'Dm7', bar: 0, startBeat: 0, durationBeats: 4 }
];

console.log('=== Reproducing "Too many ticks" Error ===\n');

// Generate a lick with rests
let found = false;
for (let attempt = 0; attempt < 100 && !found; attempt++) {
  const options = {
    scaleStrategy: 'default',
    deviceStrategy: 'neighbor-enclosure',
    swing: 0,
    insertRests: false
  };

  const baseLick = window.LickGen.generateLick(progression, { tempo: 120 }, options);
  const withRests = window.LickGen.insertRandomRests(baseLick, { insertRests: true });

  // Simulate the notation rendering to count ticks
  const start = 0;
  const end = 4;
  const segNotes = withRests.filter(n => n.startBeat >= start && n.startBeat < end);

  // Build notes array like notate.js does
  const vfNotes = [];
  let cursorE8 = 0;

  for (const n of segNotes) {
    if (n.isRest) {
      const relStartE8 = Math.round((n.startBeat - start) * 2);
      const durE8 = Math.round(n.durationBeats * 2);

      // Fill rests up to this rest note
      while (cursorE8 < relStartE8) {
        vfNotes.push(`eighth-rest-filler`);
        cursorE8 += 1;
      }

      // Add the explicit rest note
      vfNotes.push(`rest-dur${n.durationBeats}`);
      cursorE8 += durE8;
    } else {
      const relStartE8 = Math.round((n.startBeat - start) * 2);
      const durE8 = Math.round(n.durationBeats * 2);

      // Fill rests up to this note
      while (cursorE8 < relStartE8) {
        vfNotes.push(`eighth-rest-filler`);
        cursorE8 += 1;
      }

      vfNotes.push(`${n.noteName}-dur${n.durationBeats}`);
      cursorE8 += durE8;
    }
  }

  // Fill remaining
  while (cursorE8 < 8) {
    vfNotes.push(`eighth-rest-final`);
    cursorE8 += 1;
  }

  if (vfNotes.length > 8 || cursorE8 > 8) {
    found = true;
    console.log(`❌ Found error case (attempt ${attempt + 1}):`);
    console.log(`  VexFlow notes array length: ${vfNotes.length}`);
    console.log(`  Final cursor position: ${cursorE8}/8`);
    console.log(`\nOriginal lick notes:`);
    segNotes.forEach((n, idx) => {
      console.log(`  [${idx}] start=${n.startBeat.toFixed(2)}, dur=${n.durationBeats.toFixed(2)}, ${n.isRest ? 'REST' : n.noteName}`);
    });
    console.log(`\nVexFlow notes array (${vfNotes.length} notes):`);
    vfNotes.forEach((n, idx) => {
      console.log(`  [${idx}] ${n}`);
    });
  }
}

if (!found) {
  console.log('✅ No error cases found in 100 attempts');
}
