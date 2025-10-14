// Target-first device system with multi-device measures
// Devices can be combined within a measure by filling remaining slots recursively

window.DevicesNew = (function () {

  // ========== DEVICE GENERATORS ==========
  // Each device returns: { notes: [...], slotsUsed: N }

  /**
   * Arpeggio Device
   * Generates 3-4 chord tone patterns
   * Uses variable number of slots (3-7)
   */
  function generateArpeggioSlots(context, startSlot, maxSlots) {
    const { chord, rootPc, quality, scale, targetNote, nextTarget, isLastMeasure } = context;
    const measureStart = targetNote.startBeat;
    const notes = [];

    // Decide pattern length (3-7 notes depending on available slots)
    const patternLength = Math.min(Math.floor(Math.random() * 5) + 3, maxSlots);

    // Get chord tones
    const chordPcs = getChordPitchClasses(rootPc, quality);
    const chordAbs = chordPcs.map(pc => (rootPc + pc) % 12);

    // Start from current position if startSlot > 0
    let currentMidi = startSlot === 0 ? targetNote.midi : notes[notes.length - 1]?.midi || targetNote.midi;
    if (startSlot > 0) {
      // Get the last note generated in this measure
      currentMidi = context.lastMidi || targetNote.midi;
    }

    // Generate arpeggio
    const direction = Math.random() < 0.5 ? 1 : -1;
    let chordIndex = chordAbs.findIndex(pc => (currentMidi % 12) === pc);
    if (chordIndex === -1) chordIndex = 0;

    for (let i = 0; i < patternLength; i++) {
      chordIndex = (chordIndex + direction + chordAbs.length) % chordAbs.length;
      const pc = chordAbs[chordIndex];
      let midi = Math.floor(currentMidi / 12) * 12 + pc;

      // Adjust octave if needed
      if (direction > 0 && midi <= currentMidi) midi += 12;
      if (direction < 0 && midi >= currentMidi) midi -= 12;

      // Clamp to range
      while (midi < 55) midi += 12;
      while (midi > 81) midi -= 12;

      notes.push({
        startBeat: measureStart + (startSlot + i) * 0.5,
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
    }

    return { notes, slotsUsed: patternLength };
  }

  /**
   * Scale Run Device
   * Generates stepwise scale motion
   * Uses variable number of slots (3-6)
   */
  function generateScaleRunSlots(context, startSlot, maxSlots) {
    const { chord, rootPc, quality, scale, targetNote } = context;
    const measureStart = targetNote.startBeat;

    if (!window.Scales) return generateArpeggioSlots(context, startSlot, maxSlots);

    const scalePcs = window.Scales.getScalePitchClasses(rootPc, scale);
    const notes = [];

    // Decide run length
    const runLength = Math.min(Math.floor(Math.random() * 4) + 3, maxSlots);
    const direction = Math.random() < 0.5 ? 1 : -1;

    let currentMidi = startSlot === 0 ? targetNote.midi : (context.lastMidi || targetNote.midi);

    for (let i = 0; i < runLength; i++) {
      currentMidi = nextScaleNote(currentMidi, rootPc, scalePcs, direction);

      notes.push({
        startBeat: measureStart + (startSlot + i) * 0.5,
        durationBeats: 0.5,
        midi: currentMidi,
        velocity: 0.9,
        device: 'scale-run',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
        ruleId: 'scale-step',
        harmonicFunction: 'scale-step',
      });
    }

    return { notes, slotsUsed: runLength };
  }

  /**
   * Melodic Cell Device
   * Uses 4-note patterns from scale degrees
   * Always uses 4 slots
   */
  function generateMelodicCellSlots(context, startSlot, maxSlots) {
    const { chord, rootPc, quality, scale, targetNote } = context;
    const measureStart = targetNote.startBeat;

    if (!window.MelodicCells || !window.Scales || maxSlots < 4) {
      return generateArpeggioSlots(context, startSlot, maxSlots);
    }

    const scalePcs = window.Scales.getScalePitchClasses(rootPc, scale);
    const notes = [];

    // Get random cell
    const cell = window.MelodicCells.getRandomCell();
    let currentMidi = startSlot === 0 ? targetNote.midi : (context.lastMidi || targetNote.midi);

    // Generate 4-note cell pattern
    for (let i = 0; i < 4; i++) {
      const degree = cell.degrees[i];
      const midi = window.MelodicCells.degreeToMidi(degree, rootPc, scalePcs, currentMidi);

      notes.push({
        startBeat: measureStart + (startSlot + i) * 0.5,
        durationBeats: 0.5,
        midi,
        velocity: 0.9,
        device: 'melodic-cell',
        cellName: cell.name,
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
        ruleId: 'melodic-cell',
        harmonicFunction: 'scale-step',
      });

      currentMidi = midi;
    }

    return { notes, slotsUsed: 4 };
  }

  /**
   * Neighbor/Enclosure Device
   * Uses 3 slots: current note, neighbor, return to current
   * Or 2 slots for enclosure approaching next target
   */
  function generateNeighborSlots(context, startSlot, maxSlots) {
    const { chord, rootPc, quality, scale, targetNote, nextTarget, isLastMeasure } = context;
    const measureStart = targetNote.startBeat;

    if (!window.Scales || maxSlots < 2) {
      return generateArpeggioSlots(context, startSlot, maxSlots);
    }

    const scalePcs = window.Scales.getScalePitchClasses(rootPc, scale);
    const notes = [];
    let currentMidi = startSlot === 0 ? targetNote.midi : (context.lastMidi || targetNote.midi);

    // Check if we're at the end of measure and can do enclosure to next target
    const canDoEnclosure = !isLastMeasure && nextTarget && (startSlot >= 6) && maxSlots >= 2;

    if (canDoEnclosure) {
      // Enclosure approaching next target (uses 2 slots)
      const targetMidi = nextTarget.midi;
      const nextScalePcs = window.Scales.getScalePitchClasses(nextTarget.rootPc || rootPc, scale);

      const lowerNeighbor = targetMidi - 1;
      const upperNeighbor = getUpperNeighbor(targetMidi, nextTarget.rootPc || rootPc, nextScalePcs);
      const enclosureType = Math.random() < 0.5 ? 'upper-lower' : 'lower-upper';

      notes.push({
        startBeat: measureStart + startSlot * 0.5,
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
        harmonicFunction: enclosureType === 'upper-lower' ? 'scale-step' : 'chromatic',
      });

      notes.push({
        startBeat: measureStart + (startSlot + 1) * 0.5,
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
        harmonicFunction: enclosureType === 'upper-lower' ? 'chromatic' : 'scale-step',
      });

      return { notes, slotsUsed: 2 };
    } else {
      // Simple neighbor tone (uses 3 slots if available, otherwise 2)
      const useThreeNotes = maxSlots >= 3;
      const lowerNeighbor = currentMidi - 1;
      const upperNeighbor = getUpperNeighbor(currentMidi, rootPc, scalePcs);
      const neighbor = Math.random() < 0.5 ? lowerNeighbor : upperNeighbor;

      notes.push({
        startBeat: measureStart + startSlot * 0.5,
        durationBeats: 0.5,
        midi: neighbor,
        velocity: 0.9,
        device: 'neighbor',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
        ruleId: 'neighbor',
        harmonicFunction: neighbor === lowerNeighbor ? 'chromatic' : 'scale-step',
      });

      if (useThreeNotes) {
        notes.push({
          startBeat: measureStart + (startSlot + 1) * 0.5,
          durationBeats: 0.5,
          midi: currentMidi,
          velocity: 0.9,
          device: 'neighbor',
          chordSymbol: chord.symbol,
          rootPc,
          quality,
          scaleName: scale,
          ruleId: 'scale-step',
          harmonicFunction: 'scale-step',
        });
      }

      return { notes, slotsUsed: useThreeNotes ? 2 : 1 };
    }
  }

  // ========== MULTI-DEVICE MEASURE GENERATION ==========

  /**
   * Generate enclosure approaching next target (always uses 2 slots)
   */
  function generateEnclosureToTarget(context, startSlot) {
    const { chord, rootPc, quality, scale, targetNote, nextTarget } = context;
    const measureStart = targetNote.startBeat;
    const notes = [];

    if (!window.Scales || !nextTarget) {
      return { notes, slotsUsed: 0 };
    }

    const targetMidi = nextTarget.midi;
    const nextScalePcs = window.Scales.getScalePitchClasses(nextTarget.rootPc || rootPc, scale);

    const lowerNeighbor = targetMidi - 1; // chromatic (half-step below)
    const upperNeighbor = getUpperNeighbor(targetMidi, nextTarget.rootPc || rootPc, nextScalePcs); // diatonic (scale step above)
    const enclosureType = Math.random() < 0.5 ? 'upper-lower' : 'lower-upper';

    notes.push({
      startBeat: measureStart + startSlot * 0.5,
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
      harmonicFunction: enclosureType === 'upper-lower' ? 'scale-step' : 'chromatic',
    });

    notes.push({
      startBeat: measureStart + (startSlot + 1) * 0.5,
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
      harmonicFunction: enclosureType === 'upper-lower' ? 'chromatic' : 'scale-step',
    });

    return { notes, slotsUsed: 2 };
  }

  /**
   * Fill a measure with multiple devices recursively
   */
  function fillMeasureWithDevices(context, strategy = 'varied') {
    const allNotes = [];
    const { targetNote, isLastMeasure, nextTarget } = context;

    // Slot 0 is always the target chord tone
    allNotes.push({
      ...targetNote,
      device: 'target',
      chordSymbol: context.chord.symbol,
      rootPc: context.rootPc,
      quality: context.quality,
      scaleName: context.scale,
    });

    // Determine if we should reserve last 2 slots for enclosure
    const useEnclosure = !isLastMeasure && nextTarget && Math.random() < 0.3; // 30% chance
    const maxSlots = isLastMeasure ? 6 : 8; // Last measure can end early
    const fillUntilSlot = useEnclosure ? 6 : maxSlots; // Reserve slots 6-7 for enclosure if selected

    // Fill slots 1 through 5 (or 1 through 7) with random devices
    let currentSlot = 1;

    while (currentSlot < fillUntilSlot) {
      const remainingSlots = fillUntilSlot - currentSlot;

      // Update context with current position
      const updatedContext = {
        ...context,
        lastMidi: allNotes[allNotes.length - 1].midi,
      };

      // Select and generate device
      const deviceType = selectDevice(updatedContext, strategy);
      const result = generateDeviceSlots(deviceType, updatedContext, currentSlot, remainingSlots);

      // Add generated notes
      for (const note of result.notes) {
        allNotes.push(note);
      }

      currentSlot += result.slotsUsed;
    }

    // Add enclosure at end if selected
    if (useEnclosure) {
      const updatedContext = {
        ...context,
        lastMidi: allNotes[allNotes.length - 1].midi,
      };
      const result = generateEnclosureToTarget(updatedContext, 6);
      for (const note of result.notes) {
        allNotes.push(note);
      }
    }

    return allNotes;
  }

  /**
   * Select device based on strategy
   */
  function selectDevice(context, strategy = 'varied') {
    switch (strategy) {
      case 'arpeggio-focused':
        return 'arpeggio';

      case 'scale-focused':
        return 'scale-run';

      case 'cell-focused':
        return 'melodic-cell';

      case 'neighbor-enclosure':
        return 'neighbor';

      case 'varied':
      default:
        const rand = Math.random();
        if (rand < 0.25) return 'arpeggio';
        if (rand < 0.50) return 'scale-run';
        if (rand < 0.75) return 'melodic-cell';
        return 'neighbor';
    }
  }

  /**
   * Generate device notes for given slot range
   */
  function generateDeviceSlots(deviceType, context, startSlot, maxSlots) {
    switch (deviceType) {
      case 'arpeggio':
        return generateArpeggioSlots(context, startSlot, maxSlots);
      case 'scale-run':
        return generateScaleRunSlots(context, startSlot, maxSlots);
      case 'melodic-cell':
        return generateMelodicCellSlots(context, startSlot, maxSlots);
      case 'neighbor':
        return generateNeighborSlots(context, startSlot, maxSlots);
      default:
        return generateArpeggioSlots(context, startSlot, maxSlots);
    }
  }

  /**
   * Main entry point for measure generation
   */
  function generateMeasure(context, strategy = 'varied') {
    return fillMeasureWithDevices(context, strategy);
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
    const scaleAbs = scalePcs.map(p => (rootPc + p) % 12);

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
    const scaleAbs = scalePcs.map(pc => (rootPc + pc) % 12);

    const candidates = [];
    for (let octave = -1; octave <= 1; octave++) {
      for (const pc of scaleAbs) {
        const midi = targetMidi + octave * 12 + ((pc - targetPc + 12) % 12);
        if (midi > targetMidi && midi < targetMidi + 12) {
          candidates.push(midi);
        }
      }
    }

    candidates.sort((a, b) => a - b);
    return candidates[0] || targetMidi + 1;
  }

  return {
    generateMeasure,
    selectDevice,
  };
})();
