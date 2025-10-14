// Test enclosure logic
// Scenario: Measure 1 (G7) ending, approaching Measure 2 (Cmaj7) first beat

// Measure 1, last two slots (6-7) should enclose first beat of Measure 2
// G7: rootPc=7, quality=7, scale=mixolydian
// Cmaj7: rootPc=0, quality=maj7, scale=ionian

// Expected:
// - Target: First beat of Cmaj7 measure (some chord tone, let's say E=76 for example)
// - Upper neighbor: F=77 (next scale note above E in C Ionian)
// - Lower neighbor: Eb=75 (half-step below E)
// - Enclosure type: upper-lower or lower-upper

console.log("=== Enclosure Test ===");

// Simulate target resolution
const targetMidi = 76; // E (chord tone of Cmaj7)
const targetRootPc = 0; // C
const targetScaleName = 'ionian';

// C Ionian scale pitch classes
const cIonianPcs = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B

console.log(`Target: MIDI ${targetMidi} (E), Cmaj7`);
console.log(`Target scale: C Ionian ${cIonianPcs}`);

// Calculate upper neighbor
const targetPc = targetMidi % 12; // 76 % 12 = 4 (E)
console.log(`Target PC: ${targetPc} (E)`);

// Find next scale note above
const scaleAbs = cIonianPcs.map(pc => (targetRootPc + pc + 120) % 12);
console.log(`Scale absolute PCs: ${scaleAbs}`);

const candidates = [];
for (let octave = -1; octave <= 1; octave++) {
  for (const pc of scaleAbs) {
    const midi = targetMidi + octave * 12 + ((pc - targetPc + 12) % 12);
    if (midi > targetMidi && midi < targetMidi + 12) {
      candidates.push(midi);
      console.log(`  Candidate: ${midi} (octave ${octave}, PC ${pc})`);
    }
  }
}

candidates.sort((a, b) => a - b);
const upperNeighbor = candidates[0];
const lowerNeighbor = targetMidi - 1;

console.log(`\nUpper neighbor: ${upperNeighbor} (${upperNeighbor === 77 ? 'F - CORRECT' : 'WRONG'})`);
console.log(`Lower neighbor: ${lowerNeighbor} (${lowerNeighbor === 75 ? 'Eb - CORRECT' : 'WRONG'})`);

// Test enclosure patterns
console.log("\n=== Enclosure Patterns ===");
console.log("upper-lower: F(77) → Eb(75) → E(76)");
console.log("lower-upper: Eb(75) → F(77) → E(76)");

// Now the real question: are slots 6-7 of measure 1 ACTUALLY targeting slot 0 of measure 2?
console.log("\n=== Slot Assignment Check ===");
console.log("Measure 1 has 8 slots (0-7)");
console.log("Measure 2 has 8 slots (0-7)");
console.log("Enclosure should use:");
console.log("  - Measure 1, slot 6: first approach note");
console.log("  - Measure 1, slot 7: second approach note");
console.log("  - Measure 2, slot 0: TARGET (strong beat)");

// Check: when i=6 in measure 1
console.log("\n=== Processing Measure 1, Slot 6 ===");
const i = 6;
const slotsLength = 8;
console.log(`i = ${i}`);
console.log(`i >= slotsLength - 2: ${i >= slotsLength - 2}`);
console.log(`This should be marked as enclosure slot: YES`);

const isFirstApproach_6 = true; // enclosureSlots.has(7) should be true
console.log(`isFirstApproach: ${isFirstApproach_6}`);
console.log(`Target should be: Measure 2, slot 0`);

console.log("\n=== Processing Measure 1, Slot 7 ===");
const i7 = 7;
console.log(`i = ${i7}`);
const isFirstApproach_7 = false; // enclosureSlots.has(8) should be false
console.log(`isFirstApproach: ${isFirstApproach_7}`);
console.log(`Target should be: Measure 2, slot 0 (SAME as slot 6)`);
