// New generation system based on Generation-Steps.md
// Step 1: Put chord tone on first note of each measure (not all strong beats)
// Step 2: Pick devices for each measure
// Step 3: Add variation based on chord quality

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

    // Minor chords first
    if (/(m7b5|ø)/i.test(rest)) return "m7b5";
    if (/(dim|o7)/i.test(rest)) return "dim7";
    if (/(mMaj7|m\(maj7\)|mM7)/i.test(rest)) return "mMaj7";
    if (/(m7).*b6/.test(rest)) return "m7b6";
    if (/(m7|min7|−7|mi7)/i.test(rest)) return "m7";

    // Major chords
    if (/(maj7|Δ|M7).*#11/.test(rest)) return "maj7#11";
    if (/(maj7|Δ|M7).*#5/.test(rest)) return "maj7#5";
    if (/(maj7|Δ|M7)/i.test(rest)) return "maj7";

    // Dominant chords
    if (/(7).*alt/i.test(rest)) return "7alt";
    if (/(7).*#9.*b13/.test(rest)) return "7#9b13";
    if (/(7).*#11/.test(rest)) return "7#11";
    if (/(7).*b13/.test(rest)) return "7b13";
    if (/(7).*#5/.test(rest)) return "7#5";
    if (/(7).*b9/.test(rest)) return "7b9";
    if (/(7).*#9/.test(rest)) return "7#9";
    if (/(7sus4).*b9/.test(rest)) return "7sus4b9";
    if (/(7)/.test(rest)) return "7";

    // Sus chords
    if (/sus4.*b9/.test(rest)) return "sus4b9";

    // Bare "m" for minor triads/chords
    if (/(^m$|^min$|^mi$|^−$)/i.test(rest)) return "m7";

    return "maj7";
  }

  function chordPitchClasses(rootPc, quality) {
    switch (quality) {
      case "maj7":
      case "maj7#11":
        return [0, 4, 7, 11];
      case "maj7#5":
        return [0, 4, 8, 11];
      case "7":
      case "7#11":
      case "7b13":
      case "7b9":
      case "7#9":
      case "7#9b13":
      case "7alt":
      case "7sus4b9":
        return [0, 4, 7, 10];
      case "7#5":
        return [0, 4, 8, 10];
      case "m7":
      case "m7b6":
        return [0, 3, 7, 10];
      case "mMaj7":
        return [0, 3, 7, 11];
      case "m7b5":
        return [0, 3, 6, 10];
      case "dim7":
        return [0, 3, 6, 9];
      case "sus4b9":
        return [0, 5, 7, 10];
      default:
        return [0, 4, 7, 11];
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

  // ========== STEP 1: ANALYZE MEASURES ==========

  function analyzeMeasures(progression, metadata) {
    // Analyze each measure in the progression
    const totalBars = Math.max(0, ...progression.map(p => p.bar)) + 1;
    const measures = [];

    for (let bar = 0; bar < totalBars; bar++) {
      // Find chord for this measure
      const measureStart = bar * 4;
      const seg = findChordAtBeat(progression, measureStart);

      const rootPc = parseRoot(seg.symbol) ?? 0;
      const quality = parseQuality(seg.symbol);

      // Select scale for this chord
      const scaleName = window.Scales ? window.Scales.selectScale(quality, 'default') : 'major';

      measures.push({
        bar,
        measureStart,
        chord: seg,
        rootPc,
        quality,
        scale: scaleName,
      });
    }

    return measures;
  }

  // ========== STEP 2: APPLY VARIATIONS ==========

  function applyVariations(measures, options = {}) {
    // Use Variations module if available
    if (window.Variations) {
      return window.Variations.applyVariations(measures, options);
    }

    // Fallback: no variations
    return measures.map(m => ({
      ...m,
      variations: {
        firstBeatConstraint: 'chord-tone',
        firstBeatOptions: null,
        secondBeatFree: false,
      }
    }));
  }

  // ========== STEP 3: DEVICE SELECTION ==========

  function selectDevicesForMeasures(measures, options = {}) {
    const { deviceStrategy = 'varied' } = options;

    return measures.map((measure, idx) => {
      // Get next measure for enclosure device
      const nextMeasure = idx < measures.length - 1 ? measures[idx + 1] : null;

      // Build context for device selection
      const context = {
        chord: measure.chord,
        rootPc: measure.rootPc,
        quality: measure.quality,
        scale: measure.scale,
        nextChord: nextMeasure ? {
          rootPc: nextMeasure.rootPc,
          quality: nextMeasure.quality,
          scale: nextMeasure.scale,
        } : null,
      };

      // Select device using new system
      let device = null;
      if (window.DevicesNew) {
        device = window.DevicesNew.selectDevice(context, deviceStrategy);
      }

      return {
        ...measure,
        device,
        context,
      };
    });
  }

  // ========== STEP 4: GENERATE WITH DEVICES ==========

  function generateWithDevices(measures, options = {}) {
    const { startPitch = 64 } = options;
    const allNotes = [];
    let lastMidi = startPitch;

    for (let i = 0; i < measures.length; i++) {
      const measure = measures[i];
      const context = {
        ...measure.context,
        lastMidi,
        measureStart: measure.measureStart,
      };

      // Generate notes for this measure using device
      let measureNotes = [];
      if (window.DevicesNew && measure.device) {
        measureNotes = window.DevicesNew.generateMeasure(context, measure.device);
      } else {
        // Fallback: simple chord tone + scale pattern
        measureNotes = generateSimpleMeasure(measure, lastMidi);
      }

      // Add to result
      for (const note of measureNotes) {
        allNotes.push(note);
        lastMidi = note.midi;
      }
    }

    return allNotes;
  }

  // ========== FALLBACK: SIMPLE MEASURE GENERATION ==========

  function generateSimpleMeasure(measure, lastMidi) {
    const { measureStart, rootPc, quality, scale, chord } = measure;
    const notes = [];

    // Generate 8 eighth notes
    const scalePcs = window.Scales
      ? window.Scales.getScalePitchClasses(rootPc, scale)
      : [0, 2, 4, 5, 7, 9, 11];

    let currentMidi = lastMidi;

    for (let i = 0; i < 8; i++) {
      const isStrongBeat = (i % 4 === 0);
      let midi;
      let ruleId;
      let harmonicFunction;
      let degree = null;

      if (isStrongBeat) {
        // Chord tone on strong beats
        const chordPcs = chordPitchClasses(rootPc, quality);
        const chordAbs = chordPcs.map(pc => (rootPc + pc) % 12);

        const candidates = [];
        for (let octave = -1; octave <= 2; octave++) {
          for (const pc of chordAbs) {
            const note = 60 + octave * 12 + pc;
            if (note >= 55 && note <= 81) {
              candidates.push(note);
            }
          }
        }

        candidates.sort((a, b) => Math.abs(a - currentMidi) - Math.abs(b - currentMidi));
        midi = candidates[0] || currentMidi;
        ruleId = 'chord-tone';
        harmonicFunction = 'chord-tone';
        degree = getChordDegree(midi, rootPc, chordPcs);
      } else {
        // Scale step on weak beats
        const scaleAbs = scalePcs.map(pc => (rootPc + pc) % 12);
        const currentPc = currentMidi % 12;

        let idx = scaleAbs.findIndex(pc => pc === currentPc);
        if (idx === -1) {
          // Find nearest scale note
          const candidates = [];
          for (let octave = -1; octave <= 2; octave++) {
            for (const pc of scaleAbs) {
              const note = 60 + octave * 12 + pc;
              if (note >= 55 && note <= 81) {
                candidates.push(note);
              }
            }
          }
          candidates.sort((a, b) => Math.abs(a - currentMidi) - Math.abs(b - currentMidi));
          midi = candidates[0] || currentMidi;
        } else {
          // Move to next scale note
          const direction = Math.random() < 0.5 ? 1 : -1;
          const nextIdx = (idx + direction + scaleAbs.length) % scaleAbs.length;
          const nextPc = scaleAbs[nextIdx];

          let nextMidi = Math.floor(currentMidi / 12) * 12 + nextPc;
          if (direction > 0 && nextMidi <= currentMidi) {
            nextMidi += 12;
          } else if (direction < 0 && nextMidi >= currentMidi) {
            nextMidi -= 12;
          }

          while (nextMidi < 55) nextMidi += 12;
          while (nextMidi > 81) nextMidi -= 12;

          midi = nextMidi;
        }

        ruleId = 'scale-step';
        harmonicFunction = 'scale-step';
      }

      notes.push({
        startBeat: measureStart + i * 0.5,
        durationBeats: 0.5,
        midi,
        velocity: 0.9,
        ruleId,
        harmonicFunction,
        degree,
        scaleName: scale,
        chordSymbol: chord.symbol,
        rootPc,
        quality,
      });

      currentMidi = midi;
    }

    return notes;
  }

  // ========== POST-PROCESSING ==========

  function postProcess(notes, options = {}) {
    // Add any post-processing here
    // For now, just return notes as-is
    return notes;
  }

  // ========== MAIN GENERATOR ==========

  function generateLick(progression, metadata, options = {}) {
    console.log('[Generator] New system - Starting generation');
    console.log('[Generator] Options:', options);

    // Step 1: Analyze measures
    const measures = analyzeMeasures(progression, metadata);
    console.log('[Generator] Step 1: Analyzed', measures.length, 'measures');

    // Step 2: Apply variations (Step 3 from Generation-Steps.md)
    const varied = applyVariations(measures, options);
    console.log('[Generator] Step 2: Applied variations');

    // Step 3: Select devices (Step 2 from Generation-Steps.md)
    const devicePlanned = selectDevicesForMeasures(varied, options);
    console.log('[Generator] Step 3: Selected devices for each measure');

    // Step 4: Generate notes using devices
    const notes = generateWithDevices(devicePlanned, options);
    console.log('[Generator] Step 4: Generated', notes.length, 'notes');

    // Step 5: Post-process
    const final = postProcess(notes, options);
    console.log('[Generator] Step 5: Post-processing complete');

    return final;
  }

  // ========== HELPER FUNCTIONS ==========

  function findChordAtBeat(progression, beat) {
    return progression.find(seg =>
      beat >= seg.startBeat && beat < seg.startBeat + seg.durationBeats
    ) || progression[0];
  }

  function getChordDegree(midi, rootPc, chordPcs) {
    const pc = (midi % 12 + 12) % 12;
    const relPc = (pc - rootPc + 12) % 12;

    const degreeMap = {
      0: '1',
      2: '9',
      3: 'b3',
      4: '3',
      5: '11',
      6: 'b5',
      7: '5',
      9: '13',
      10: 'b7',
      11: '7'
    };

    return degreeMap[relPc] || '?';
  }

  // ========== PUBLIC API ==========

  return {
    generateLick,
    parseRoot,
    parseQuality,
    chordPitchClasses, // Export for devices-new.js
    // Expose pipeline stages for testing/debugging
    analyzeMeasures,
    applyVariations,
    selectDevicesForMeasures,
    generateWithDevices,
  };
})();
