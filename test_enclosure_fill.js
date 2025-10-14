// Test enclosure device with random fill device

const fs = require('fs');

// Load modules
const generatorCode = fs.readFileSync('./web/generator.js', 'utf8');
const scalesCode = fs.readFileSync('./web/scales.js', 'utf8');
const melodicCellsCode = fs.readFileSync('./web/melodic-cells.js', 'utf8');
const devicesCode = fs.readFileSync('./web/devices-new.js', 'utf8');

// Setup window namespace
global.window = {
  LickGen: null,
  Scales: null,
  MelodicCells: null,
  DevicesNew: null
};

// Load modules
eval(scalesCode);
eval(melodicCellsCode);
eval(devicesCode);
eval(generatorCode);

const { LickGen } = global.window;

// Test progression
const progression = [
  { bar: 0, startBeat: 0, durationBeats: 4, symbol: 'Dm7' },
  { bar: 1, startBeat: 4, durationBeats: 4, symbol: 'G7' },
  { bar: 2, startBeat: 8, durationBeats: 4, symbol: 'Cmaj7' }
];

const metadata = { tempo: 120 };

console.log('Testing enclosure device with random fill\n');

// Generate multiple licks to see variety
for (let run = 0; run < 5; run++) {
  console.log(`\n=== Run ${run + 1} ===`);

  const lick = LickGen.generateLick(progression, metadata, {
    deviceStrategy: 'neighbor-enclosure',
    swing: 0
  });

  // Analyze each measure
  for (let bar = 0; bar < 3; bar++) {
    const measureNotes = lick.filter(n =>
      n.startBeat >= bar * 4 && n.startBeat < (bar + 1) * 4
    );

    console.log(`\nMeasure ${bar + 1} (${progression[bar].symbol}):`);

    // Count device types used
    const devices = {};
    measureNotes.forEach(note => {
      const dev = note.device || 'unknown';
      devices[dev] = (devices[dev] || 0) + 1;
    });

    console.log('Devices used:');
    for (const [dev, count] of Object.entries(devices)) {
      console.log(`  ${dev}: ${count} notes`);
    }

    // Check last 2 notes for enclosure
    if (measureNotes.length >= 2) {
      const lastTwo = measureNotes.slice(-2);
      const isEnclosure = lastTwo.every(n => n.device === 'enclosure');
      console.log(`Last 2 notes are enclosure: ${isEnclosure ? 'YES ✓' : 'NO ✗'}`);

      if (isEnclosure) {
        console.log(`  Enclosure pattern: ${lastTwo[0].enclosureType} → ${lastTwo[1].enclosureType}`);
      }
    }
  }
}

console.log('\n✓ Test complete!');
