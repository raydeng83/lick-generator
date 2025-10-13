// Pipeline-based lick generator with multi-stage architecture

window.LickGen = (function () {
  // ========== PITCH HELPERS ==========

  const NOTE_TO_PC = {
    C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, F: 5, "F#": 6, Gb: 6,
    G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
  };

  function parseRoot(sym) {
    const m = sym.match(/^([A-Ga-g])([b#]?)/);
    if (!m) return null;
    const l = m[1].toUpperCase();
    const a = (m[2] || "");
    const key = l + a;
    return NOTE_TO_PC[key] ?? null;
  }

  function parseQuality(sym) {
    const rest = sym.replace(/^([A-Ga-g][b#]?)/, "");
    if (/maj7|Δ|maj/i.test(rest)) return "maj7";
    if (/(m7b5|ø)/i.test(rest)) return "m7b5";
    if (/(dim|o7)/i.test(rest)) return "dim7";
    if (/(m7|min7|−7|mi7|m)/i.test(rest)) return "m7";
    if (/(7)/.test(rest)) return "7";
    return "maj7";
  }

  function chordPitchClasses(rootPc, quality) {
    switch (quality) {
      case "maj7": return [0, 4, 7, 11];
      case "m7": return [0, 3, 7, 10];
      case "7": return [0, 4, 7, 10];
      case "m7b5": return [0, 3, 6, 10];
      case "dim7": return [0, 3, 6, 9];
      default: return [0, 4, 7, 11];
    }
  }

  function scalePitchClasses(rootPc, quality) {
    switch (quality) {
      case "maj7": return [0, 2, 4, 5, 7, 9, 11];
      case "m7": return [0, 2, 3, 5, 7, 9, 10];
      case "7": return [0, 2, 4, 5, 7, 9, 10];
      case "m7b5": return [0, 2, 3, 5, 6, 8, 10];
      case "dim7": return [0, 2, 3, 5, 6, 8, 9];
      default: return [0, 2, 4, 5, 7, 9, 11];
    }
  }

  function pcToMidiNear(pc, nearMidi) {
    if (nearMidi == null) return 60 + pc;
    const base = Math.round(nearMidi / 12) * 12;
    const candidates = [base - 12 + pc, base + pc, base + 12 + pc, base + 24 + pc, base - 24 + pc];
    candidates.sort((a, b) => Math.abs(a - nearMidi) - Math.abs(b - nearMidi));
    return candidates[0];
  }

  function clampRange(midi, lo = 60 - 5, hi = 76 + 5) {
    while (midi < lo) midi += 12;
    while (midi > hi) midi -= 12;
    return midi;
  }

  // ========== PIPELINE STAGE 1: RHYTHMIC SKELETON ==========

  function generateRhythmicSkeleton(progression, metadata, options = {}) {
    const { subdivision = 8 } = options; // eighths per bar
    const skeleton = [];
    const totalBars = Math.max(0, ...progression.map(p => p.bar)) + 1;

    for (let bar = 0; bar < totalBars; bar++) {
      for (let i = 0; i < subdivision; i++) {
        skeleton.push({
          bar,
          slot: i,
          startBeat: bar * 4 + i * 0.5,
          durationBeats: 0.5,
        });
      }
    }
    return skeleton;
  }

  // ========== PIPELINE STAGE 2: HARMONIC FUNCTION ASSIGNMENT ==========

  function assignHarmonicFunctions(skeleton, progression, options = {}) {
    const {
      strongBeatRule = 'chord-tone',
      approachRule = 'chromatic-below',
      weakBeatRule = 'scale-step'
    } = options;

    return skeleton.map((slot, idx) => {
      const seg = findChordAtBeat(progression, slot.startBeat);
      const rootPc = parseRoot(seg.symbol) ?? 0;
      const quality = parseQuality(seg.symbol);

      const isStrongBeat = (slot.slot % 4 === 0); // beats 1, 3
      const isApproach = (slot.slot % 4 === 3); // eighth before beats 2, 4

      let harmonicFunc = {
        chordSymbol: seg.symbol,
        rootPc,
        quality,
      };

      if (isStrongBeat) {
        harmonicFunc.function = strongBeatRule;
        harmonicFunc.targetDegree = chooseChordTone();
      } else if (isApproach) {
        harmonicFunc.function = approachRule;
        harmonicFunc.resolvesToNext = true;
      } else {
        harmonicFunc.function = weakBeatRule;
        harmonicFunc.direction = null;
      }

      return { ...slot, ...harmonicFunc };
    });
  }

  // ========== PIPELINE STAGE 3: PITCH REALIZATION ==========

  function realizePitches(functionalPhrase, options = {}) {
    const { startPitch = 64, range = [55, 81] } = options;
    let lastMidi = startPitch;

    return functionalPhrase.map((note, idx) => {
      let midi;
      const nextNote = functionalPhrase[idx + 1];

      switch (note.function) {
        case 'chord-tone':
          midi = resolveChordTone(note, lastMidi);
          break;

        case 'chromatic-below':
          const target = nextNote ? resolveChordTone(nextNote, lastMidi) : lastMidi;
          midi = target - 1;
          break;

        case 'scale-step':
          midi = resolveScaleStep(note, lastMidi);
          break;

        default:
          midi = lastMidi;
      }

      midi = constrainToRange(midi, lastMidi, range);
      lastMidi = midi;

      return {
        startBeat: note.startBeat,
        durationBeats: note.durationBeats,
        midi,
        velocity: 0.9,
        ruleId: note.function,
        harmonicFunction: note.function,
      };
    });
  }

  // ========== STRATEGY SELECTION ==========

  function selectGenerationStrategy(progression, metadata) {
    // Branch based on tempo - fast tempos use simpler approach patterns
    if (metadata.tempo > 200) {
      return {
        strongBeatRule: 'chord-tone',
        approachRule: 'scale-step',
        weakBeatRule: 'scale-step'
      };
    }

    // Default bebop-style strategy
    return {
      strongBeatRule: 'chord-tone',
      approachRule: 'chromatic-below',
      weakBeatRule: 'scale-step'
    };
  }

  // ========== POST-PROCESSING ==========

  function postProcess(phrase, options = {}) {
    // Post-processing stages - currently minimal, ready for extension
    let processed = phrase;
    processed = avoidLeaps(processed, options);
    return processed;
  }

  function avoidLeaps(phrase, options) {
    // Already handled in realizePitches, but can add more sophisticated smoothing here
    return phrase;
  }

  // ========== MAIN GENERATOR ==========

  function generateLick(progression, metadata, options = {}) {
    // Stage 1: Generate rhythmic skeleton
    const skeleton = generateRhythmicSkeleton(progression, metadata, options);

    // Stage 2: Assign harmonic functions (with strategy selection)
    const strategy = selectGenerationStrategy(progression, metadata);
    const functionalPhrase = assignHarmonicFunctions(skeleton, progression, strategy);

    // Stage 3: Realize pitches
    const phrase = realizePitches(functionalPhrase, options);

    // Stage 4: Post-process
    const final = postProcess(phrase, options);

    return final;
  }

  // ========== HELPER FUNCTIONS ==========

  function findChordAtBeat(progression, beat) {
    return progression.find(seg =>
      beat >= seg.startBeat && beat < seg.startBeat + seg.durationBeats
    ) || progression[0];
  }

  function chooseChordTone() {
    const degrees = [1, 3, 5, 7];
    return degrees[Math.floor(Math.random() * degrees.length)];
  }

  function resolveChordTone(note, nearMidi) {
    const chordPcs = chordPitchClasses(note.rootPc, note.quality);
    return nearestChordTone(nearMidi, note.rootPc, chordPcs);
  }

  function nearestChordTone(midiPrev, rootPc, chordPcs) {
    const pcs = chordPcs.map(pc => (rootPc + pc) % 12);
    const candidates = pcs.map(pc => clampRange(pcToMidiNear(pc, midiPrev ?? 64)));
    candidates.sort((a, b) => Math.abs(a - (midiPrev ?? 64)) - Math.abs(b - (midiPrev ?? 64)));
    return candidates[0];
  }

  function resolveScaleStep(note, lastMidi) {
    const scalePcs = scalePitchClasses(note.rootPc, note.quality);
    return scaleStep(lastMidi, note.rootPc, scalePcs);
  }

  function scaleStep(midiPrev, rootPc, scalePcs, dir = 0) {
    const targetPc = ((midiPrev ?? 64) % 12 + 12) % 12;
    const scaleAbs = scalePcs.map(pc => (rootPc + pc + 120) % 12);
    let idx = 0, bestDist = 999;
    for (let i = 0; i < scaleAbs.length; i++) {
      const pc = scaleAbs[i];
      const d = Math.min((pc - targetPc + 12) % 12, (targetPc - pc + 12) % 12);
      if (d < bestDist) { bestDist = d; idx = i; }
    }
    const nextIdx = (idx + (dir || (Math.random() < 0.5 ? 1 : -1)) + scaleAbs.length) % scaleAbs.length;
    let next = pcToMidiNear(scaleAbs[nextIdx], midiPrev ?? 64);
    next = clampRange(next);
    return next;
  }

  function constrainToRange(midi, lastMidi, [lo, hi]) {
    if (Math.abs(midi - lastMidi) > 9) {
      midi = pcToMidiNear((midi % 12 + 12) % 12, lastMidi);
    }
    return clampRange(midi, lo, hi);
  }

  // ========== PUBLIC API ==========

  return {
    generateLick,
    parseRoot,
    parseQuality,
    // Expose pipeline stages for testing/debugging
    generateRhythmicSkeleton,
    assignHarmonicFunctions,
    realizePitches,
  };
})();

