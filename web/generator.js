// Target-first generation system
// Phase 1: Pre-fill first note of each measure with chord tone (targets)
// Phase 2: Devices work backwards from targets to fill remaining notes

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

  /**
   * Convert MIDI number to note name with proper enharmonic spelling
   * Uses sharps or flats based on the key signature
   * @param {number} midi - MIDI note number
   * @param {number} rootPc - Root pitch class (0-11), optional
   * @returns {string} Note name with octave (e.g., "C4", "Bb3", "F#5")
   */
  function midiToNoteName(midi, rootPc = null) {
    const octave = Math.floor(midi / 12) - 1;
    const pc = midi % 12;

    // If no root provided, default to sharps
    if (rootPc === null) {
      const sharpNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
      return `${sharpNames[pc]}${octave}`;
    }

    // Determine if key uses sharps or flats based on root
    // Sharp keys: G(7), D(2), A(9), E(4), B(11), F#(6), C#(1)
    // Flat keys: C(0), F(5), Bb(10), Eb(3), Ab(8), Db(1), Gb(6)

    const sharpKeys = [7, 2, 9, 4, 11, 6]; // G, D, A, E, B, F#
    const flatKeys = [0, 5, 10, 3, 8]; // C, F, Bb, Eb, Ab

    const useFlats = flatKeys.includes(rootPc);
    const useSharps = sharpKeys.includes(rootPc);

    // For ambiguous cases (Db/C#, Gb/F#), prefer flats if not in sharp keys
    if (useFlats) {
      const flatNames = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
      return `${flatNames[pc]}${octave}`;
    } else {
      const sharpNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
      return `${sharpNames[pc]}${octave}`;
    }
  }

  // ========== PHASE 1: PRE-FILL TARGETS ==========

  /**
   * Pre-fill first note of each measure with a random chord tone
   * This defines all target notes upfront before device generation
   */
  function prefillTargets(measures, options = {}) {
    const { startPitch = 64 } = options;
    let lastMidi = startPitch;

    return measures.map((measure, idx) => {
      // Get random chord tone near lastMidi
      const chordPcs = chordPitchClasses(measure.rootPc, measure.quality);
      const chordAbs = chordPcs.map(pc => (measure.rootPc + pc) % 12);

      // Build all chord tone candidates in range
      const candidates = [];
      for (let octave = -1; octave <= 2; octave++) {
        for (const pc of chordAbs) {
          const midi = 60 + octave * 12 + pc;
          if (midi >= 55 && midi <= 81) {
            candidates.push(midi);
          }
        }
      }

      // Sort by distance and pick with weighted randomness
      candidates.sort((a, b) => Math.abs(a - lastMidi) - Math.abs(b - lastMidi));

      // Weighted selection: prefer closer notes but allow variety
      const rand = Math.random();
      let targetMidi;
      if (rand < 0.5 && candidates.length >= 2) {
        // 50%: pick from closest 2
        targetMidi = candidates[Math.floor(Math.random() * Math.min(2, candidates.length))];
      } else if (rand < 0.8 && candidates.length >= 4) {
        // 30%: pick from next 2
        targetMidi = candidates[2 + Math.floor(Math.random() * Math.min(2, candidates.length - 2))];
      } else {
        // 20%: pick from any remaining
        targetMidi = candidates[Math.floor(Math.random() * candidates.length)];
      }

      lastMidi = targetMidi;

      // Calculate degree for target note
      const degree = getChordDegree(targetMidi, measure.rootPc, chordPcs);

      return {
        ...measure,
        targetNote: {
          midi: targetMidi,
          noteName: midiToNoteName(targetMidi, measure.rootPc),
          degree,
          startBeat: measure.measureStart,
          durationBeats: 0.5,
          velocity: 0.9,
          ruleId: 'chord-tone',
          harmonicFunction: 'chord-tone',
        },
      };
    });
  }

  // ========== PHASE 2: DEVICE SELECTION ==========

  function selectDevicesForMeasures(measures, options = {}) {
    const { deviceStrategy = 'varied' } = options;

    return measures.map((measure, idx) => {
      const nextMeasure = idx < measures.length - 1 ? measures[idx + 1] : null;

      const context = {
        chord: measure.chord,
        rootPc: measure.rootPc,
        quality: measure.quality,
        scale: measure.scale,
        targetNote: measure.targetNote,
        nextTarget: nextMeasure ? nextMeasure.targetNote : null,
        isLastMeasure: idx === measures.length - 1,
      };

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

  // ========== PHASE 3: GENERATE BACKWARDS FROM TARGETS ==========

  function generateWithTargets(measures, options = {}) {
    const allNotes = [];

    for (let i = 0; i < measures.length; i++) {
      const measure = measures[i];

      // Generate notes for this measure using device
      let measureNotes = [];
      if (window.DevicesNew && measure.device) {
        measureNotes = window.DevicesNew.generateMeasure(measure.context, measure.device);
      } else {
        // Fallback: simple pattern
        measureNotes = generateSimpleMeasure(measure);
      }

      // Add to result
      for (const note of measureNotes) {
        allNotes.push(note);
      }
    }

    return allNotes;
  }

  // ========== FALLBACK: SIMPLE MEASURE GENERATION ==========

  function generateSimpleMeasure(measure) {
    const { measureStart, rootPc, quality, scale, chord, targetNote } = measure;
    const notes = [];

    // Start with target note
    notes.push({
      ...targetNote,
      chordSymbol: chord.symbol,
      rootPc,
      quality,
      scaleName: scale,
    });

    // Fill remaining 7 notes with scale steps
    const scalePcs = window.Scales
      ? window.Scales.getScalePitchClasses(rootPc, scale)
      : [0, 2, 4, 5, 7, 9, 11];

    let currentMidi = targetNote.midi;

    for (let i = 1; i < 8; i++) {
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
        currentMidi = candidates[0] || currentMidi;
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

        currentMidi = nextMidi;
      }

      notes.push({
        startBeat: measureStart + i * 0.5,
        durationBeats: 0.5,
        midi: currentMidi,
        noteName: midiToNoteName(currentMidi, rootPc),
        velocity: 0.9,
        ruleId: 'scale-step',
        harmonicFunction: 'scale-step',
        degree: null,
        scaleName: scale,
        chordSymbol: chord.symbol,
        rootPc,
        quality,
      });
    }

    return notes;
  }

  // ========== POST-PROCESSING ==========

  function postProcess(notes, options = {}) {
    const { swing = 0 } = options;

    // Add note names and scale degrees to all notes
    let processed = notes.map(note => {
      const updatedNote = { ...note };

      // Add note name if missing
      if (!updatedNote.noteName && updatedNote.midi !== undefined) {
        updatedNote.noteName = midiToNoteName(updatedNote.midi, updatedNote.rootPc);
      }

      // Add degree for notes that don't have it (if not already present)
      if (!updatedNote.degree && updatedNote.midi !== undefined &&
          updatedNote.rootPc !== undefined) {

        // Chord tones: add chord degree (1, 3, 5, b7, etc.)
        if (updatedNote.harmonicFunction === 'chord-tone' ||
            updatedNote.ruleId === 'chord-tone' ||
            updatedNote.ruleId === 'arpeggio' ||
            updatedNote.ruleId === 'scale-run-chord-tone' ||
            updatedNote.ruleId === 'melodic-cell-chord-tone') {
          const chordPcs = chordPitchClasses(updatedNote.rootPc, updatedNote.quality);
          const chordDegree = getChordDegree(updatedNote.midi, updatedNote.rootPc, chordPcs);
          if (chordDegree) {
            updatedNote.degree = chordDegree;
          }
        }
        // Scale-step notes: add scale degree (1-7)
        else if (updatedNote.scaleName &&
                 (updatedNote.harmonicFunction === 'scale-step' ||
                  updatedNote.ruleId === 'scale-step' ||
                  updatedNote.ruleId === 'scale-run' ||
                  updatedNote.ruleId === 'melodic-cell')) {
          const scaleDegree = getScaleDegree(updatedNote.midi, updatedNote.rootPc, updatedNote.scaleName);
          if (scaleDegree) {
            updatedNote.degree = scaleDegree;
          }
        }
      }

      return updatedNote;
    });

    if (swing === 0) {
      return processed;
    }

    // Apply swing timing to eighth notes
    return applySwing(processed, swing);
  }

  /**
   * Apply swing timing to eighth notes
   * Swing ratio: 0 = straight (1:1), 0.5 = triplet feel (2:1), 1.0 = extreme (3:1)
   *
   * For each pair of eighth notes on the beat:
   * - First note (on-beat): lengthened
   * - Second note (off-beat): shortened and delayed
   */
  function applySwing(notes, swingRatio) {
    const swung = [];

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const nextNote = i < notes.length - 1 ? notes[i + 1] : null;

      // Check if this is an eighth note pair (both 0.5 beats)
      const isEighthNote = note.durationBeats === 0.5;
      const isOnBeat = isEighthNote && (note.startBeat % 1 === 0); // On whole or half beat
      const hasNextEighthNote = nextNote && nextNote.durationBeats === 0.5 && nextNote.startBeat === note.startBeat + 0.5;

      if (isOnBeat && hasNextEighthNote) {
        // This is the first of an eighth note pair - apply swing

        // Calculate swing adjustment
        // Swing ratio 0.5 = triplet feel (2:1 ratio)
        // First note gets: 0.5 + (swingRatio * 0.167) beats
        // Second note gets: 0.5 - (swingRatio * 0.167) beats
        const swingOffset = swingRatio * (1/6); // 1/6 = 0.167 beats

        // Lengthen first note
        swung.push({
          ...note,
          durationBeats: 0.5 + swingOffset,
        });

        // Shorten and delay second note
        swung.push({
          ...nextNote,
          startBeat: note.startBeat + 0.5 + swingOffset,
          durationBeats: 0.5 - swingOffset,
        });

        // Skip next note since we've already processed it
        i++;
      } else {
        // Not part of a swung pair, keep as-is
        swung.push(note);
      }
    }

    return swung;
  }

  // ========== MAIN GENERATOR ==========

  function generateLick(progression, metadata, options = {}) {
    console.log('[Generator] Target-first system - Starting generation');
    console.log('[Generator] Options:', options);

    // Step 1: Analyze measures
    const totalBars = Math.max(0, ...progression.map(p => p.bar)) + 1;
    const measures = [];

    for (let bar = 0; bar < totalBars; bar++) {
      const measureStart = bar * 4;
      const seg = findChordAtBeat(progression, measureStart);
      const rootPc = parseRoot(seg.symbol) ?? 0;
      const quality = parseQuality(seg.symbol);
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
    console.log('[Generator] Step 1: Analyzed', measures.length, 'measures');

    // Phase 1: Pre-fill target notes (first note of each measure)
    const withTargets = prefillTargets(measures, options);
    console.log('[Generator] Phase 1: Pre-filled target notes');

    // Phase 2: Select devices
    const devicePlanned = selectDevicesForMeasures(withTargets, options);
    console.log('[Generator] Phase 2: Selected devices for each measure');

    // Phase 3: Generate backwards from targets
    const notes = generateWithTargets(devicePlanned, options);
    console.log('[Generator] Phase 3: Generated', notes.length, 'notes');

    // Phase 4: Post-process
    const final = postProcess(notes, options);
    console.log('[Generator] Phase 4: Post-processing complete');

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

  /**
   * Calculate scale degree (1-7) for a note in a scale
   * @param {number} midi - MIDI note number
   * @param {number} rootPc - Root pitch class (0-11)
   * @param {string} scaleName - Scale name (e.g., 'dorian')
   * @returns {string|null} Scale degree as string (1-7) or null if not in scale
   */
  function getScaleDegree(midi, rootPc, scaleName) {
    if (!window.Scales) return null;

    const scalePcs = window.Scales.getScalePitchClasses(rootPc, scaleName);
    const pc = (midi % 12 + 12) % 12;
    const relPc = (pc - rootPc + 12) % 12;

    // Find this pitch class in the scale
    const scaleIndex = scalePcs.indexOf(pc);
    if (scaleIndex === -1) {
      // Not in scale (chromatic note)
      return null;
    }

    // Return 1-indexed scale degree
    return String(scaleIndex + 1);
  }

  // ========== PUBLIC API ==========

  return {
    generateLick,
    parseRoot,
    parseQuality,
    chordPitchClasses,
    prefillTargets,
    selectDevicesForMeasures,
    generateWithTargets,
  };
})();
