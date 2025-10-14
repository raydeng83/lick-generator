// Node.js test for enclosure validation
// This simulates the browser environment enough to run the generator

// Mock window object
global.window = {};

// Load dependencies in order
const fs = require('fs');
const path = require('path');

function loadScript(filename) {
  const code = fs.readFileSync(path.join(__dirname, 'web', filename), 'utf8');
  eval(code);
}

// Load all required scripts
loadScript('schema.js');
loadScript('scales.js');
loadScript('melodic-cells.js');
loadScript('devices.js');
loadScript('generator.js');

// Test with Dm7 | G7 | Cmaj7 progression
const progression = "Dm7 | G7 | Cmaj7";
const options = {
  scaleStrategy: 'default',
  deviceStrategy: 'neighbor-enclosure',
  timeSig: '4/4',
};

console.log("=== Generating lick with neighbor-enclosure strategy ===");
const result = window.Generator.generate(progression, options);

// Extract measure boundaries
console.log("\n=== Measure Analysis ===");
result.progression.forEach((seg, idx) => {
  const measureNotes = result.lick.filter(n =>
    n.startBeat >= seg.startBeat &&
    n.startBeat < seg.startBeat + seg.durationBeats
  );

  console.log(`\nMeasure ${idx + 1}: ${seg.symbol} (beats ${seg.startBeat}-${seg.startBeat + seg.durationBeats})`);
  console.log(`  ${measureNotes.length} notes:`);

  measureNotes.forEach((n, i) => {
    const relBeat = n.startBeat - seg.startBeat;
    const slot = Math.round(relBeat * 2); // Convert to eighth-note slots
    console.log(`    Slot ${slot}: MIDI ${n.midi}, ruleId=${n.ruleId}, harmonicFunction=${n.harmonicFunction}, degree=${n.degree || 'N/A'}, chordSymbol=${n.chordSymbol}`);
  });
});

// Check specific enclosure patterns
console.log("\n=== Enclosure Validation ===");

// Measure 1 -> Measure 2
const m1Notes = result.lick.filter(n => n.startBeat >= 0 && n.startBeat < 4);
const m2Notes = result.lick.filter(n => n.startBeat >= 4 && n.startBeat < 8);

if (m1Notes.length >= 8 && m2Notes.length >= 1) {
  const m1_slot6 = m1Notes[6];
  const m1_slot7 = m1Notes[7];
  const m2_slot0 = m2Notes[0];

  console.log("\n### Measure 1 → Measure 2 ###");
  console.log(`M1 Slot 6 (beat ${m1_slot6.startBeat}):`);
  console.log(`  MIDI: ${m1_slot6.midi}, ruleId: ${m1_slot6.ruleId}, chord: ${m1_slot6.chordSymbol}`);
  console.log(`M1 Slot 7 (beat ${m1_slot7.startBeat}):`);
  console.log(`  MIDI: ${m1_slot7.midi}, ruleId: ${m1_slot7.ruleId}, chord: ${m1_slot7.chordSymbol}`);
  console.log(`M2 Slot 0 (beat ${m2_slot0.startBeat}) - TARGET:`);
  console.log(`  MIDI: ${m2_slot0.midi}, ruleId: ${m2_slot0.ruleId}, degree: ${m2_slot0.degree}, chord: ${m2_slot0.chordSymbol}`);

  // Validate enclosure
  const target = m2_slot0.midi;
  const expectedLower = target - 1;

  // Calculate expected upper neighbor (next scale note above target)
  if (m2_slot0.rootPc !== undefined && m2_slot0.scaleName && window.Scales) {
    const targetPc = (target % 12 + 12) % 12;
    const scalePcs = window.Scales.getScalePitchClasses(m2_slot0.rootPc, m2_slot0.scaleName);
    const scaleAbs = scalePcs.map(pc => (m2_slot0.rootPc + pc + 120) % 12);

    const candidates = [];
    for (let octave = -1; octave <= 1; octave++) {
      for (const pc of scaleAbs) {
        const midi = target + octave * 12 + ((pc - targetPc + 12) % 12);
        if (midi > target && midi < target + 12) {
          candidates.push(midi);
        }
      }
    }
    candidates.sort((a, b) => a - b);
    const expectedUpper = candidates[0];

    console.log(`\nExpected enclosure:`);
    console.log(`  Lower neighbor: ${expectedLower} (half-step below ${target})`);
    console.log(`  Upper neighbor: ${expectedUpper} (next scale note above ${target})`);

    const hasLower = (m1_slot6.midi === expectedLower || m1_slot7.midi === expectedLower);
    const hasUpper = (m1_slot6.midi === expectedUpper || m1_slot7.midi === expectedUpper);

    console.log(`\nValidation:`);
    console.log(`  Has lower neighbor (${expectedLower}): ${hasLower ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Has upper neighbor (${expectedUpper}): ${hasUpper ? '✓ PASS' : '✗ FAIL'}`);

    if (!hasLower || !hasUpper) {
      console.log(`\n⚠️  ENCLOSURE FAILED for Measure 1 → Measure 2`);
    } else {
      console.log(`\n✓ ENCLOSURE PASSED for Measure 1 → Measure 2`);
    }
  }
}

