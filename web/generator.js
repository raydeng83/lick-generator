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
   * Uses sharps or flats based on the key signature and scale context
   * @param {number} midi - MIDI note number
   * @param {number} rootPc - Root pitch class (0-11), optional
   * @param {string} scaleName - Scale name for context, optional
   * @returns {string} Note name with octave (e.g., "C4", "Bb3", "F#5")
   */
  function midiToNoteName(midi, rootPc = null, scaleName = null) {
    const octave = Math.floor(midi / 12) - 1;
    const pc = midi % 12;

    // If no root provided, default to sharps
    if (rootPc === null) {
      const sharpNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
      return `${sharpNames[pc]}${octave}`;
    }

    // Check if this note is in the scale - if so, use scale-based spelling
    if (scaleName && window.Scales) {
      const scalePcs = window.Scales.getScalePitchClasses(rootPc, scaleName);
      if (scalePcs.includes(pc)) {
        // Note is in the scale - check what scale degree it is
        const relPc = (pc - rootPc + 12) % 12;

        // Common scale degrees that should use flats:
        // b3 (minor 3rd), b7 (minor 7th), b6 (minor 6th), b2 (flat 9)
        const flatDegrees = [3, 10, 8, 1]; // b3, b7, b6, b2

        if (flatDegrees.includes(relPc)) {
          const flatNames = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
          return `${flatNames[pc]}${octave}`;
        }
      } else {
        // Note is NOT in the scale (chromatic approach note)
        // Check if there's a scale note a half-step above - if so, use flat
        const nextPc = (pc + 1) % 12;
        if (scalePcs.includes(nextPc)) {
          // This is a chromatic lower neighbor - use flat naming
          const flatNames = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
          return `${flatNames[pc]}${octave}`;
        }
      }
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
   * Avoids repeating the previous measure's 1st note
   */
  function prefillTargets(measures, options = {}) {
    const { startPitch = 64 } = options;
    let lastMidi = startPitch;
    let previousFirstNoteMidi = null;

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

      // Filter out the previous measure's 1st note to avoid repetition
      const filteredCandidates = previousFirstNoteMidi !== null
        ? candidates.filter(midi => midi !== previousFirstNoteMidi)
        : candidates;

      // Use filtered candidates, fallback to all candidates if none left
      const finalCandidates = filteredCandidates.length > 0 ? filteredCandidates : candidates;

      // Weighted selection: prefer closer notes but allow variety
      const rand = Math.random();
      let targetMidi;
      if (rand < 0.5 && finalCandidates.length >= 2) {
        // 50%: pick from closest 2
        targetMidi = finalCandidates[Math.floor(Math.random() * Math.min(2, finalCandidates.length))];
      } else if (rand < 0.8 && finalCandidates.length >= 4) {
        // 30%: pick from next 2
        targetMidi = finalCandidates[2 + Math.floor(Math.random() * Math.min(2, finalCandidates.length - 2))];
      } else {
        // 20%: pick from any remaining
        targetMidi = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
      }

      previousFirstNoteMidi = targetMidi;
      lastMidi = targetMidi;

      // Calculate degree for target note
      const degree = getChordDegree(targetMidi, measure.rootPc, chordPcs);

      return {
        ...measure,
        targetNote: {
          midi: targetMidi,
          noteName: midiToNoteName(targetMidi, measure.rootPc, measure.scale),
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
    const noteHistory = []; // Track all non-rest notes for group-of-4 rule

    for (let i = 0; i < measures.length; i++) {
      const measure = measures[i];

      // Add noteHistory to context
      const enrichedContext = {
        ...measure.context,
        noteHistory: [...noteHistory], // Pass copy of history
      };

      // Generate notes for this measure using device
      let measureNotes = [];
      if (window.DevicesNew && measure.device) {
        measureNotes = window.DevicesNew.generateMeasure(enrichedContext, measure.device);
      } else {
        // Fallback: simple pattern
        measureNotes = generateSimpleMeasure(measure);
      }

      // Extract non-rest notes and add to history for next measures
      const nonRestNotes = measureNotes.filter(n => !n.isRest);
      noteHistory.push(...nonRestNotes);

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
        noteName: midiToNoteName(currentMidi, rootPc, scale),
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

  /**
   * Insert random rests with one place per measure
   * Each measure gets one random starting point where 1, 2, or 3 consecutive notes are replaced
   * Protection rules:
   * - Never replace first note of entire lick (target/chord tone)
   * - Never replace last note of entire lick (ending note)
   * - Ensure at least 40% of notes remain as non-rests across entire lick
   * Designed for rhythm practice with evenly distributed rest patterns
   */
  function insertRandomRests(notes, options = {}) {
    if (!notes || notes.length === 0) return notes;

    // Count existing non-rest notes
    const nonRestNotes = notes.filter(n => !n.isRest);
    if (nonRestNotes.length < 5) {
      console.log('[Generator] Too few notes for rest insertion (need at least 5)');
      return notes;
    }

    // Find the last non-rest note index (to protect it)
    let lastNonRestIdx = -1;
    for (let i = notes.length - 1; i >= 0; i--) {
      if (!notes[i].isRest) {
        lastNonRestIdx = i;
        break;
      }
    }

    if (lastNonRestIdx === -1) {
      console.log('[Generator] All notes are rests, cannot insert more');
      return notes;
    }

    // Group notes by measure (assuming 4 beats per measure)
    const measureGroups = new Map(); // Map<measureNumber, noteIndices[]>
    notes.forEach((note, idx) => {
      if (!note.isRest) {
        const measureNum = Math.floor(note.startBeat / 4);
        if (!measureGroups.has(measureNum)) {
          measureGroups.set(measureNum, []);
        }
        measureGroups.get(measureNum).push(idx);
      }
    });

    console.log(`[Generator] Found ${measureGroups.size} measures for rest insertion`);

    // For each measure, select one random place to insert rests
    const selectedPlaces = [];

    for (const [measureNum, noteIndices] of measureGroups.entries()) {
      // Filter out protected notes (first note of lick and last note of lick)
      const replaceableIndices = noteIndices.filter(idx => idx !== 0 && idx !== lastNonRestIdx);

      if (replaceableIndices.length === 0) {
        console.log(`[Generator] Measure ${measureNum}: No replaceable notes, skipping`);
        continue;
      }

      // Randomly pick one starting position in this measure
      const startIdx = replaceableIndices[Math.floor(Math.random() * replaceableIndices.length)];

      // Randomly determine if we replace 1, 2, or 3 notes at this place (equal probability)
      const rand = Math.random();
      const numNotesToReplace = rand < 0.33 ? 1 : (rand < 0.66 ? 2 : 3);

      // Check if we can replace consecutive notes
      let endIdx = startIdx;

      // Helper to check if index is protected (first or last non-rest note)
      const isProtected = (idx) => {
        return idx === 0 || idx === lastNonRestIdx;
      };

      // Try to extend to 2 notes
      if (numNotesToReplace >= 2 && startIdx + 1 < notes.length) {
        const nextIdx = startIdx + 1;
        const nextNote = notes[nextIdx];
        // Check if:
        // - Next note exists and is not a rest
        // - Next note is in the same measure
        // - Next note is not protected
        const nextMeasure = Math.floor(nextNote.startBeat / 4);
        if (!nextNote.isRest && nextMeasure === measureNum && !isProtected(nextIdx)) {
          endIdx = nextIdx;
        }
      }

      // Try to extend to 3 notes
      if (numNotesToReplace === 3 && endIdx === startIdx + 1 && startIdx + 2 < notes.length) {
        const thirdIdx = startIdx + 2;
        const thirdNote = notes[thirdIdx];
        // Check if third note is available, in same measure, and not protected
        const thirdMeasure = Math.floor(thirdNote.startBeat / 4);
        if (!thirdNote.isRest && thirdMeasure === measureNum && !isProtected(thirdIdx)) {
          endIdx = thirdIdx;
        }
      }

      selectedPlaces.push({ startIdx, endIdx, measureNum });
      console.log(`[Generator] Measure ${measureNum}: Selected rest at index ${startIdx}-${endIdx} (${endIdx - startIdx + 1} notes)`);
    }

    // Validate that we're not replacing too many notes
    // Calculate how many notes will be replaced
    const notesToReplace = selectedPlaces.reduce((sum, p) => sum + (p.endIdx - p.startIdx + 1), 0);
    const minNotesToKeep = Math.ceil(nonRestNotes.length * 0.4); // Keep at least 40%
    const notesRemaining = nonRestNotes.length - notesToReplace;

    if (notesRemaining < minNotesToKeep) {
      console.log(`[Generator] Would replace too many notes (${notesToReplace}/${nonRestNotes.length}), keeping minimum ${minNotesToKeep}`);
      // Sort places by size (largest first) and remove until we meet threshold
      selectedPlaces.sort((a, b) => {
        const sizeA = a.endIdx - a.startIdx + 1;
        const sizeB = b.endIdx - b.startIdx + 1;
        return sizeB - sizeA; // Sort by size descending
      });

      // Remove places until we meet the threshold
      while (selectedPlaces.length > 0) {
        const totalToReplace = selectedPlaces.reduce((sum, p) => sum + (p.endIdx - p.startIdx + 1), 0);
        const remaining = nonRestNotes.length - totalToReplace;
        if (remaining >= minNotesToKeep) break;
        const removed = selectedPlaces.pop();
        console.log(`[Generator] Removed rest from measure ${removed.measureNum} to meet threshold`);
      }
    }

    if (selectedPlaces.length === 0) {
      console.log('[Generator] No valid places to insert rests after validation');
      return notes;
    }

    // Sort places by index to process from end to beginning (avoids index shifting issues)
    selectedPlaces.sort((a, b) => b.startIdx - a.startIdx);

    console.log('[Generator] Inserting rests at', selectedPlaces.length, 'places');

    // Replace notes with rests at selected places
    const result = [...notes];

    for (const place of selectedPlaces) {
      const { startIdx, endIdx, measureNum } = place;

      // Calculate combined duration and timing
      const startBeat = result[startIdx].startBeat;
      let totalDuration = result[startIdx].durationBeats;

      // Add duration of all consecutive notes
      for (let idx = startIdx + 1; idx <= endIdx; idx++) {
        totalDuration += result[idx].durationBeats;
      }

      // IMPORTANT: Ensure rest doesn't extend beyond measure boundary
      // Each measure is 4 beats (measure 0: 0-4, measure 1: 4-8, etc.)
      const measureEnd = (measureNum + 1) * 4;
      const restEnd = startBeat + totalDuration;

      if (restEnd > measureEnd) {
        // Clip rest duration to stay within measure boundary
        totalDuration = measureEnd - startBeat;
        console.log(`[Generator] Clipped rest at beat ${startBeat} from ${restEnd - startBeat} to ${totalDuration} beats (measure boundary at ${measureEnd})`);
      }

      // Create rest note with combined duration
      const restNote = {
        startBeat,
        durationBeats: totalDuration,
        isRest: true,
        device: 'rest-inserted', // Mark as inserted rest (vs. device-generated rest)
        chordSymbol: result[startIdx].chordSymbol,
        rootPc: result[startIdx].rootPc,
        quality: result[startIdx].quality,
        scaleName: result[startIdx].scaleName,
      };

      // Replace the note(s) with rest
      const numNotes = endIdx - startIdx + 1;
      result.splice(startIdx, numNotes, restNote);
    }

    return result;
  }

  function postProcess(notes, options = {}) {
    const { swing = 0 } = options;

    // Add note names and scale degrees to all notes
    let processed = notes.map(note => {
      const updatedNote = { ...note };

      // Add note name if missing
      if (!updatedNote.noteName && updatedNote.midi !== undefined) {
        updatedNote.noteName = midiToNoteName(updatedNote.midi, updatedNote.rootPc, updatedNote.scaleName);
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
      const scaleName = window.Scales ? window.Scales.selectScale(quality, options.scaleStrategy || 'default') : 'major';

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
    let final = postProcess(notes, options);
    console.log('[Generator] Phase 4: Post-processing complete');

    // Phase 5: Insert random rests (optional)
    if (options.insertRests) {
      final = insertRandomRests(final, options);
      console.log('[Generator] Phase 5: Random rests inserted');
    }

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

    // FIRST: Check if this note is actually in the chord
    // Only return a degree if the interval is a valid chord tone
    if (!chordPcs.includes(relPc)) {
      return null; // Not a chord tone
    }

    // ONLY include basic chord tones: root, 3rd, 5th, 7th
    // No upper structure notes (9, 11, 13)
    const degreeMap = {
      0: '1',    // root
      3: 'b3',   // minor 3rd
      4: '3',    // major 3rd
      6: 'b5',   // diminished 5th
      7: '5',    // perfect 5th
      8: '#5',   // augmented 5th
      9: '6',    // major 6th (for 6 chords)
      10: 'b7',  // minor 7th
      11: '7'    // major 7th
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
    insertRandomRests,  // Expose for direct use
  };
})();
