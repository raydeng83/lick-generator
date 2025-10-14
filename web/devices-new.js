// Target-first device system
// All devices work backwards from pre-filled target notes
// Targets are already defined in Phase 1 before device generation

window.DevicesNew = (function () {

  // ========== DEVICE GENERATORS ==========

  /**
   * Arpeggio Device
   * Generates 3-4 note arpeggio patterns (straight up/down or pivot)
   * Last note must be within 2 semitones of next target
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

    // Get chord tones
    const chordPcs = getChordPitchClasses(rootPc, quality);
    const chordAbs = chordPcs.map(pc => (rootPc + pc) % 12);

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
        harmonicFunction: 'chord-tone',
      });

      currentMidi = midi;
      currentOctave = Math.floor(midi / 12);
    }

    // Last note for last measure (can be shorter)
    if (!isLastMeasure) {
      notes.push({
        startBeat: measureStart + 3.5,
        durationBeats: 0.5,
        midi: currentMidi,
        velocity: 0.9,
        device: 'arpeggio',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
        ruleId: 'arpeggio',
        harmonicFunction: 'chord-tone',
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
        currentMidi = nextScaleNote(currentMidi, rootPc, scalePcs, direction);
        const isChordToneNote = isChordTone(currentMidi, rootPc, chordPcs);
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
          harmonicFunction: isChordToneNote ? 'chord-tone' : 'scale-step',
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
      currentMidi = nextScaleNote(currentMidi, rootPc, scalePcs, startDirection);
      const isChordToneNote = isChordTone(currentMidi, rootPc, chordPcs);
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
        harmonicFunction: isChordToneNote ? 'chord-tone' : 'scale-step',
      });
    }

    // Second half: run toward target (last 4 notes approach target)
    // Use next chord's scale for approach
    const nextScale = window.Scales.getScalePitchClasses(nextTarget.rootPc || rootPc, context.nextScale || scale);

    const approachNotes = generateScaleApproach(currentMidi, targetMidi, nextScale, nextTarget.rootPc || rootPc, 4);
    for (let i = 0; i < approachNotes.length; i++) {
      const isChordToneNote = isChordTone(approachNotes[i], rootPc, chordPcs);
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
        harmonicFunction: isChordToneNote ? 'chord-tone' : 'scale-step',
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
        harmonicFunction: isChordToneNote ? 'chord-tone' : 'scale-step',
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
          harmonicFunction: isChordToneNote ? 'chord-tone' : 'scale-step',
        });
      }

      // Last 2 notes: enclosure
      const targetMidi = nextTarget.midi;
      const nextScalePcs = window.Scales.getScalePitchClasses(nextTarget.rootPc || rootPc, context.nextScale || scale);
      const lowerNeighbor = targetMidi - 1;
      const upperNeighbor = getUpperNeighbor(targetMidi, nextTarget.rootPc || rootPc, nextScalePcs);
      const enclosureType = Math.random() < 0.5 ? 'upper-lower' : 'lower-upper';

      // Check if neighbors are chord tones
      const upperIsChordTone = isChordTone(upperNeighbor, rootPc, chordPcs);
      const lowerIsChordTone = isChordTone(lowerNeighbor, rootPc, chordPcs);

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
          ? (upperIsChordTone ? 'chord-tone' : 'scale-step')
          : (lowerIsChordTone ? 'chord-tone' : 'chromatic'),
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
          ? (lowerIsChordTone ? 'chord-tone' : 'chromatic')
          : (upperIsChordTone ? 'chord-tone' : 'scale-step'),
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
          harmonicFunction: isChordToneNote ? 'chord-tone' : 'scale-step',
        });
      }
    }

    return notes;
  }

  /**
   * Neighbor/Enclosure Device
   * Creates two enclosure patterns per measure
   * Structure: Target → Fill(1) → Enclosure(2) → Target → Fill(1) → Enclosure(2)
   * Enclosure uses both lower (chromatic) and upper (diatonic) neighbors
   */
  function generateNeighborEnclosure(context) {
    const { chord, rootPc, quality, scale, targetNote, nextTarget, isLastMeasure } = context;
    const measureStart = targetNote.startBeat;

    if (!window.Scales || !nextTarget || isLastMeasure) {
      return generateArpeggio(context);
    }

    const scalePcs = window.Scales.getScalePitchClasses(rootPc, scale);
    const chordPcs = getChordPitchClasses(rootPc, quality);
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

    // Slot 1: Fill note (1 note with scale step)
    let currentMidi = targetNote.midi;
    currentMidi = avoidConsecutiveDuplicate(
      targetNote.midi,
      () => nextScaleNote(targetNote.midi, rootPc, scalePcs, Math.random() < 0.5 ? 1 : -1)
    );

    // Check if this scale-step note accidentally lands on a chord tone
    const isChordToneNote1 = isChordTone(currentMidi, rootPc, chordPcs);

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
      harmonicFunction: isChordToneNote1 ? 'chord-tone' : 'scale-step',
    });

    // Slot 4: Middle target note (chord tone) - the 5th note of the measure
    // Select a chord tone for the middle target
    const chordAbs = chordPcs.map(pc => (rootPc + pc) % 12);
    const middleTargetMidi = selectChordTone(currentMidi, chordAbs);

    // Slots 2-3: First enclosure approaching middle target (slot 4)
    const lowerNeighbor1 = middleTargetMidi - 1;
    const upperNeighbor1 = getUpperNeighbor(middleTargetMidi, rootPc, scalePcs);

    // Choose enclosure type, but swap if first note would be duplicate
    let enclosureType1 = Math.random() < 0.5 ? 'upper-lower' : 'lower-upper';
    const firstEnclosureMidi = enclosureType1 === 'upper-lower' ? upperNeighbor1 : lowerNeighbor1;

    // If first enclosure note duplicates the fill note, swap enclosure order
    if (firstEnclosureMidi === currentMidi) {
      enclosureType1 = enclosureType1 === 'upper-lower' ? 'lower-upper' : 'upper-lower';
    }

    // Check if neighbors are chord tones
    const upperIsChordTone1 = isChordTone(upperNeighbor1, rootPc, chordPcs);
    const lowerIsChordTone1 = isChordTone(lowerNeighbor1, rootPc, chordPcs);

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
        ? (upperIsChordTone1 ? 'chord-tone' : 'scale-step')
        : (lowerIsChordTone1 ? 'chord-tone' : 'chromatic'),
    });

    notes.push({
      startBeat: measureStart + 1.5,
      durationBeats: 0.5,
      midi: enclosureType1 === 'upper-lower' ? lowerNeighbor1 : upperNeighbor1,
      velocity: 0.9,
      device: 'enclosure',
      enclosureType: enclosureType1 === 'upper-lower' ? 'lower' : 'upper',
      chordSymbol: chord.symbol,
      rootPc,
      quality,
      scaleName: scale,
      ruleId: 'enclosure',
      harmonicFunction: enclosureType1 === 'upper-lower'
        ? (lowerIsChordTone1 ? 'chord-tone' : 'chromatic')
        : (upperIsChordTone1 ? 'chord-tone' : 'scale-step'),
    });

    // Slot 4: Middle target
    // Check if middle target duplicates slot 3 (last enclosure note)
    const slot3Midi = enclosureType1 === 'upper-lower' ? lowerNeighbor1 : upperNeighbor1;
    let finalMiddleTargetMidi = middleTargetMidi;

    if (finalMiddleTargetMidi === slot3Midi) {
      // Try to find a different chord tone
      finalMiddleTargetMidi = avoidConsecutiveDuplicate(
        slot3Midi,
        () => selectChordTone(currentMidi, chordAbs)
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

    // Slot 5: Fill note (1 note with scale step)
    currentMidi = avoidConsecutiveDuplicate(
      finalMiddleTargetMidi,
      () => nextScaleNote(finalMiddleTargetMidi, rootPc, scalePcs, Math.random() < 0.5 ? 1 : -1)
    );

    // Check if this scale-step note accidentally lands on a chord tone
    const isChordToneNote2 = isChordTone(currentMidi, rootPc, chordPcs);

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
      harmonicFunction: isChordToneNote2 ? 'chord-tone' : 'scale-step',
    });

    // Slots 6-7: Second enclosure approaching next measure's target
    const nextTargetMidi = nextTarget.midi;
    const nextScalePcs = window.Scales.getScalePitchClasses(nextTarget.rootPc || rootPc, context.nextScale || scale);

    const lowerNeighbor2 = nextTargetMidi - 1;
    const upperNeighbor2 = getUpperNeighbor(nextTargetMidi, nextTarget.rootPc || rootPc, nextScalePcs);

    // Choose enclosure type, but swap if first note would be duplicate
    let enclosureType2 = Math.random() < 0.5 ? 'upper-lower' : 'lower-upper';
    const firstEnclosureMidi2 = enclosureType2 === 'upper-lower' ? upperNeighbor2 : lowerNeighbor2;

    // If first enclosure note duplicates the fill note, swap enclosure order
    if (firstEnclosureMidi2 === currentMidi) {
      enclosureType2 = enclosureType2 === 'upper-lower' ? 'lower-upper' : 'upper-lower';
    }

    // Check if neighbors are chord tones
    const upperIsChordTone2 = isChordTone(upperNeighbor2, rootPc, chordPcs);
    const lowerIsChordTone2 = isChordTone(lowerNeighbor2, rootPc, chordPcs);

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
        ? (upperIsChordTone2 ? 'chord-tone' : 'scale-step')
        : (lowerIsChordTone2 ? 'chord-tone' : 'chromatic'),
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
        ? (lowerIsChordTone2 ? 'chord-tone' : 'chromatic')
        : (upperIsChordTone2 ? 'chord-tone' : 'scale-step'),
    });

    return notes;
  }

  /**
   * Select a chord tone near the current pitch
   */
  function selectChordTone(currentMidi, chordAbs) {
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

    // Return a nearby chord tone (prefer not the exact same note)
    for (const midi of candidates) {
      if (midi !== currentMidi) {
        return midi;
      }
    }

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

  function generateMeasure(context, strategy = 'varied') {
    const deviceType = selectDevice(context, strategy);

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
      currentMidi = nextScaleNote(currentMidi, rootPc, scalePcs, direction);

      // Don't go past or reach the target
      if ((direction > 0 && currentMidi >= targetMidi) || (direction < 0 && currentMidi <= targetMidi)) {
        currentMidi = targetMidi + (direction * -1 * (i + 1)); // Step back
      }

      notes.push(currentMidi);
    }

    return notes;
  }

  return {
    generateMeasure,
    selectDevice,
  };
})();