// Measure 2 -> Measure 3
const m3Notes = result.lick.filter(n => n.startBeat >= 8 && n.startBeat < 12);

if (m2Notes.length >= 8 && m3Notes.length >= 1) {
  const m2_slot6 = m2Notes[6];
  const m2_slot7 = m2Notes[7];
  const m3_slot0 = m3Notes[0];

  console.log("\n### Measure 2 → Measure 3 ###");
  console.log(`M2 Slot 6 (beat ${m2_slot6.startBeat}):`);
  console.log(`  MIDI: ${m2_slot6.midi}, ruleId: ${m2_slot6.ruleId}, chord: ${m2_slot6.chordSymbol}`);
  console.log(`M2 Slot 7 (beat ${m2_slot7.startBeat}):`);
  console.log(`  MIDI: ${m2_slot7.midi}, ruleId: ${m2_slot7.ruleId}, chord: ${m2_slot7.chordSymbol}`);
  console.log(`M3 Slot 0 (beat ${m3_slot0.startBeat}) - TARGET:`);
  console.log(`  MIDI: ${m3_slot0.midi}, ruleId: ${m3_slot0.ruleId}, degree: ${m3_slot0.degree}, chord: ${m3_slot0.chordSymbol}`);

  const target = m3_slot0.midi;
  const expectedLower = target - 1;

  if (m3_slot0.rootPc !== undefined && m3_slot0.scaleName && window.Scales) {
    const targetPc = (target % 12 + 12) % 12;
    const scalePcs = window.Scales.getScalePitchClasses(m3_slot0.rootPc, m3_slot0.scaleName);
    const scaleAbs = scalePcs.map(pc => (m3_slot0.rootPc + pc + 120) % 12);

    const candidates = [];
    for (let octave = -1; octave <= 1; octave++) {
      for (const pc of scaleAbs) {
        const midi = target + octave * 12 + ((pc - targetPc + 12) % 12);
        if (midi > target && midi < target + 12) {
          candidates.push(midi);
        }
      }
    }
    candidates.sort((a, b) => a - b);
    const expectedUpper = candidates[0];

    console.log(`\nExpected enclosure:`);
    console.log(`  Lower neighbor: ${expectedLower} (half-step below ${target})`);
    console.log(`  Upper neighbor: ${expectedUpper} (next scale note above ${target})`);

    const hasLower = (m2_slot6.midi === expectedLower || m2_slot7.midi === expectedLower);
    const hasUpper = (m2_slot6.midi === expectedUpper || m2_slot7.midi === expectedUpper);

    console.log(`\nValidation:`);
    console.log(`  Has lower neighbor (${expectedLower}): ${hasLower ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Has upper neighbor (${expectedUpper}): ${hasUpper ? '✓ PASS' : '✗ FAIL'}`);

    if (!hasLower || !hasUpper) {
      console.log(`\n⚠️  ENCLOSURE FAILED for Measure 2 → Measure 3`);
    } else {
      console.log(`\n✓ ENCLOSURE PASSED for Measure 2 → Measure 3`);
    }
  }
}

console.log("\n=== Full Lick JSON ===");
console.log(JSON.stringify(result.lick, null, 2));
