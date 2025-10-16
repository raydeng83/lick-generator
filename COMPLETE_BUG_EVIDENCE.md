# Complete Bug Evidence: Chromatic Notes Show Wrong Colors

## User Reports
1. "When selecting Arpeggio + Scale mix, the chromatic note color is marked as green, which is incorrect."
2. "Even the harmonic function is identified as chromatic when arpeggio+scale mix is selected, the color is showing either green or blue, not orange."

## Summary

There are **TWO separate bugs** causing chromatic notes to display incorrectly:

**Bug #1:** Arpeggio device hardcodes `harmonicFunction='chord-tone'` without validating scale membership
**Bug #2:** notate.js color assignment prioritizes `ruleId` over `harmonicFunction`, causing chromatic notes to be colored incorrectly

## Test Results

### Test 1: test_color_assignment_bug.js
**Command:** `node test_color_assignment_bug.js`

**Results:**
- Total notes generated: 2,245 (across 100 licks)
- Chromatic notes (outside scale): 124
- **Chromatic notes with wrong color: 124 (100% error rate!)**
  - **48 chromatic notes colored BLUE** (should be orange)
  - **76 chromatic notes colored GREEN** (should be orange)

**Breakdown by ruleId:**
- `ruleId='arpeggio'`: 48 notes (all colored blue ❌)
- `ruleId='scale-step'`: 76 notes (all colored green ❌)

---

## Bug #1: Arpeggio Device - Missing isInScale Validation

### Location
**File:** `/Users/ledeng/projects/lick-generator/web/devices-new.js`

### Affected Lines
- **Lines 106-118:** Main arpeggio loop
- **Lines 126-138:** Last note of arpeggio (non-last-measure)

### The Problem

```javascript
// Lines 106-118 (WRONG)
notes.push({
  startBeat: measureStart + i * 0.5,
  durationBeats: 0.5,
  midi,
  velocity: 0.9,
  device: 'arpeggio',
  chordSymbol: chord.symbol,
  rootPc,
  quality,
  scaleName: scale,
  ruleId: 'arpeggio',
  harmonicFunction: 'chord-tone',  // ❌ Hardcoded! No scale check!
});
```

**Why this happens:**
1. Arpeggio device cycles through chord tones
2. It assumes all chord tones are valid
3. Due to octave adjustments and range clamping, the note might land on a pitch class outside the scale
4. Never calls `isInScale(midi, scalePcs)` to validate

**Impact:** 48 chromatic notes incorrectly labeled as `harmonicFunction='chord-tone'`

### Correct Implementation (for reference)

The last measure path correctly validates scale membership:

```javascript
// Lines 37-54 (CORRECT)
for (let i = 1; i < 7; i++) {
  currentMidi = nextScaleNote(currentMidi, rootPc, scalePcs, direction);
  const isChordToneNote = isChordTone(currentMidi, rootPc, chordPcs);
  const inScale = isInScale(currentMidi, scalePcs);  // ✓ Validates scale

  notes.push({
    startBeat: measureStart + i * 0.5,
    durationBeats: 0.5,
    midi: currentMidi,
    velocity: 0.9,
    device: 'arpeggio',
    chordSymbol: chord.symbol,
    rootPc,
    quality,
    scaleName: scale,
    ruleId: isChordToneNote ? 'arpeggio' : 'scale-step',
    harmonicFunction: isChordToneNote ? 'chord-tone' : (inScale ? 'scale-step' : 'chromatic'),  // ✓ Three-way logic
  });
}
```

---

## Bug #2: notate.js - ruleId Overrides harmonicFunction

### Location
**File:** `/Users/ledeng/projects/lick-generator/web/notate.js`

### Affected Lines
**Lines 324-345:** Color assignment logic

### The Problem

```javascript
// Lines 324-328 (PROBLEMATIC)
if (n.harmonicFunction === 'chord-tone' || n.ruleId === 'chord-tone' ||
    n.ruleId === 'arpeggio-chord-tone' || n.ruleId === 'scale-run-chord-tone') {
  // Chord tones: Blue
  const color = useColors ? '#4cc3ff' : '#000000';
  sn.setStyle({ fillStyle: color, strokeStyle: color });

// Lines 338-345 (PROBLEMATIC)
} else if (n.harmonicFunction === 'scale-step' || n.ruleId === 'scale-step' ||
           n.ruleId === 'scale-run' || n.ruleId === 'melodic-cell' ||
           (n.ruleId === 'neighbor' && n.harmonicFunction === 'scale-step') ||
           (n.ruleId === 'enclosure-upper' && n.harmonicFunction === 'scale-step') ||
           (n.ruleId === 'enclosure-lower' && n.harmonicFunction === 'scale-step')) {
  // Scale tones: Green
  const color = useColors ? '#34c759' : '#000000';
  sn.setStyle({ fillStyle: color, strokeStyle: color });

// Lines 355-359 (ELSE CASE)
} else {
  // Chromatic/device notes: Orange
  const color = useColors ? '#ff9500' : '#000000';
  sn.setStyle({ fillStyle: color, strokeStyle: color });
}
```

**Why this is wrong:**

The condition `n.ruleId === 'scale-step'` (line 338) matches notes REGARDLESS of their `harmonicFunction`. This means:

1. A note with `harmonicFunction='chromatic'` and `ruleId='scale-step'` will be colored **green** (scale-step color)
2. A note with `harmonicFunction='chord-tone'` but `ruleId='arpeggio'` will be colored **blue** (chord-tone color)

**The logic should ONLY check `harmonicFunction`**, because that's the authoritative label. The `ruleId` is a device-specific implementation detail.

### Example Cases

