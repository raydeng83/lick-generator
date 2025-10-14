// Simple standalone test without DOM dependencies
const fs = require('fs');
const path = require('path');

// Mock minimal window/global environment
global.window = {
  Schema: null,
  Scales: null,
  MelodicCells: null,
  Devices: null,
  LickGen: null
};

// Load scripts by evaluating them
function loadScript(filename) {
  const code = fs.readFileSync(path.join(__dirname, 'web', filename), 'utf8');
  // Wrap in IIFE and bind to window
  const wrapped = `(function() { ${code} })()`;
  eval(wrapped);
}

console.log('[Test] Loading modules...');
loadScript('schema.js');
loadScript('scales.js');
loadScript('melodic-cells.js');
loadScript('devices.js');
loadScript('generator.js');

console.log('[Test] Modules loaded');
console.log('[Test] Available: Schema=' + !!window.Schema + ', Scales=' + !!window.Scales + ', Devices=' + !!window.Devices + ', LickGen=' + !!window.LickGen);

// Make modules available as globals (for cross-references)
global.Schema = window.Schema;
global.Scales = window.Scales;
global.MelodicCells = window.MelodicCells;
global.Devices = window.Devices;
global.LickGen = window.LickGen;

// Generate
const progression = "Dm7 | G7 | Cmaj7";
const meta = window.Schema.defaultMetadata();
meta.tempo = 100;

const { progression: prog } = window.Schema.parseProgression(progression);

const options = {
  scaleStrategy: 'default',
  deviceStrategy: 'neighbor-enclosure',
  useDevices: true
};

console.log('\n[Test] Generating with options:', options);
const lick = window.LickGen.generateLick(prog, meta, options);

console.log('\n=== FULL LICK JSON ===');
console.log(JSON.stringify(lick, null, 2));

// Save to file for easy grepping
fs.writeFileSync('/Users/ledeng/projects/lick-generator/lick_output.json', JSON.stringify(lick, null, 2));
console.log('\n[Test] Saved output to lick_output.json');

// Analyze
const m1 = lick.filter(n => n.startBeat >= 0 && n.startBeat < 4);
const m2 = lick.filter(n => n.startBeat >= 4 && n.startBeat < 8);
const m3 = lick.filter(n => n.startBeat >= 8 && n.startBeat < 12);

console.log('\n=== ENCLOSURE VALIDATION ===');
console.log(`Measure 1: ${m1.length} notes`);
console.log(`Measure 2: ${m2.length} notes`);
console.log(`Measure 3: ${m3.length} notes`);

if (m1.length >= 8 && m2.length >= 1) {
  console.log('\n### M1 → M2 Enclosure ###');
  const slot6 = m1[6];
  const slot7 = m1[7];
  const target = m2[0];

  console.log(`M1 Slot 6: MIDI ${slot6.midi}, ruleId="${slot6.ruleId}"`);
  console.log(`M1 Slot 7: MIDI ${slot7.midi}, ruleId="${slot7.ruleId}"`);
  console.log(`M2 Slot 0: MIDI ${target.midi}, ruleId="${target.ruleId}", degree="${target.degree}"`);

  const expectedLower = target.midi - 1;
  const hasLower = (slot6.midi === expectedLower || slot7.midi === expectedLower);

  // Calculate upper
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

    console.log(`Expected: lower=${expectedLower}, upper=${expectedUpper}`);
    console.log(`Has lower: ${hasLower ? '✓' : '✗'}, Has upper: ${hasUpper ? '✓' : '✗'}`);

    if (hasLower && hasUpper) {
      console.log('✓✓✓ M1→M2 PASSED ✓✓✓');
    } else {
      console.log('✗✗✗ M1→M2 FAILED ✗✗✗');
    }
  }
}

if (m2.length >= 8 && m3.length >= 1) {
  console.log('\n### M2 → M3 Enclosure ###');
  const slot6 = m2[6];
  const slot7 = m2[7];
  const target = m3[0];

  console.log(`M2 Slot 6: MIDI ${slot6.midi}, ruleId="${slot6.ruleId}"`);
  console.log(`M2 Slot 7: MIDI ${slot7.midi}, ruleId="${slot7.ruleId}"`);
  console.log(`M3 Slot 0: MIDI ${target.midi}, ruleId="${target.ruleId}", degree="${target.degree}"`);

  const expectedLower = target.midi - 1;
  const hasLower = (slot6.midi === expectedLower || slot7.midi === expectedLower);

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

    console.log(`Expected: lower=${expectedLower}, upper=${expectedUpper}`);
    console.log(`Has lower: ${hasLower ? '✓' : '✗'}, Has upper: ${hasUpper ? '✓' : '✗'}`);

    if (hasLower && hasUpper) {
      console.log('✓✓✓ M2→M3 PASSED ✓✓✓');
    } else {
      console.log('✗✗✗ M2→M3 FAILED ✗✗✗');
    }
  }
}
