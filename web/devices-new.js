// Target-first device system
// All devices work backwards from pre-filled target notes
// Targets are already defined in Phase 1 before device generation

window.DevicesNew = (function () {

  // ========== DEVICE GENERATORS ==========

  /**
   * Arpeggio Device
   * Generates 3-4 note arpeggio patterns (straight up/down or pivot)
   * Last note must be within 2 semitones of next target
   * For last measure: mixes arpeggios with scale steps for variety
   */
  function generateArpeggio(context) {
    const { chord, rootPc, quality, scale, targetNote, nextTarget, isLastMeasure } = context;
    const measureStart = targetNote.startBeat;
    const notes = [];

    // Start with target note (first note of measure)
    notes.push({
      ...targetNote,
      device: 'arpeggio',
      chordSymbol: chord.symbol,
      rootPc,
      quality,
      scaleName: scale,
    });

    // For last measure, use scale run instead of pure arpeggio
    if (isLastMeasure && window.Scales) {
      const scalePcs = window.Scales.getScalePitchClasses(rootPc, scale);
      const chordPcs = getChordPitchClasses(rootPc, quality);
      const direction = Math.random() < 0.5 ? 1 : -1;
      let currentMidi = targetNote.midi;

      for (let i = 1; i < 7; i++) {
        currentMidi = nextScaleNote(currentMidi, rootPc, scalePcs, direction);
        const isChordToneNote = isChordTone(currentMidi, rootPc, chordPcs);
        const inScale = isInScale(currentMidi, scalePcs);

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
          harmonicFunction: isChordToneNote ? 'chord-tone' : (inScale ? 'scale-step' : 'chromatic'),
        });
      }

      return notes;
    }

    // Get chord tones and scale pitch classes for validation
    const chordPcs = getChordPitchClasses(rootPc, quality);
    const chordAbs = chordPcs.map(pc => (rootPc + pc) % 12);
    const scalePcs = window.Scales ? window.Scales.getScalePitchClasses(rootPc, scale) : [];

    // Decide arpeggio type and direction
    const noteCount = Math.random() < 0.75 ? 4 : 3; // 75% four notes, 25% three notes
    const direction = Math.random() < 0.5 ? 1 : -1; // ascending or descending
    const pivot = Math.random() < 0.2; // 20% chance of pivot arpeggio

    let currentMidi = targetNote.midi;
    let currentOctave = Math.floor(currentMidi / 12);

    // Find starting chord tone index
    const startPc = currentMidi % 12;
    let chordIndex = chordAbs.findIndex(pc => pc === startPc);
    if (chordIndex === -1) chordIndex = 0;

    // Generate arpeggio pattern (6 more notes to fill measure, repeating if needed)
    for (let i = 1; i < 7; i++) {
      // Move to next chord tone
      chordIndex = (chordIndex + direction + chordAbs.length) % chordAbs.length;

      // Reset after completing pattern
      if ((i - 1) % noteCount === 0 && i > 1) {
        if (pivot && i === noteCount + 1) {
          // Pivot: jump octave on first repeat
          currentOctave += direction;
        }
      }

      const pc = chordAbs[chordIndex];
      let midi = currentOctave * 12 + pc;

      // Clamp to range
      while (midi < 55) midi += 12;
      while (midi > 81) midi -= 12;

      // On last note, check proximity to next target
      if (i === 6 && nextTarget && !isLastMeasure) {
        const distance = Math.abs(midi - nextTarget.midi);
        if (distance > 2) {
          // Too far, adjust to be within 2 semitones
          midi = adjustToProximity(midi, nextTarget.midi, chordAbs, currentOctave);
        }
      }

      // Avoid consecutive duplicate notes
      if (midi === currentMidi) {
        midi = avoidConsecutiveDuplicate(currentMidi, () => {
          // Try adjacent chord tones or move by octave
          const nextChordIndex = (chordIndex + direction + chordAbs.length) % chordAbs.length;
          const nextPc = chordAbs[nextChordIndex];
          let candidateMidi = currentOctave * 12 + nextPc;

          // Clamp to range
          while (candidateMidi < 55) candidateMidi += 12;
          while (candidateMidi > 81) candidateMidi -= 12;

          return candidateMidi;
        });
      }

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

      currentMidi = midi;
      currentOctave = Math.floor(midi / 12);
    }

    // Last note for non-last measure (8th note at beat 3.5)
    // Note: currentMidi already holds the last note from the loop, which was already added
    // So we should NOT add it again - this would create a duplicate!
    // The loop generates 7 notes total (target + 6 notes = beats 0, 0.5, 1, 1.5, 2, 2.5, 3)
    // We need an 8th note at beat 3.5 only if it's different from beat 3.0's note
    if (!isLastMeasure) {
      // Check if we need to add an 8th note
      // The loop fills beats 0-3 (7 notes), we need beat 3.5 (8th note)
      // But beat 3 (note 7) already used currentMidi, so adding it again would duplicate
      // We should generate a new note that differs from BOTH the previous note AND next target
      const prevMidi = currentMidi;
      const nextTargetMidi = nextTarget ? nextTarget.midi : null;

      let lastNoteMidi = avoidConsecutiveDuplicate(
        currentMidi,
        () => {
          // Try next chord tone, avoiding next target's MIDI value
          let attempts = 0;
          let midi;
          do {
            chordIndex = (chordIndex + direction + chordAbs.length) % chordAbs.length;
            const pc = chordAbs[chordIndex];
            midi = currentOctave * 12 + pc;

            // Clamp to range
            while (midi < 55) midi += 12;
            while (midi > 81) midi -= 12;

            attempts++;
          } while (nextTargetMidi && midi === nextTargetMidi && attempts < 3);

          return midi;
        }
      );

      const isChordToneNote = isChordTone(lastNoteMidi, rootPc, chordPcs);
      const inScale = isInScale(lastNoteMidi, scalePcs);

      notes.push({
        startBeat: measureStart + 3.5,
        durationBeats: 0.5,
        midi: lastNoteMidi,
        velocity: 0.9,
        device: 'arpeggio',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
        ruleId: isChordToneNote ? 'arpeggio' : (inScale ? 'scale-step' : 'chromatic'),
        harmonicFunction: isChordToneNote ? 'chord-tone' : (inScale ? 'scale-step' : 'chromatic'),
      });
    }

    return notes;
  }

  /**
   * Scale Run Device
   * Generates stepwise scale motion that runs INTO next target
   * Can change direction anywhere in the measure
   * Last note approaches target without repeating it
   */
  function generateScaleRun(context) {
    const { chord, rootPc, quality, scale, targetNote, nextTarget, isLastMeasure } = context;
    const measureStart = targetNote.startBeat;

    if (!window.Scales) return generateArpeggio(context);

    const scalePcs = window.Scales.getScalePitchClasses(rootPc, scale);
    const notes = [];

    // Start with target note
    notes.push({
      ...targetNote,
      device: 'scale-run',
      chordSymbol: chord.symbol,
      rootPc,
      quality,
      scaleName: scale,
    });

    let currentMidi = targetNote.midi;

    // If last measure or no next target, just continue scale
    if (isLastMeasure || !nextTarget) {
      const direction = Math.random() < 0.5 ? 1 : -1;
      const chordPcs = getChordPitchClasses(rootPc, quality);
      for (let i = 1; i < 6; i++) {
        const prevMidi = currentMidi;
        currentMidi = avoidConsecutiveDuplicate(
          currentMidi,
          () => nextScaleNote(prevMidi, rootPc, scalePcs, direction)
        );
        const isChordToneNote = isChordTone(currentMidi, rootPc, chordPcs);
        const inScale = isInScale(currentMidi, scalePcs);
        notes.push({
          startBeat: measureStart + i * 0.5,
          durationBeats: 0.5,
          midi: currentMidi,
          velocity: 0.9,
          device: 'scale-run',
          chordSymbol: chord.symbol,
          rootPc,
          quality,
          scaleName: scale,
          ruleId: isChordToneNote ? 'scale-run-chord-tone' : 'scale-step',
          harmonicFunction: isChordToneNote ? 'chord-tone' : (inScale ? 'scale-step' : 'chromatic'),
        });
      }
      return notes;
    }

    // Calculate direction to approach target
    const targetMidi = nextTarget.midi;
    const startDirection = Math.random() < 0.5 ? 1 : -1;

    // First half: scale run in random direction
    const chordPcs = getChordPitchClasses(rootPc, quality);
    for (let i = 1; i <= 3; i++) {
      const prevMidi = currentMidi;
      currentMidi = avoidConsecutiveDuplicate(
        currentMidi,
        () => nextScaleNote(prevMidi, rootPc, scalePcs, startDirection)
      );
      const isChordToneNote = isChordTone(currentMidi, rootPc, chordPcs);
      const inScale = isInScale(currentMidi, scalePcs);
      notes.push({
        startBeat: measureStart + i * 0.5,
        durationBeats: 0.5,
        midi: currentMidi,
        velocity: 0.9,
        device: 'scale-run',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
        ruleId: isChordToneNote ? 'scale-run-chord-tone' : 'scale-step',
        harmonicFunction: isChordToneNote ? 'chord-tone' : (inScale ? 'scale-step' : 'chromatic'),
      });
    }

    // Second half: run toward target (last 4 notes approach target)
    // Use next chord's scale for approach
    const nextScale = window.Scales.getScalePitchClasses(nextTarget.rootPc || rootPc, context.nextScale || scale);

    const approachNotes = generateScaleApproach(currentMidi, targetMidi, nextScale, nextTarget.rootPc || rootPc, 4);
    for (let i = 0; i < approachNotes.length; i++) {
      const isChordToneNote = isChordTone(approachNotes[i], rootPc, chordPcs);
      const inScale = isInScale(approachNotes[i], scalePcs);
      notes.push({
        startBeat: measureStart + (4 + i) * 0.5,
        durationBeats: 0.5,
        midi: approachNotes[i],
        velocity: 0.9,
        device: 'scale-run',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
        ruleId: isChordToneNote ? 'scale-run-chord-tone' : 'scale-step',
        harmonicFunction: isChordToneNote ? 'chord-tone' : (inScale ? 'scale-step' : 'chromatic'),
      });
    }

    return notes;
  }

  /**
   * Melodic Cell Device
   * Uses 4-note patterns from the scale (1-2-3-5, etc.)
   * Can end with enclosure OR proximity to next target
   */
  function generateMelodicCell(context) {
    const { chord, rootPc, quality, scale, targetNote, nextTarget, isLastMeasure } = context;
    const measureStart = targetNote.startBeat;

    if (!window.MelodicCells || !window.Scales) {
      return generateArpeggio(context);
    }

    const scalePcs = window.Scales.getScalePitchClasses(rootPc, scale);
    const notes = [];

    // Start with target note
    notes.push({
      ...targetNote,
      device: 'melodic-cell',
      chordSymbol: chord.symbol,
      rootPc,
      quality,
      scaleName: scale,
    });

    // Get random cell
    const cell = window.MelodicCells.getRandomCell();
    let currentMidi = targetNote.midi;
    const chordPcs = getChordPitchClasses(rootPc, quality);

    // Generate cell pattern (4 notes starting from beat 0.5)
    for (let i = 0; i < cell.degrees.length && i < 3; i++) {
      const degree = cell.degrees[i];
      const midi = window.MelodicCells.degreeToMidi(degree, rootPc, scalePcs, currentMidi);
      const isChordToneNote = isChordTone(midi, rootPc, chordPcs);
      const inScale = isInScale(midi, scalePcs);

      notes.push({
        startBeat: measureStart + (i + 1) * 0.5,
        durationBeats: 0.5,
        midi,
        velocity: 0.9,
        device: 'melodic-cell',
        cellName: cell.name,
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
        ruleId: isChordToneNote ? 'melodic-cell-chord-tone' : 'melodic-cell',
        harmonicFunction: isChordToneNote ? 'chord-tone' : (inScale ? 'scale-step' : 'chromatic'),
      });

      currentMidi = midi;
    }

    // Decide ending type: enclosure or proximity
    const useEnclosure = !isLastMeasure && nextTarget && Math.random() < 0.5;

    if (useEnclosure) {
      // Fill middle with scale steps
      for (let i = 4; i < 6; i++) {
        currentMidi = nextScaleNote(currentMidi, rootPc, scalePcs, Math.random() < 0.5 ? 1 : -1);
        const isChordToneNote = isChordTone(currentMidi, rootPc, chordPcs);
        const inScale = isInScale(currentMidi, scalePcs);
        notes.push({
          startBeat: measureStart + i * 0.5,
          durationBeats: 0.5,
          midi: currentMidi,
          velocity: 0.9,
          device: 'melodic-cell-fill',
          chordSymbol: chord.symbol,
          rootPc,
          quality,
          scaleName: scale,
          ruleId: isChordToneNote ? 'chord-tone' : 'scale-step',
          harmonicFunction: isChordToneNote ? 'chord-tone' : (inScale ? 'scale-step' : 'chromatic'),
        });
      }

      // Last 2 notes: enclosure
      const targetMidi = nextTarget.midi;
      const nextScalePcs = window.Scales.getScalePitchClasses(nextTarget.rootPc || rootPc, context.nextScale || scale);
      const lowerNeighbor = targetMidi - 1;
      const upperNeighbor = getUpperNeighbor(targetMidi, nextTarget.rootPc || rootPc, nextScalePcs);
      const enclosureType = Math.random() < 0.5 ? 'upper-lower' : 'lower-upper';

      // Check if neighbors are chord tones and in scale
      const upperIsChordTone = isChordTone(upperNeighbor, rootPc, chordPcs);
      const lowerIsChordTone = isChordTone(lowerNeighbor, rootPc, chordPcs);
      const upperInScale = isInScale(upperNeighbor, nextScalePcs);
      const lowerInScale = isInScale(lowerNeighbor, nextScalePcs);

      notes.push({
        startBeat: measureStart + 3,
        durationBeats: 0.5,
        midi: enclosureType === 'upper-lower' ? upperNeighbor : lowerNeighbor,
        velocity: 0.9,
        device: 'enclosure',
        enclosureType: enclosureType === 'upper-lower' ? 'upper' : 'lower',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
        ruleId: 'enclosure',
        harmonicFunction: enclosureType === 'upper-lower'
          ? (upperIsChordTone ? 'chord-tone' : (upperInScale ? 'scale-step' : 'chromatic'))
          : (lowerIsChordTone ? 'chord-tone' : (lowerInScale ? 'scale-step' : 'chromatic')),
      });

      notes.push({
        startBeat: measureStart + 3.5,
        durationBeats: 0.5,
        midi: enclosureType === 'upper-lower' ? lowerNeighbor : upperNeighbor,
        velocity: 0.9,
        device: 'enclosure',
        enclosureType: enclosureType === 'upper-lower' ? 'lower' : 'upper',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
        ruleId: 'enclosure',
        harmonicFunction: enclosureType === 'upper-lower'
          ? (lowerIsChordTone ? 'chord-tone' : (lowerInScale ? 'scale-step' : 'chromatic'))
          : (upperIsChordTone ? 'chord-tone' : (upperInScale ? 'scale-step' : 'chromatic')),
      });
    } else {
      // Proximity ending: fill remaining with scale steps, ensuring last note is close to target
      const notesToFill = isLastMeasure ? 2 : 4;
      for (let i = 4; i < 4 + notesToFill; i++) {
        if (i === 7 && nextTarget) {
          // Last note: ensure proximity to next target
          currentMidi = adjustToProximity(currentMidi, nextTarget.midi, scalePcs, Math.floor(currentMidi / 12));
        } else {
          currentMidi = nextScaleNote(currentMidi, rootPc, scalePcs, Math.random() < 0.5 ? 1 : -1);
        }

        const isChordToneNote = isChordTone(currentMidi, rootPc, chordPcs);
        const inScale = isInScale(currentMidi, scalePcs);
        notes.push({
          startBeat: measureStart + i * 0.5,
          durationBeats: 0.5,
          midi: currentMidi,
          velocity: 0.9,
          device: 'melodic-cell-fill',
          chordSymbol: chord.symbol,
          rootPc,
          quality,
          scaleName: scale,
          ruleId: isChordToneNote ? 'chord-tone' : 'scale-step',
          harmonicFunction: isChordToneNote ? 'chord-tone' : (inScale ? 'scale-step' : 'chromatic'),
        });
      }
    }

    return notes;
  }

  /**
   * Last Measure Enclosure Device
   * For the I chord (resolution), creates enclosure with random ending variation
   *
   * Two random scenarios:
   * A) End BEFORE the 5th note (beat 10): Remove enclosure, end early on root/3rd/5th
   * B) End AFTER the 5th note (beat 10): Keep enclosure, add notes after beat 10, end on root/3rd/5th
   *
   * Ending note rule: Must be root, 3rd, or 5th of the chord
   */
  function generateLastMeasureEnclosure(context) {
    const { chord, rootPc, quality, scale, targetNote } = context;
    const measureStart = targetNote.startBeat;

    const scalePcs = window.Scales.getScalePitchClasses(rootPc, scale);
    const chordPcs = getChordPitchClasses(rootPc, quality);
    const chordAbs = chordPcs.map(pc => (rootPc + pc) % 12);
    const notes = [];

    // Randomly decide: end before or after the 5th note (beat 10)
    const endAfterFifthNote = Math.random() < 0.5;

    // Helper: Get valid ending notes (root, 3rd, 5th only)
    // For maj7 chord: root=0, 3rd=4, 5th=7
    const getValidEndingNote = (nearMidi, excludeMidi = []) => {
      const validIntervals = [0, 4, 7]; // root, 3rd, 5th
      const validPcs = validIntervals.map(interval => (rootPc + interval) % 12);

      const candidates = [];
      for (let octave = -1; octave <= 1; octave++) {
        for (const pc of validPcs) {
          const midi = Math.floor(nearMidi / 12) * 12 + pc + octave * 12;
          if (midi >= 55 && midi <= 81) {
            candidates.push(midi);
          }
        }
      }

      // Sort by distance from nearMidi
      candidates.sort((a, b) => Math.abs(a - nearMidi) - Math.abs(b - nearMidi));

      // Return first candidate that's not excluded
      for (const midi of candidates) {
        if (!excludeMidi.includes(midi)) {
          return midi;
        }
      }

      // If all candidates are excluded, return the first one (fallback)
      return candidates[0] || nearMidi;
    };

    // Slot 0 (beat 8.0): First target note (chord tone)
    notes.push({
      ...targetNote,
      device: 'enclosure-target',
      chordSymbol: chord.symbol,
      rootPc,
      quality,
      scaleName: scale,
    });

    if (!endAfterFifthNote) {
      // ===== SCENARIO A: End BEFORE beat 10 (early ending, no enclosure) =====
      // Fill 1-2 notes, then end on root/3rd/5th (ending at beat 8.5 or 9.0, NOT beat 9.5 or later)
      const numFillNotes = 1 + Math.floor(Math.random() * 2); // 1-2 fill notes
      const totalSlots = numFillNotes + 1; // fill notes + ending note

      let currentMidi = targetNote.midi;

      for (let i = 0; i < totalSlots; i++) {
        const isLastSlot = (i === totalSlots - 1);

        if (isLastSlot) {
          // Last note: must be root/3rd/5th (avoid duplicating previous note and first note of measure)
          currentMidi = getValidEndingNote(currentMidi, [currentMidi, targetNote.midi]);
        } else {
          // Fill with scale steps
          currentMidi = avoidConsecutiveDuplicate(
            currentMidi,
            () => nextScaleNote(currentMidi, rootPc, scalePcs, Math.random() < 0.5 ? 1 : -1)
          );
        }

        const isChordToneNote = isChordTone(currentMidi, rootPc, chordPcs);
        const inScale = isInScale(currentMidi, scalePcs);
        const duration = isLastSlot ? (4.0 - (i + 1) * 0.5) : 0.5; // Last note holds to end

        notes.push({
          startBeat: measureStart + (i + 1) * 0.5,
          durationBeats: isLastSlot ? 0.5 : duration, // All notes are 0.5 beats
          midi: currentMidi,
          velocity: 0.9,
          device: isLastSlot ? 'ending' : 'fill',
          chordSymbol: chord.symbol,
          rootPc,
          quality,
          scaleName: scale,
          ruleId: isChordToneNote ? 'chord-tone' : 'scale-step',
          harmonicFunction: isChordToneNote ? 'chord-tone' : (inScale ? 'scale-step' : 'chromatic'),
        });
      }

      // Fill remaining slots with rests to complete the measure (8 eighth notes)
      const totalNotesGenerated = totalSlots + 1; // target + fill notes + ending
      const remainingBeats = (8 - totalNotesGenerated) * 0.5;
      if (remainingBeats > 0) {
        const restNotes = generateCombinedRests(
          measureStart + totalNotesGenerated * 0.5,
          remainingBeats,
          { symbol: chord.symbol, rootPc, quality, scaleName: scale }
        );
        notes.push(...restNotes);
      }
    } else {
      // ===== SCENARIO B: End AFTER beat 10 (keep enclosure, add more notes) =====

      // Slot 1 (beat 8.5): Fill note with scale step
      let currentMidi = avoidConsecutiveDuplicate(
        targetNote.midi,
        () => nextScaleNote(targetNote.midi, rootPc, scalePcs, Math.random() < 0.5 ? 1 : -1)
      );

      const isChordToneNote1 = isChordTone(currentMidi, rootPc, chordPcs);
      const inScale1 = isInScale(currentMidi, scalePcs);

      notes.push({
        startBeat: measureStart + 0.5,
        durationBeats: 0.5,
        midi: currentMidi,
        velocity: 0.9,
        device: 'enclosure-fill',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
        ruleId: isChordToneNote1 ? 'chord-tone' : 'scale-step',
        harmonicFunction: isChordToneNote1 ? 'chord-tone' : (inScale1 ? 'scale-step' : 'chromatic'),
      });

      // Final target at beat 10.0: Select a chord tone for the resolution (different from beat 0)
      const finalTargetMidi = selectChordTone(currentMidi, chordAbs, [targetNote.midi]);

      // Slots 2-3 (beats 9.0-9.5): Enclosure approaching final target
      const lowerNeighbor = finalTargetMidi - 1;
      const upperNeighbor = getUpperNeighbor(finalTargetMidi, rootPc, scalePcs);

      // Choose enclosure type, but swap if first note would duplicate the fill note
      let enclosureType = Math.random() < 0.5 ? 'upper-lower' : 'lower-upper';
      const firstEnclosureMidi = enclosureType === 'upper-lower' ? upperNeighbor : lowerNeighbor;

      if (firstEnclosureMidi === currentMidi) {
        enclosureType = enclosureType === 'upper-lower' ? 'lower-upper' : 'upper-lower';
      }

      // Check if neighbors are chord tones and in scale
      const upperIsChordTone = isChordTone(upperNeighbor, rootPc, chordPcs);
      const lowerIsChordTone = isChordTone(lowerNeighbor, rootPc, chordPcs);
      const upperInScale = isInScale(upperNeighbor, scalePcs);
      const lowerInScale = isInScale(lowerNeighbor, scalePcs);

      // Slot 2 (beat 9.0): First enclosure note
      notes.push({
        startBeat: measureStart + 1.0,
        durationBeats: 0.5,
        midi: enclosureType === 'upper-lower' ? upperNeighbor : lowerNeighbor,
        velocity: 0.9,
        device: 'enclosure',
        enclosureType: enclosureType === 'upper-lower' ? 'upper' : 'lower',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
        ruleId: 'enclosure',
        harmonicFunction: enclosureType === 'upper-lower'
          ? (upperIsChordTone ? 'chord-tone' : (upperInScale ? 'scale-step' : 'chromatic'))
          : (lowerIsChordTone ? 'chord-tone' : (lowerInScale ? 'scale-step' : 'chromatic')),
      });

      // Slot 3 (beat 9.5): Second enclosure note
      notes.push({
        startBeat: measureStart + 1.5,
        durationBeats: 0.5,
        midi: enclosureType === 'upper-lower' ? lowerNeighbor : upperNeighbor,
        velocity: 0.9,
        device: 'enclosure',
        enclosureType: enclosureType === 'upper-lower' ? 'lower' : 'upper',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
        ruleId: 'enclosure',
        harmonicFunction: enclosureType === 'upper-lower'
          ? (lowerIsChordTone ? 'chord-tone' : (lowerInScale ? 'scale-step' : 'chromatic'))
          : (upperIsChordTone ? 'chord-tone' : (upperInScale ? 'scale-step' : 'chromatic')),
      });

      // Add 0-3 more notes after beat 10, ending on root/3rd/5th
      // 30% chance of 0 (target IS the ending), otherwise 1-3 additional notes
      const additionalSlots = Math.random() < 0.3 ? 0 : (1 + Math.floor(Math.random() * 3)); // 0-3 slots

      // Slot 4 (beat 10.0): 5th note target (chord tone)
      // If no additional notes, this IS the ending
      notes.push({
        startBeat: measureStart + 2.0,
        durationBeats: 0.5,
        midi: finalTargetMidi,
        velocity: 0.9,
        device: additionalSlots === 0 ? 'ending' : 'enclosure-target',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
        ruleId: 'chord-tone',
        harmonicFunction: 'chord-tone',
      });
      currentMidi = finalTargetMidi;

      for (let i = 0; i < additionalSlots; i++) {
        const isLastSlot = (i === additionalSlots - 1);

        if (isLastSlot) {
          // Last note: must be root/3rd/5th (avoid duplicating previous note and first note of measure)
          currentMidi = getValidEndingNote(currentMidi, [currentMidi, targetNote.midi]);
        } else {
          // Fill with scale steps
          currentMidi = avoidConsecutiveDuplicate(
            currentMidi,
            () => nextScaleNote(currentMidi, rootPc, scalePcs, Math.random() < 0.5 ? 1 : -1)
          );
        }

        const isChordToneNote = isChordTone(currentMidi, rootPc, chordPcs);
        const inScale = isInScale(currentMidi, scalePcs);
        const slotIndex = 5 + i;
        const duration = isLastSlot ? (4.0 - slotIndex * 0.5) : 0.5; // Last note holds to end

        notes.push({
          startBeat: measureStart + slotIndex * 0.5,
          durationBeats: isLastSlot ? 0.5 : duration, // All notes are 0.5 beats
          midi: currentMidi,
          velocity: 0.9,
          device: isLastSlot ? 'ending' : 'fill',
          chordSymbol: chord.symbol,
          rootPc,
          quality,
          scaleName: scale,
          ruleId: isChordToneNote ? 'chord-tone' : 'scale-step',
          harmonicFunction: isChordToneNote ? 'chord-tone' : (inScale ? 'scale-step' : 'chromatic'),
        });
      }

      // Fill remaining slots with rests to complete the measure (8 eighth notes)
      const totalNotesGenerated = 5 + additionalSlots; // target + fill + 2 enclosures + target + additional notes
      const remainingBeats = (8 - totalNotesGenerated) * 0.5;
      if (remainingBeats > 0) {
        const restNotes = generateCombinedRests(
          measureStart + totalNotesGenerated * 0.5,
          remainingBeats,
          { symbol: chord.symbol, rootPc, quality, scaleName: scale }
        );
        notes.push(...restNotes);
      }
    }

    return notes;
  }

  /**
   * Neighbor/Enclosure Device
   * Creates two enclosure patterns per measure (mix of 2-note and 3-note)
   * 2-note: Target → Fill(1) → Enclosure(2) → Target
   * 3-note: Target → Enclosure(3) → Target
   * Enclosure uses chromatic and diatonic neighbors based on scale
   *
   * For last measure: Creates enclosure targeting beat 5 and ends on that target
   */
  function generateNeighborEnclosure(context) {
    const { chord, rootPc, quality, scale, targetNote, nextTarget, isLastMeasure, noteHistory = [] } = context;
    const measureStart = targetNote.startBeat;

    if (!window.Scales) {
      return generateArpeggio(context);
    }

    // Handle last measure specially - create enclosure targeting beat 5 and end on it
    if (isLastMeasure || !nextTarget) {
      return generateLastMeasureEnclosure(context);
    }

    const scalePcs = window.Scales.getScalePitchClasses(rootPc, scale);
    const chordPcs = getChordPitchClasses(rootPc, quality);
    const chordAbs = chordPcs.map(pc => (rootPc + pc) % 12);
    const notes = [];

    // Slot 0: First target note (chord tone)
    notes.push({
      ...targetNote,
      device: 'enclosure-target',
      chordSymbol: chord.symbol,
      rootPc,
      quality,
      scaleName: scale,
    });

    // Decide: 2-note or 3-note enclosure for first half (50/50)
    const use3NoteFirst = Math.random() < 0.5;

    let currentMidi = targetNote.midi;
    let middleTargetMidi;

    if (use3NoteFirst) {
      // 3-note enclosure: slots 1, 2, 3 approach middle target (slot 4)
      // Middle target selection - avoid repeating current measure's 1st note and next measure's 1st note
      // Position calculation: noteHistory + non-rest notes so far + 4 more notes (3 enclosure + this target)
      const middleTargetPosition = noteHistory.length + notes.filter(n => !n.isRest).length + 4;
      middleTargetMidi = selectChordTone(currentMidi, chordAbs, [targetNote.midi, nextTarget.midi], noteHistory, middleTargetPosition);

      // Generate 3-note enclosure
      const enclosureNotes = generate3NoteEnclosure(middleTargetMidi, rootPc, scalePcs, chordPcs, chord, quality, scale);

      // Check if any of the 3 enclosure notes would violate group-of-4 rule
      const slot1Position = noteHistory.length + notes.filter(n => !n.isRest).length + 1;
      const slot2Position = slot1Position + 1;
      const slot3Position = slot2Position + 1;
      const enclosureViolates =
        shouldAvoidNote(enclosureNotes[0].midi, noteHistory, slot1Position) ||
        shouldAvoidNote(enclosureNotes[1].midi, noteHistory, slot2Position) ||
        shouldAvoidNote(enclosureNotes[2].midi, noteHistory, slot3Position);

      if (enclosureViolates) {
        // 3-note enclosure would violate, fall back to 2-note enclosure
        // This is handled in the else block, so just set use3NoteFirst to false and continue there
        // Re-use the 2-note enclosure code by jumping into that branch
        // Since we can't modify use3NoteFirst after the if, we'll duplicate the 2-note logic here
        const fillPosition = noteHistory.length + notes.filter(n => !n.isRest).length + 1;
        currentMidi = avoidConsecutiveDuplicate(
          targetNote.midi,
          () => {
            let attempts = 0;
            let candidate;
            do {
              candidate = nextScaleNote(targetNote.midi, rootPc, scalePcs, Math.random() < 0.5 ? 1 : -1);
              attempts++;
            } while (shouldAvoidNote(candidate, noteHistory, fillPosition) && attempts < 10);
            return candidate;
          }
        );

        const isChordToneNote1 = isChordTone(currentMidi, rootPc, chordPcs);
        const inScale1 = isInScale(currentMidi, scalePcs);

        notes.push({
          startBeat: measureStart + 0.5,
          durationBeats: 0.5,
          midi: currentMidi,
          velocity: 0.9,
          device: 'enclosure-fill',
          chordSymbol: chord.symbol,
          rootPc,
          quality,
          scaleName: scale,
          ruleId: isChordToneNote1 ? 'chord-tone' : 'scale-step',
          harmonicFunction: isChordToneNote1 ? 'chord-tone' : (inScale1 ? 'scale-step' : 'chromatic'),
        });

        // Middle target selection for 2-note path
        const middleTargetPosition2 = noteHistory.length + notes.filter(n => !n.isRest).length + 3;
        middleTargetMidi = selectChordTone(currentMidi, chordAbs, [targetNote.midi, nextTarget.midi], noteHistory, middleTargetPosition2);

        // Slots 2-3: 2-note enclosure approaching middle target
        const lowerNeighbor1 = middleTargetMidi - 1;
        const upperNeighbor1 = getUpperNeighbor(middleTargetMidi, rootPc, scalePcs);

        // Check which enclosure notes would violate group-of-4 rule
        const slot2Position = noteHistory.length + notes.filter(n => !n.isRest).length + 1;
        const slot3Position = slot2Position + 1;
        const upperViolatesSlot2 = shouldAvoidNote(upperNeighbor1, noteHistory, slot2Position);
        const lowerViolatesSlot2 = shouldAvoidNote(lowerNeighbor1, noteHistory, slot2Position);
        const upperViolatesSlot3 = shouldAvoidNote(upperNeighbor1, noteHistory, slot3Position);
        const lowerViolatesSlot3 = shouldAvoidNote(lowerNeighbor1, noteHistory, slot3Position);

        // Choose enclosure type based on which order avoids violations
        let enclosureType1;
        if (upperViolatesSlot2 || lowerViolatesSlot3) {
          enclosureType1 = 'lower-upper';
        } else if (lowerViolatesSlot2 || upperViolatesSlot3) {
          enclosureType1 = 'upper-lower';
        } else {
          enclosureType1 = Math.random() < 0.5 ? 'upper-lower' : 'lower-upper';
        }

        const firstEnclosureMidi = enclosureType1 === 'upper-lower' ? upperNeighbor1 : lowerNeighbor1;

        if (firstEnclosureMidi === currentMidi) {
          enclosureType1 = enclosureType1 === 'upper-lower' ? 'lower-upper' : 'upper-lower';
        }

        const upperIsChordTone1 = isChordTone(upperNeighbor1, rootPc, chordPcs);
        const lowerIsChordTone1 = isChordTone(lowerNeighbor1, rootPc, chordPcs);
        const upperInScale1 = isInScale(upperNeighbor1, scalePcs);
        const lowerInScale1 = isInScale(lowerNeighbor1, scalePcs);

        const slot2Midi = enclosureType1 === 'upper-lower' ? upperNeighbor1 : lowerNeighbor1;
        notes.push({
          startBeat: measureStart + 1.0,
          durationBeats: 0.5,
          midi: slot2Midi,
          velocity: 0.9,
          device: 'enclosure',
          enclosureType: enclosureType1 === 'upper-lower' ? 'upper' : 'lower',
          chordSymbol: chord.symbol,
          rootPc,
          quality,
          scaleName: scale,
          ruleId: 'enclosure',
          harmonicFunction: enclosureType1 === 'upper-lower'
            ? (upperIsChordTone1 ? 'chord-tone' : (upperInScale1 ? 'scale-step' : 'chromatic'))
            : (lowerIsChordTone1 ? 'chord-tone' : (lowerInScale1 ? 'scale-step' : 'chromatic')),
        });

        const slot3Midi = enclosureType1 === 'upper-lower' ? lowerNeighbor1 : upperNeighbor1;
        notes.push({
          startBeat: measureStart + 1.5,
          durationBeats: 0.5,
          midi: slot3Midi,
          velocity: 0.9,
          device: 'enclosure',
          enclosureType: enclosureType1 === 'upper-lower' ? 'lower' : 'upper',
          chordSymbol: chord.symbol,
          rootPc,
          quality,
          scaleName: scale,
          ruleId: 'enclosure',
          harmonicFunction: enclosureType1 === 'upper-lower'
            ? (lowerIsChordTone1 ? 'chord-tone' : (lowerInScale1 ? 'scale-step' : 'chromatic'))
            : (upperIsChordTone1 ? 'chord-tone' : (upperInScale1 ? 'scale-step' : 'chromatic')),
        });

        currentMidi = slot3Midi;
      } else {
        // 3-note enclosure is safe, use it
        // Add the 3 notes in slots 1, 2, 3
        for (let i = 0; i < 3; i++) {
          notes.push({
            startBeat: measureStart + (i + 1) * 0.5,
            durationBeats: 0.5,
            midi: enclosureNotes[i].midi,
            velocity: 0.9,
            device: 'enclosure',
            enclosureType: enclosureNotes[i].type,
            chordSymbol: chord.symbol,
            rootPc,
            quality,
            scaleName: scale,
            ruleId: 'enclosure',
            harmonicFunction: enclosureNotes[i].harmonicFunction,
          });
        }

        currentMidi = enclosureNotes[2].midi; // Last enclosure note
      }
    } else {
      // 2-note enclosure: slot 1 fill, slots 2-3 enclosure, slot 4 target
      // Slot 1: Fill note with scale step
      // Position calculation: noteHistory (previous measures) + notes pushed so far + 1 (for this note)
      const fillPosition = noteHistory.length + notes.filter(n => !n.isRest).length + 1;
      currentMidi = avoidConsecutiveDuplicate(
        targetNote.midi,
        () => {
          let attempts = 0;
          let candidate;
          do {
            candidate = nextScaleNote(targetNote.midi, rootPc, scalePcs, Math.random() < 0.5 ? 1 : -1);
            attempts++;
          } while (shouldAvoidNote(candidate, noteHistory, fillPosition) && attempts < 10);
          return candidate;
        }
      );

      const isChordToneNote1 = isChordTone(currentMidi, rootPc, chordPcs);
      const inScale1 = isInScale(currentMidi, scalePcs);

      notes.push({
        startBeat: measureStart + 0.5,
        durationBeats: 0.5,
        midi: currentMidi,
        velocity: 0.9,
        device: 'enclosure-fill',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
        ruleId: isChordToneNote1 ? 'chord-tone' : 'scale-step',
        harmonicFunction: isChordToneNote1 ? 'chord-tone' : (inScale1 ? 'scale-step' : 'chromatic'),
      });

      // Middle target selection - avoid repeating current measure's 1st note and next measure's 1st note
      // Position calculation: noteHistory + non-rest notes so far + 3 more notes (fill + 2 enclosure + this target)
      const middleTargetPosition = noteHistory.length + notes.filter(n => !n.isRest).length + 3;
      middleTargetMidi = selectChordTone(currentMidi, chordAbs, [targetNote.midi, nextTarget.midi], noteHistory, middleTargetPosition);

      // Slots 2-3: 2-note enclosure approaching middle target
      const lowerNeighbor1 = middleTargetMidi - 1;
      const upperNeighbor1 = getUpperNeighbor(middleTargetMidi, rootPc, scalePcs);

      // Check which enclosure notes would violate group-of-4 rule
      const slot2Position = noteHistory.length + notes.filter(n => !n.isRest).length + 1;
      const slot3Position = slot2Position + 1;
      const upperViolatesSlot2 = shouldAvoidNote(upperNeighbor1, noteHistory, slot2Position);
      const lowerViolatesSlot2 = shouldAvoidNote(lowerNeighbor1, noteHistory, slot2Position);
      const upperViolatesSlot3 = shouldAvoidNote(upperNeighbor1, noteHistory, slot3Position);
      const lowerViolatesSlot3 = shouldAvoidNote(lowerNeighbor1, noteHistory, slot3Position);

      // Choose enclosure type based on which order avoids violations
      let enclosureType1;
      if (upperViolatesSlot2 || lowerViolatesSlot3) {
        // upper-lower would violate, use lower-upper
        enclosureType1 = 'lower-upper';
      } else if (lowerViolatesSlot2 || upperViolatesSlot3) {
        // lower-upper would violate, use upper-lower
        enclosureType1 = 'upper-lower';
      } else {
        // Neither violates, choose randomly
        enclosureType1 = Math.random() < 0.5 ? 'upper-lower' : 'lower-upper';
      }

      const firstEnclosureMidi = enclosureType1 === 'upper-lower' ? upperNeighbor1 : lowerNeighbor1;

      // Additional check: swap if first note duplicates current note
      if (firstEnclosureMidi === currentMidi) {
        enclosureType1 = enclosureType1 === 'upper-lower' ? 'lower-upper' : 'upper-lower';
      }

      const upperIsChordTone1 = isChordTone(upperNeighbor1, rootPc, chordPcs);
      const lowerIsChordTone1 = isChordTone(lowerNeighbor1, rootPc, chordPcs);
      const upperInScale1 = isInScale(upperNeighbor1, scalePcs);
      const lowerInScale1 = isInScale(lowerNeighbor1, scalePcs);

      const slot2Midi = enclosureType1 === 'upper-lower' ? upperNeighbor1 : lowerNeighbor1;
      notes.push({
        startBeat: measureStart + 1.0,
        durationBeats: 0.5,
        midi: slot2Midi,
        velocity: 0.9,
        device: 'enclosure',
        enclosureType: enclosureType1 === 'upper-lower' ? 'upper' : 'lower',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
        ruleId: 'enclosure',
        harmonicFunction: enclosureType1 === 'upper-lower'
          ? (upperIsChordTone1 ? 'chord-tone' : (upperInScale1 ? 'scale-step' : 'chromatic'))
          : (lowerIsChordTone1 ? 'chord-tone' : (lowerInScale1 ? 'scale-step' : 'chromatic')),
      });

      const slot3Midi = enclosureType1 === 'upper-lower' ? lowerNeighbor1 : upperNeighbor1;
      notes.push({
        startBeat: measureStart + 1.5,
        durationBeats: 0.5,
        midi: slot3Midi,
        velocity: 0.9,
        device: 'enclosure',
        enclosureType: enclosureType1 === 'upper-lower' ? 'lower' : 'upper',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
        ruleId: 'enclosure',
        harmonicFunction: enclosureType1 === 'upper-lower'
          ? (lowerIsChordTone1 ? 'chord-tone' : (lowerInScale1 ? 'scale-step' : 'chromatic'))
          : (upperIsChordTone1 ? 'chord-tone' : (upperInScale1 ? 'scale-step' : 'chromatic')),
      });

      currentMidi = slot3Midi;
    }

    // Slot 4: Middle target - avoid duplicating last enclosure note and next measure's 1st note
    // Position calculation: noteHistory + non-rest notes so far + 1 (for this note)
    const finalMiddleTargetPosition = noteHistory.length + notes.filter(n => !n.isRest).length + 1;
    let finalMiddleTargetMidi = middleTargetMidi;
    if (finalMiddleTargetMidi === currentMidi) {
      finalMiddleTargetMidi = avoidConsecutiveDuplicate(
        currentMidi,
        () => selectChordTone(currentMidi, chordAbs, [targetNote.midi, currentMidi, nextTarget.midi], noteHistory, finalMiddleTargetPosition)
      );
    }

    notes.push({
      startBeat: measureStart + 2.0,
      durationBeats: 0.5,
      midi: finalMiddleTargetMidi,
      velocity: 0.9,
      device: 'enclosure-target',
      chordSymbol: chord.symbol,
      rootPc,
      quality,
      scaleName: scale,
      ruleId: 'chord-tone',
      harmonicFunction: 'chord-tone',
    });

    // Decide: 2-note or 3-note enclosure for second half (50/50)
    const use3NoteSecond = Math.random() < 0.5;
    const nextTargetMidi = nextTarget.midi;
    const nextScalePcs = window.Scales.getScalePitchClasses(nextTarget.rootPc || rootPc, context.nextScale || scale);

    if (use3NoteSecond) {
      // 3-note enclosure: slots 5, 6, 7 approach next target (slot 8/next measure)
      const enclosureNotes = generate3NoteEnclosure(nextTargetMidi, nextTarget.rootPc || rootPc, nextScalePcs, chordPcs, chord, quality, scale);

      // Check if any of the 3 enclosure notes would violate group-of-4 rule
      const slot5Position = noteHistory.length + notes.filter(n => !n.isRest).length + 1;
      const slot6Position = slot5Position + 1;
      const slot7Position = slot6Position + 1;
      const enclosureViolates =
        shouldAvoidNote(enclosureNotes[0].midi, noteHistory, slot5Position) ||
        shouldAvoidNote(enclosureNotes[1].midi, noteHistory, slot6Position) ||
        shouldAvoidNote(enclosureNotes[2].midi, noteHistory, slot7Position);

      if (enclosureViolates) {
        // 3-note enclosure would violate, fall back to 2-note enclosure
        // Slot 5: Fill note
        const fill2Position = noteHistory.length + notes.filter(n => !n.isRest).length + 1;
        currentMidi = avoidConsecutiveDuplicate(
          finalMiddleTargetMidi,
          () => {
            let attempts = 0;
            let candidate;
            do {
              candidate = nextScaleNote(finalMiddleTargetMidi, rootPc, scalePcs, Math.random() < 0.5 ? 1 : -1);
              attempts++;
            } while (shouldAvoidNote(candidate, noteHistory, fill2Position) && attempts < 10);
            return candidate;
          }
        );

        const isChordToneNote2 = isChordTone(currentMidi, rootPc, chordPcs);
        const inScale2 = isInScale(currentMidi, scalePcs);

        notes.push({
          startBeat: measureStart + 2.5,
          durationBeats: 0.5,
          midi: currentMidi,
          velocity: 0.9,
          device: 'enclosure-fill',
          chordSymbol: chord.symbol,
          rootPc,
          quality,
          scaleName: scale,
          ruleId: isChordToneNote2 ? 'chord-tone' : 'scale-step',
          harmonicFunction: isChordToneNote2 ? 'chord-tone' : (inScale2 ? 'scale-step' : 'chromatic'),
        });

        // Slots 6-7: 2-note enclosure approaching next target
        const lowerNeighbor2 = nextTargetMidi - 1;
        const upperNeighbor2 = getUpperNeighbor(nextTargetMidi, nextTarget.rootPc || rootPc, nextScalePcs);

        // Check which enclosure notes would violate group-of-4 rule
        const slot6Position = noteHistory.length + notes.filter(n => !n.isRest).length + 1;
        const slot7Position = slot6Position + 1;
        const upperViolatesSlot6 = shouldAvoidNote(upperNeighbor2, noteHistory, slot6Position);
        const lowerViolatesSlot6 = shouldAvoidNote(lowerNeighbor2, noteHistory, slot6Position);
        const upperViolatesSlot7 = shouldAvoidNote(upperNeighbor2, noteHistory, slot7Position);
        const lowerViolatesSlot7 = shouldAvoidNote(lowerNeighbor2, noteHistory, slot7Position);

        // Choose enclosure type based on which order avoids violations
        let enclosureType2;
        if (upperViolatesSlot6 || lowerViolatesSlot7) {
          enclosureType2 = 'lower-upper';
        } else if (lowerViolatesSlot6 || upperViolatesSlot7) {
          enclosureType2 = 'upper-lower';
        } else {
          enclosureType2 = Math.random() < 0.5 ? 'upper-lower' : 'lower-upper';
        }

        const firstEnclosureMidi2 = enclosureType2 === 'upper-lower' ? upperNeighbor2 : lowerNeighbor2;

        if (firstEnclosureMidi2 === currentMidi) {
          enclosureType2 = enclosureType2 === 'upper-lower' ? 'lower-upper' : 'upper-lower';
        }

        const upperIsChordTone2 = isChordTone(upperNeighbor2, rootPc, chordPcs);
        const lowerIsChordTone2 = isChordTone(lowerNeighbor2, rootPc, chordPcs);
        const upperInScale2 = isInScale(upperNeighbor2, nextScalePcs);
        const lowerInScale2 = isInScale(lowerNeighbor2, nextScalePcs);

        notes.push({
          startBeat: measureStart + 3.0,
          durationBeats: 0.5,
          midi: enclosureType2 === 'upper-lower' ? upperNeighbor2 : lowerNeighbor2,
          velocity: 0.9,
          device: 'enclosure',
          enclosureType: enclosureType2 === 'upper-lower' ? 'upper' : 'lower',
          chordSymbol: chord.symbol,
          rootPc,
          quality,
          scaleName: scale,
          ruleId: 'enclosure',
          harmonicFunction: enclosureType2 === 'upper-lower'
            ? (upperIsChordTone2 ? 'chord-tone' : (upperInScale2 ? 'scale-step' : 'chromatic'))
            : (lowerIsChordTone2 ? 'chord-tone' : (lowerInScale2 ? 'scale-step' : 'chromatic')),
        });

        notes.push({
          startBeat: measureStart + 3.5,
          durationBeats: 0.5,
          midi: enclosureType2 === 'upper-lower' ? lowerNeighbor2 : upperNeighbor2,
          velocity: 0.9,
          device: 'enclosure',
          enclosureType: enclosureType2 === 'upper-lower' ? 'lower' : 'upper',
          chordSymbol: chord.symbol,
          rootPc,
          quality,
          scaleName: scale,
          ruleId: 'enclosure',
          harmonicFunction: enclosureType2 === 'upper-lower'
            ? (lowerIsChordTone2 ? 'chord-tone' : (lowerInScale2 ? 'scale-step' : 'chromatic'))
            : (upperIsChordTone2 ? 'chord-tone' : (upperInScale2 ? 'scale-step' : 'chromatic')),
        });
      } else {
        // 3-note enclosure is safe, use it
        // Add the 3 notes in slots 5, 6, 7
        for (let i = 0; i < 3; i++) {
          notes.push({
            startBeat: measureStart + (i + 5) * 0.5,
            durationBeats: 0.5,
            midi: enclosureNotes[i].midi,
            velocity: 0.9,
            device: 'enclosure',
            enclosureType: enclosureNotes[i].type,
            chordSymbol: chord.symbol,
            rootPc,
            quality,
            scaleName: scale,
            ruleId: 'enclosure',
            harmonicFunction: enclosureNotes[i].harmonicFunction,
          });
        }
      }
    } else {
      // 2-note enclosure: slot 5 fill, slots 6-7 enclosure
      // Slot 5: Fill note
      // Position calculation: noteHistory + non-rest notes so far + 1 (for this note)
      const fill2Position = noteHistory.length + notes.filter(n => !n.isRest).length + 1;
      currentMidi = avoidConsecutiveDuplicate(
        finalMiddleTargetMidi,
        () => {
          let attempts = 0;
          let candidate;
          do {
            candidate = nextScaleNote(finalMiddleTargetMidi, rootPc, scalePcs, Math.random() < 0.5 ? 1 : -1);
            attempts++;
          } while (shouldAvoidNote(candidate, noteHistory, fill2Position) && attempts < 10);
          return candidate;
        }
      );

      const isChordToneNote2 = isChordTone(currentMidi, rootPc, chordPcs);
      const inScale2 = isInScale(currentMidi, scalePcs);

      notes.push({
        startBeat: measureStart + 2.5,
        durationBeats: 0.5,
        midi: currentMidi,
        velocity: 0.9,
        device: 'enclosure-fill',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
        ruleId: isChordToneNote2 ? 'chord-tone' : 'scale-step',
        harmonicFunction: isChordToneNote2 ? 'chord-tone' : (inScale2 ? 'scale-step' : 'chromatic'),
      });

      // Slots 6-7: 2-note enclosure approaching next target
      const lowerNeighbor2 = nextTargetMidi - 1;
      const upperNeighbor2 = getUpperNeighbor(nextTargetMidi, nextTarget.rootPc || rootPc, nextScalePcs);

      // Check which enclosure notes would violate group-of-4 rule
      const slot6Position = noteHistory.length + notes.filter(n => !n.isRest).length + 1;
      const slot7Position = slot6Position + 1;
      const upperViolatesSlot6 = shouldAvoidNote(upperNeighbor2, noteHistory, slot6Position);
      const lowerViolatesSlot6 = shouldAvoidNote(lowerNeighbor2, noteHistory, slot6Position);
      const upperViolatesSlot7 = shouldAvoidNote(upperNeighbor2, noteHistory, slot7Position);
      const lowerViolatesSlot7 = shouldAvoidNote(lowerNeighbor2, noteHistory, slot7Position);

      // Choose enclosure type based on which order avoids violations
      let enclosureType2;
      if (upperViolatesSlot6 || lowerViolatesSlot7) {
        // upper-lower would violate, use lower-upper
        enclosureType2 = 'lower-upper';
      } else if (lowerViolatesSlot6 || upperViolatesSlot7) {
        // lower-upper would violate, use upper-lower
        enclosureType2 = 'upper-lower';
      } else {
        // Neither violates, choose randomly
        enclosureType2 = Math.random() < 0.5 ? 'upper-lower' : 'lower-upper';
      }

      const firstEnclosureMidi2 = enclosureType2 === 'upper-lower' ? upperNeighbor2 : lowerNeighbor2;

      // Additional check: swap if first note duplicates current note
      if (firstEnclosureMidi2 === currentMidi) {
        enclosureType2 = enclosureType2 === 'upper-lower' ? 'lower-upper' : 'upper-lower';
      }

      const upperIsChordTone2 = isChordTone(upperNeighbor2, rootPc, chordPcs);
      const lowerIsChordTone2 = isChordTone(lowerNeighbor2, rootPc, chordPcs);
      const upperInScale2 = isInScale(upperNeighbor2, nextScalePcs);
      const lowerInScale2 = isInScale(lowerNeighbor2, nextScalePcs);

      notes.push({
        startBeat: measureStart + 3.0,
        durationBeats: 0.5,
        midi: enclosureType2 === 'upper-lower' ? upperNeighbor2 : lowerNeighbor2,
        velocity: 0.9,
        device: 'enclosure',
        enclosureType: enclosureType2 === 'upper-lower' ? 'upper' : 'lower',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
        ruleId: 'enclosure',
        harmonicFunction: enclosureType2 === 'upper-lower'
          ? (upperIsChordTone2 ? 'chord-tone' : (upperInScale2 ? 'scale-step' : 'chromatic'))
          : (lowerIsChordTone2 ? 'chord-tone' : (lowerInScale2 ? 'scale-step' : 'chromatic')),
      });

      notes.push({
        startBeat: measureStart + 3.5,
        durationBeats: 0.5,
        midi: enclosureType2 === 'upper-lower' ? lowerNeighbor2 : upperNeighbor2,
        velocity: 0.9,
        device: 'enclosure',
        enclosureType: enclosureType2 === 'upper-lower' ? 'lower' : 'upper',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
        ruleId: 'enclosure',
        harmonicFunction: enclosureType2 === 'upper-lower'
          ? (lowerIsChordTone2 ? 'chord-tone' : (lowerInScale2 ? 'scale-step' : 'chromatic'))
          : (upperIsChordTone2 ? 'chord-tone' : (upperInScale2 ? 'scale-step' : 'chromatic')),
      });
    }

    return notes;
  }

  /**
   * Generate 3-note enclosure pattern
   * Returns 3 notes with correct ordering: two notes on same side must be consecutive
   * Rule: When two notes on one side, outside note first, then inside note (towards target)
   */
  function generate3NoteEnclosure(targetMidi, rootPc, scalePcs, chordPcs, chord, quality, scale) {
    // Choose enclosure option: 50/50 between option 1 and option 2
    const useOption1 = Math.random() < 0.5;

    let outsideNote, insideNote, oppositeSideNote;

    if (useOption1) {
      // Option 1: Two lower + one upper
      // Outside (whole-step lower - 2 semitones below target)
      outsideNote = { midi: targetMidi - 2, type: 'lower-whole', side: 'lower', position: 'outside' };
      // Inside (half-step lower - 1 semitone below target)
      insideNote = { midi: targetMidi - 1, type: 'lower', side: 'lower', position: 'inside' };
      // Opposite side (scale note from above target)
      oppositeSideNote = { midi: getUpperNeighbor(targetMidi, rootPc, scalePcs), type: 'upper', side: 'upper', position: 'single' };
    } else {
      // Option 2: One lower + two upper
      // Opposite side (half-step lower - 1 semitone below target)
      oppositeSideNote = { midi: targetMidi - 1, type: 'lower', side: 'lower', position: 'single' };
      // Inside (half-step higher - 1 semitone above target)
      insideNote = { midi: targetMidi + 1, type: 'upper', side: 'upper', position: 'inside' };
      // Outside (whole-step higher - 2 semitones above target)
      outsideNote = { midi: targetMidi + 2, type: 'upper-whole', side: 'upper', position: 'outside' };
    }

    // Check each note against scale to determine harmonicFunction
    const notes = [outsideNote, insideNote, oppositeSideNote];
    for (const note of notes) {
      const pc = (note.midi % 12 + 12) % 12;
      const inScale = scalePcs.includes(pc);

      if (inScale) {
        // Check if it's a chord tone or just a scale step
        const isChordToneNote = isChordTone(note.midi, rootPc, chordPcs);
        note.harmonicFunction = isChordToneNote ? 'chord-tone' : 'scale-step';
      } else {
        // Outside the scale - chromatic
        note.harmonicFunction = 'chromatic';
      }
    }

    // Choose starting side: 50/50 between lower side or upper side
    const startFromLowerSide = Math.random() < 0.5;

    let enclosureNotes;
    if (useOption1) {
      // Option 1: Two lower + one upper
      if (startFromLowerSide) {
        // Start from lower side: outside lower → inside lower → upper
        enclosureNotes = [outsideNote, insideNote, oppositeSideNote];
      } else {
        // Start from upper side: upper → outside lower → inside lower
        enclosureNotes = [oppositeSideNote, outsideNote, insideNote];
      }
    } else {
      // Option 2: One lower + two upper
      if (startFromLowerSide) {
        // Start from lower side: lower → outside upper → inside upper
        enclosureNotes = [oppositeSideNote, outsideNote, insideNote];
      } else {
        // Start from upper side: outside upper → inside upper → lower
        enclosureNotes = [outsideNote, insideNote, oppositeSideNote];
      }
    }

    return enclosureNotes;
  }

  /**
   * Select a chord tone near the current pitch
   * @param {number} currentMidi - Current MIDI note
   * @param {number[]} chordAbs - Absolute chord pitch classes
   * @param {number[]} excludeMidi - Optional array of MIDI notes to avoid
   * @param {Array} noteHistory - Optional array of previously generated notes for group-of-4 rule
   * @param {number} currentPosition - Optional current position (1-indexed) for group-of-4 rule
   */
  function selectChordTone(currentMidi, chordAbs, excludeMidi = [], noteHistory = [], currentPosition = 0) {
    const candidates = [];

    // Find chord tones in nearby octaves
    for (let octave = -1; octave <= 1; octave++) {
      for (const pc of chordAbs) {
        const midi = Math.floor(currentMidi / 12) * 12 + pc + octave * 12;
        if (midi >= 55 && midi <= 81) {
          candidates.push(midi);
        }
      }
    }

    // Sort by distance from current note
    candidates.sort((a, b) => Math.abs(a - currentMidi) - Math.abs(b - currentMidi));

    // Filter candidates based on:
    // 1. Not equal to currentMidi
    // 2. Not in excludeMidi
    // 3. Not violating group-of-4 rule (if history provided)
    const validCandidates = candidates.filter(midi => {
      if (midi === currentMidi) return false;
      if (excludeMidi.includes(midi)) return false;
      if (noteHistory.length > 0 && currentPosition > 0 && shouldAvoidNote(midi, noteHistory, currentPosition)) return false;
      return true;
    });

    // Return first valid candidate, or fallback to first candidate
    if (validCandidates.length > 0) {
      return validCandidates[0];
    }

    // If all nearby candidates are excluded, return the first candidate (fallback)
    return candidates[0] || currentMidi;
  }

  /**
   * Check if a MIDI note is a chord tone
   * @param {number} midi - MIDI note number
   * @param {number} rootPc - Root pitch class
   * @param {number[]} chordPcs - Chord pitch classes (relative intervals)
   * @returns {boolean} True if note is a chord tone
   */
  function isChordTone(midi, rootPc, chordPcs) {
    const pc = (midi % 12 + 12) % 12;
    const relPc = (pc - rootPc + 12) % 12;
    return chordPcs.includes(relPc);
  }

  /**
   * Check if a MIDI note is in the scale
   * @param {number} midi - MIDI note number
   * @param {number[]} scalePcs - Scale pitch classes (absolute)
   * @returns {boolean} True if note is in the scale
   */
  function isInScale(midi, scalePcs) {
    const pc = (midi % 12 + 12) % 12;
    return scalePcs.includes(pc);
  }

  /**
   * Check if candidate note would violate group-of-4 repetition rule
   * Rule: In groups of 4 (1-2-3-4, 3-4-5-6, ...):
   *   - Position N ≠ Position N+2 (positions 1 & 3, or 2 & 4 in group)
   *   - Position N ≠ Position N-2 (same rule, backwards)
   *
   * @param {number} candidateMidi - MIDI note being considered
   * @param {Array} noteHistory - All non-rest notes generated so far
   * @param {number} currentPosition - Position this note would have (1-indexed)
   * @returns {boolean} True if note should be avoided
   */
  function shouldAvoidNote(candidateMidi, noteHistory, currentPosition) {
    // Position is 1-indexed in the sequence of non-rest notes
    // Check if we would violate rules with notes 2 positions before

    // Check 2 positions back (if candidate is at position N, check position N-2)
    const positionMinus2 = currentPosition - 2;
    if (positionMinus2 >= 1 && noteHistory[positionMinus2 - 1]) {
      const noteMinus2 = noteHistory[positionMinus2 - 1].midi;
      if (candidateMidi === noteMinus2) {
        return true; // Would repeat with note 2 positions back
      }
    }

    // We can't check 2 positions forward since those notes don't exist yet
    // But the constraint is symmetric - when we generate position N+2,
    // it will check back to position N

    return false;
  }

  /**
   * Generate a note that avoids being the same as the previous note
   * @param {number} previousMidi - MIDI of the previous note
   * @param {function} generateFn - Function that generates a candidate note
   * @param {number} maxAttempts - Maximum retry attempts (default 3)
   * @returns {number} MIDI note that's different from previous
   */
  function avoidConsecutiveDuplicate(previousMidi, generateFn, maxAttempts = 3) {
    let attempts = 0;
    let midi;

    do {
      midi = generateFn();
      attempts++;
    } while (midi === previousMidi && attempts < maxAttempts);

    // If still same after max attempts, force a different note by moving +/-1 semitone
    if (midi === previousMidi) {
      // Try moving up first, then down if at range limit
      if (midi < 81) {
        midi = previousMidi + 1;
      } else {
        midi = previousMidi - 1;
      }
    }

    return midi;
  }

  // ========== DEVICE SELECTION ==========

  function selectDevice(context, strategy = 'varied') {
    switch (strategy) {
      case 'arpeggio-focused':
        return 'arpeggio';

      case 'scale-focused':
        return 'scale-run';

      case 'arpeggio-scale-mix':
        // 50/50 random between arpeggio and scale-run
        return Math.random() < 0.5 ? 'arpeggio' : 'scale-run';

      case 'cell-focused':
        return 'melodic-cell';

      case 'neighbor-enclosure':
        return 'neighbor-enclosure';

      case 'varied':
      default:
        const rand = Math.random();
        if (rand < 0.25) return 'arpeggio';
        if (rand < 0.50) return 'scale-run';
        if (rand < 0.75) return 'melodic-cell';
        return 'neighbor-enclosure';
    }
  }

  function generateMeasure(context, deviceType = 'arpeggio') {
    switch (deviceType) {
      case 'arpeggio':
        return generateArpeggio(context);
      case 'scale-run':
        return generateScaleRun(context);
      case 'melodic-cell':
        return generateMelodicCell(context);
      case 'neighbor-enclosure':
        return generateNeighborEnclosure(context);
      default:
        return generateArpeggio(context);
    }
  }

  // ========== HELPER FUNCTIONS ==========

  /**
   * Get the midpoint beat of the measure containing the given beat
   * In 4/4 time, each measure is 4 beats, and the midpoint is at beat 2 of each measure
   * @param {number} beat - A beat position
   * @returns {number} The beat position of the measure's midpoint
   */
  function getMeasureMidpoint(beat) {
    // Each measure is 4 beats
    // Midpoint is at beat 2 of each measure (beats 2, 6, 10, etc.)
    const measureStart = Math.floor(beat / 4) * 4;
    return measureStart + 2;
  }

  /**
   * Generate properly combined rests according to music notation rules
   * Combines consecutive rests into larger note values (quarter, half) when possible
   * IMPORTANT: Follows the "break the middle of the bar" rule - rests cannot cross
   * the measure midpoint (beat 2 of each measure in 4/4 time)
   *
   * @param {number} startBeat - Starting beat for the rest(s)
   * @param {number} totalBeats - Total duration of rest in beats
   * @param {object} chord - Chord context (symbol, rootPc, quality, scaleName)
   * @returns {Array} Array of rest note objects with proper durations
   */
  function generateCombinedRests(startBeat, totalBeats, chord) {
    const rests = [];
    let currentBeat = startBeat;
    let remainingBeats = totalBeats;

    while (remainingBeats > 0) {
      // Calculate measure context
      const measureMidpoint = getMeasureMidpoint(currentBeat);
      const beatsUntilMidpoint = measureMidpoint - currentBeat;

      let restDuration;

      // Check if we're before the midpoint
      if (currentBeat < measureMidpoint) {
        // FIRST HALF: Cannot cross midpoint with rest duration
        if (remainingBeats >= 2 && beatsUntilMidpoint >= 2) {
          // Safe to use half rest (stays entirely in first half)
          restDuration = 2;
        } else if (remainingBeats >= 1 && beatsUntilMidpoint >= 1) {
          // Use quarter rest
          restDuration = 1;
        } else {
          // Use eighth rest (or whatever fits before midpoint)
          restDuration = Math.min(0.5, beatsUntilMidpoint);
        }
      } else {
        // SECOND HALF or AT MIDPOINT: Normal greedy algorithm
        if (remainingBeats >= 2) {
          // Use half rest (2 beats)
          restDuration = 2;
        } else if (remainingBeats >= 1) {
          // Use quarter rest (1 beat)
          restDuration = 1;
        } else {
          // Use eighth rest (0.5 beats)
          restDuration = 0.5;
        }
      }

      rests.push({
        startBeat: currentBeat,
        durationBeats: restDuration,
        isRest: true,
        device: 'rest',
        chordSymbol: chord.symbol,
        rootPc: chord.rootPc,
        quality: chord.quality,
        scaleName: chord.scaleName,
      });

      currentBeat += restDuration;
      remainingBeats -= restDuration;
    }

    return rests;
  }

  function getChordPitchClasses(rootPc, quality) {
    if (window.LickGen) {
      return window.LickGen.chordPitchClasses(rootPc, quality);
    }
    return [0, 4, 7, 11];
  }

  function nextScaleNote(midi, rootPc, scalePcs, direction = 1) {
    const pc = midi % 12;
    // scalePcs is already absolute pitch classes, don't add rootPc again!
    const scaleAbs = scalePcs;

    let idx = scaleAbs.findIndex(p => p === pc);
    if (idx === -1) {
      // Find nearest scale note
      const candidates = [];
      for (let octave = -1; octave <= 2; octave++) {
        for (const spc of scaleAbs) {
          const note = 60 + octave * 12 + spc;
          if (note >= 55 && note <= 81) {
            candidates.push(note);
          }
        }
      }
      candidates.sort((a, b) => Math.abs(a - midi) - Math.abs(b - midi));
      return candidates[0] || midi;
    }

    idx = (idx + direction + scaleAbs.length) % scaleAbs.length;
    const nextPc = scaleAbs[idx];

    let nextMidi = Math.floor(midi / 12) * 12 + nextPc;

    if (direction > 0 && nextMidi <= midi) {
      nextMidi += 12;
    } else if (direction < 0 && nextMidi >= midi) {
      nextMidi -= 12;
    }

    // Clamp to range
    while (nextMidi < 55) nextMidi += 12;
    while (nextMidi > 81) nextMidi -= 12;

    return nextMidi;
  }

  function getUpperNeighbor(targetMidi, rootPc, scalePcs) {
    const targetPc = targetMidi % 12;
    // scalePcs is already absolute pitch classes, don't add rootPc again!
    const scaleAbs = scalePcs;
    const targetOctaveBase = Math.floor(targetMidi / 12) * 12;

    const candidates = [];
    for (let octave = -1; octave <= 1; octave++) {
      for (const pc of scaleAbs) {
        const midi = targetOctaveBase + octave * 12 + pc;
        if (midi > targetMidi && midi < targetMidi + 12) {
          candidates.push(midi);
        }
      }
    }

    candidates.sort((a, b) => a - b);
    return candidates[0] || targetMidi + 1;
  }

  function adjustToProximity(currentMidi, targetMidi, scalePcsOrAbs, currentOctave) {
    // Adjust current note to be within 2 semitones of target
    const distance = Math.abs(currentMidi - targetMidi);
    if (distance <= 2) return currentMidi;

    // Find closest note within 2 semitones
    const candidates = [];
    for (let offset = -2; offset <= 2; offset++) {
      const midi = targetMidi + offset;
      if (midi >= 55 && midi <= 81) {
        candidates.push(midi);
      }
    }

    candidates.sort((a, b) => Math.abs(a - currentMidi) - Math.abs(b - currentMidi));
    return candidates[0] || currentMidi;
  }

  function generateScaleApproach(startMidi, targetMidi, scalePcs, rootPc, noteCount) {
    // Generate scale steps that approach target
    // scalePcs is already absolute pitch classes, don't add rootPc again!
    const scaleAbs = scalePcs;
    const direction = targetMidi > startMidi ? 1 : -1;
    const notes = [];

    let currentMidi = startMidi;
    for (let i = 0; i < noteCount; i++) {
      const prevMidi = currentMidi;
      currentMidi = avoidConsecutiveDuplicate(
        currentMidi,
        () => {
          let attempts = 0;
          let midi;
          do {
            midi = nextScaleNote(prevMidi, rootPc, scalePcs, direction);

            // Don't go past or reach the target
            if ((direction > 0 && midi >= targetMidi) || (direction < 0 && midi <= targetMidi)) {
              midi = targetMidi + (direction * -1 * (i + 1)); // Step back
            }

            attempts++;
          } while (midi === targetMidi && attempts < 3); // Extra check: don't match target

          return midi;
        }
      );

      notes.push(currentMidi);
    }

    return notes;
  }

  return {
    generateMeasure,
    selectDevice,
  };
})();
