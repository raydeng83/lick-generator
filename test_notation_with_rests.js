const fs = require('fs');

// Load dependencies
global.window = {};
eval(fs.readFileSync('./web/scales.js', 'utf8'));
eval(fs.readFileSync('./web/schema.js', 'utf8'));
eval(fs.readFileSync('./web/melodic-cells.js', 'utf8'));
eval(fs.readFileSync('./web/devices-new.js', 'utf8'));
eval(fs.readFileSync('./web/generator.js', 'utf8'));

// Test progression
const progressionStr = "Dm7 | G7 | Cmaj7";
const { progression } = window.Schema.parseProgression(progressionStr);
const metadata = window.Schema.defaultMetadata();

console.log('Generating lick WITH insertRests enabled...\n');

const options = {
  scaleStrategy: 'default',
  deviceStrategy: 'neighbor-enclosure',
  useDevices: true,
  swing: 0,
  insertRests: true
};

const lick = window.LickGen.generateLick(progression, metadata, options);

console.log('Generated lick with', lick.length, 'notes');
console.log('Rest notes:', lick.filter(n => n.isRest).length);
console.log('Non-rest notes:', lick.filter(n => !n.isRest).length);
console.log('\nNote sequence (showing rests):');

lick.forEach((note, idx) => {
  if (note.isRest) {
    console.log(`  ${idx}: REST at beat ${note.startBeat}, duration ${note.durationBeats} beats`);
  } else {
    console.log(`  ${idx}: ${note.noteName} (${note.degree || 'N/A'}) at beat ${note.startBeat}, device: ${note.device}`);
  }
});

// Save to file for browser testing
fs.writeFileSync('lick_output_with_rests.json', JSON.stringify(lick, null, 2));
console.log('\n✅ Output saved to lick_output_with_rests.json');
console.log('Open web/index.html in browser and check "Insert Rests" to test notation rendering');
