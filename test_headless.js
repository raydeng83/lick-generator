// Headless test to generate lick and output JSON
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Create a DOM environment
const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
  url: 'http://localhost:8000/',
  runScripts: 'dangerously',
  resources: 'usable'
});

global.window = dom.window;
global.document = window.document;

// Load all required scripts in order
function loadScript(filename) {
  const scriptPath = path.join(__dirname, 'web', filename);
  const code = fs.readFileSync(scriptPath, 'utf8');

  // Create a script element and execute it
  const scriptEl = document.createElement('script');
  scriptEl.textContent = code;
  document.body.appendChild(scriptEl);
}

try {
  console.log('[Test] Loading scripts...');
  loadScript('schema.js');
  loadScript('scales.js');
  loadScript('melodic-cells.js');
  loadScript('devices.js');
  loadScript('generator.js');

  console.log('[Test] Scripts loaded, generating lick...');

  // Generate lick with neighbor-enclosure strategy
  const progression = "Dm7 | G7 | Cmaj7";
  const meta = window.Schema.defaultMetadata();
  meta.tempo = 100;

  const { progression: prog } = window.Schema.parseProgression(progression);

  const options = {
    scaleStrategy: 'default',
    deviceStrategy: 'neighbor-enclosure',
    useDevices: true
  };

  console.log('[Test] Calling LickGen.generateLick...');
  const lick = window.LickGen.generateLick(prog, meta, options);

  console.log('\n=== FULL LICK JSON ===');
  console.log(JSON.stringify(lick, null, 2));

  // Analyze enclosures
  console.log('\n=== ENCLOSURE ANALYSIS ===');

  // Measure 1 (beats 0-4)
  const m1 = lick.filter(n => n.startBeat >= 0 && n.startBeat < 4);
  // Measure 2 (beats 4-8)
  const m2 = lick.filter(n => n.startBeat >= 4 && n.startBeat < 8);
  // Measure 3 (beats 8-12)
  const m3 = lick.filter(n => n.startBeat >= 8 && n.startBeat < 12);

  console.log(`\nMeasure 1: ${m1.length} notes`);
  console.log(`Measure 2: ${m2.length} notes`);
  console.log(`Measure 3: ${m3.length} notes`);

  if (m1.length >= 8 && m2.length >= 1) {
    console.log('\n### Measure 1 → Measure 2 Enclosure ###');
    const slot6 = m1[6];
    const slot7 = m1[7];
    const target = m2[0];

    console.log(`M1 Slot 6: MIDI ${slot6.midi}, ruleId="${slot6.ruleId}", chord="${slot6.chordSymbol}"`);
    console.log(`M1 Slot 7: MIDI ${slot7.midi}, ruleId="${slot7.ruleId}", chord="${slot7.chordSymbol}"`);
    console.log(`M2 Slot 0 (TARGET): MIDI ${target.midi}, ruleId="${target.ruleId}", degree="${target.degree}", chord="${target.chordSymbol}"`);

    const expectedLower = target.midi - 1;
    const hasLower = (slot6.midi === expectedLower || slot7.midi === expectedLower);

    console.log(`\nExpected lower neighbor: ${expectedLower}`);
    console.log(`Has lower neighbor: ${hasLower ? '✓ PASS' : '✗ FAIL'}`);

    // Calculate expected upper neighbor
    if (target.rootPc !== undefined && target.scaleName && window.Scales) {
      const targetPc = (target.midi % 12 + 12) % 12;
      const scalePcs = window.Scales.getScalePitchClasses(target.rootPc, target.scaleName);
      const scaleAbs = scalePcs.map(pc => (target.rootPc + pc + 120) % 12);

      const candidates = [];
      for (let octave = -1; octave <= 1; octave++) {
        for (const pc of scaleAbs) {
          const midi = target.midi + octave * 12 + ((pc - targetPc + 12) % 12);
          if (midi > target.midi && midi < target.midi + 12) {
            candidates.push(midi);
          }
        }
      }
      candidates.sort((a, b) => a - b);
      const expectedUpper = candidates[0];

      const hasUpper = (slot6.midi === expectedUpper || slot7.midi === expectedUpper);

      console.log(`Expected upper neighbor: ${expectedUpper}`);
      console.log(`Has upper neighbor: ${hasUpper ? '✓ PASS' : '✗ FAIL'}`);

      if (hasLower && hasUpper) {
        console.log('\n✓✓✓ M1→M2 ENCLOSURE PASSED ✓✓✓');
      } else {
        console.log('\n✗✗✗ M1→M2 ENCLOSURE FAILED ✗✗✗');
      }
    }
  }

  if (m2.length >= 8 && m3.length >= 1) {
    console.log('\n### Measure 2 → Measure 3 Enclosure ###');
    const slot6 = m2[6];
    const slot7 = m2[7];
    const target = m3[0];

    console.log(`M2 Slot 6: MIDI ${slot6.midi}, ruleId="${slot6.ruleId}", chord="${slot6.chordSymbol}"`);
    console.log(`M2 Slot 7: MIDI ${slot7.midi}, ruleId="${slot7.ruleId}", chord="${slot7.chordSymbol}"`);
    console.log(`M3 Slot 0 (TARGET): MIDI ${target.midi}, ruleId="${target.ruleId}", degree="${target.degree}", chord="${target.chordSymbol}"`);

    const expectedLower = target.midi - 1;
    const hasLower = (slot6.midi === expectedLower || slot7.midi === expectedLower);

    console.log(`\nExpected lower neighbor: ${expectedLower}`);
    console.log(`Has lower neighbor: ${hasLower ? '✓ PASS' : '✗ FAIL'}`);

    if (target.rootPc !== undefined && target.scaleName && window.Scales) {
      const targetPc = (target.midi % 12 + 12) % 12;
      const scalePcs = window.Scales.getScalePitchClasses(target.rootPc, target.scaleName);
      const scaleAbs = scalePcs.map(pc => (target.rootPc + pc + 120) % 12);

      const candidates = [];
      for (let octave = -1; octave <= 1; octave++) {
        for (const pc of scaleAbs) {
          const midi = target.midi + octave * 12 + ((pc - targetPc + 12) % 12);
          if (midi > target.midi && midi < target.midi + 12) {
            candidates.push(midi);
          }
        }
      }
      candidates.sort((a, b) => a - b);
      const expectedUpper = candidates[0];

      const hasUpper = (slot6.midi === expectedUpper || slot7.midi === expectedUpper);

      console.log(`Expected upper neighbor: ${expectedUpper}`);
      console.log(`Has upper neighbor: ${hasUpper ? '✓ PASS' : '✗ FAIL'}`);

      if (hasLower && hasUpper) {
        console.log('\n✓✓✓ M2→M3 ENCLOSURE PASSED ✓✓✓');
      } else {
        console.log('\n✗✗✗ M2→M3 ENCLOSURE FAILED ✗✗✗');
      }
    }
  }

} catch (error) {
  console.error('[Test] Error:', error);
  process.exit(1);
}