#### Example 3 from test (Green instead of Orange):
```javascript
{
  noteName: 'Bb4',
  midi: 70,
  pc: 10,
  chord: 'G7',
  scale: 'G Mixolydian' (pitch classes: [7, 9, 11, 0, 2, 4, 5]),
  inScale: false,  // Bb (pc 10) is NOT in G Mixolydian
  harmonicFunction: 'chromatic',  // ✓ Correctly labeled
  ruleId: 'scale-step',  // ❌ This causes wrong color
  device: 'scale-run',
  assignedColor: 'green'  // ❌ WRONG! Should be orange
}
```

**Why it's green:** Line 338 checks `n.ruleId === 'scale-step'` and returns true, so it colors the note green, completely ignoring `harmonicFunction='chromatic'`.

#### Example 1 from test (Blue instead of Orange):
```javascript
{
  noteName: 'Bb4',
  midi: 70,
  pc: 10,
  chord: 'G7',
  scale: 'G Mixolydian' (pitch classes: [7, 9, 11, 0, 2, 4, 5]),
  inScale: false,  // Bb (pc 10) is NOT in G Mixolydian
  harmonicFunction: 'chord-tone',  // ❌ Wrong from Bug #1
  ruleId: 'arpeggio',
  device: 'arpeggio',
  assignedColor: 'blue'  // ❌ WRONG! Should be orange
}
```

**Why it's blue:** `harmonicFunction='chord-tone'` due to Bug #1, so line 324 matches and colors it blue.

---

## Root Cause Analysis

### Why does `ruleId='scale-step'` exist on chromatic notes?

Looking at the last measure arpeggio path (lines 37-54), when a note is NOT a chord tone, it assigns:

```javascript
ruleId: isChordToneNote ? 'arpeggio' : 'scale-step',
```

The logic assumes: "If not a chord tone, it must be a scale step, so use `ruleId='scale-step'`."

But this is wrong! The note might be chromatic (outside the scale). The `ruleId` should reflect the actual harmonic function.

### Why does notate.js check `ruleId`?

The notate.js logic was likely designed to support older code that didn't have `harmonicFunction`. But now that we have `harmonicFunction`, the `ruleId` checks are redundant and causing bugs.

---

## Required Fixes

### Fix #1: devices-new.js (Arpeggio Device)

Add `isInScale()` validation to two locations:

**Location 1: Lines 106-118**
```javascript
// Add before line 106:
const scalePcs = window.Scales ? window.Scales.getScalePitchClasses(rootPc, scale) : [];
const chordPcs = getChordPitchClasses(rootPc, quality);

// Then in the loop (replace lines 106-118):
const isChordToneNote = isChordTone(midi, rootPc, chordPcs);
const inScale = isInScale(midi, scalePcs);

notes.push({
  startBeat: measureStart + i * 0.5,
  durationBeats: 0.5,
  midi,
  velocity: 0.9,
  device: 'arpeggio',
  chordSymbol: chord.symbol,
  rootPc,
  quality,
  scaleName: scale,
  ruleId: isChordToneNote ? 'arpeggio' : (inScale ? 'scale-step' : 'chromatic'),
  harmonicFunction: isChordToneNote ? 'chord-tone' : (inScale ? 'scale-step' : 'chromatic'),
});
```

**Location 2: Lines 126-138** (same pattern)

### Fix #2: notate.js (Color Assignment)

**Option A: Remove ruleId checks entirely (RECOMMENDED)**

```javascript
// Lines 324-359 (SIMPLIFIED)
if (n.harmonicFunction === 'chord-tone') {
  // Chord tones: Blue
  const color = useColors ? '#4cc3ff' : '#000000';
  sn.setStyle({ fillStyle: color, strokeStyle: color });
  // ... degree annotation ...
} else if (n.harmonicFunction === 'scale-step') {
  // Scale tones: Green
  const color = useColors ? '#34c759' : '#000000';
  sn.setStyle({ fillStyle: color, strokeStyle: color });
  // ... scale degree annotation ...
} else {
  // Chromatic notes: Orange
  const color = useColors ? '#ff9500' : '#000000';
  sn.setStyle({ fillStyle: color, strokeStyle: color });
}
```

**Option B: Check harmonicFunction FIRST (if backwards compatibility needed)**

```javascript
// Check harmonicFunction first, fall back to ruleId only if harmonicFunction is missing
if (n.harmonicFunction === 'chord-tone' ||
    (!n.harmonicFunction && (n.ruleId === 'chord-tone' || n.ruleId === 'arpeggio-chord-tone' || n.ruleId === 'scale-run-chord-tone'))) {
  // Blue
} else if (n.harmonicFunction === 'scale-step' ||
           (!n.harmonicFunction && (n.ruleId === 'scale-step' || n.ruleId === 'scale-run' || n.ruleId === 'melodic-cell'))) {
  // Green
} else if (n.harmonicFunction === 'chromatic' || !n.harmonicFunction) {
  // Orange (chromatic or unknown)
}
```

**Recommendation:** Use Option A (remove ruleId checks) because all devices now correctly set `harmonicFunction`.

---

## Color Reference

From `/Users/ledeng/projects/lick-generator/web/notate.js`:
- **Blue (#4cc3ff):** Chord tones (notes in the chord)
- **Green (#34c759):** Scale steps (notes in scale but not chord)
- **Orange (#ff9500):** Chromatic notes (notes outside scale)

---

## Impact Summary

When using `deviceStrategy: 'arpeggio-scale-mix'`:
- **100% of chromatic notes are colored incorrectly**
- 48 chromatic notes show as blue (chord-tone color)
- 76 chromatic notes show as green (scale-step color)
- 0 chromatic notes show as orange (correct chromatic color)

This completely breaks the color-coding feature for arpeggio-scale-mix strategy.
