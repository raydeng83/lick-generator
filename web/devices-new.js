// Redesigned device system - devices generate complete measure sequences
// Each device is self-contained and determines its own rhythm and pitches

window.DevicesNew = (function () {

  // ========== DEVICE GENERATORS ==========

  /**
   * Arpeggio Device
   * Generates notes cycling through chord tones
   * Self-determines rhythm and note count
   */
  function generateArpeggio(context) {
    const { chord, rootPc, quality, scale, lastMidi, measureStart } = context;

    // Get chord tones
    const chordPcs = getChordPitchClasses(rootPc, quality);
    const chordAbs = chordPcs.map(pc => (rootPc + pc) % 12);

    // Decide direction
    const direction = Math.random() < 0.5 ? 1 : -1; // 1=ascending, -1=descending

    // Generate 6-8 notes in the measure
    const noteCount = 6 + Math.floor(Math.random() * 3);
    const notes = [];

    let currentOctave = Math.floor(lastMidi / 12);
    let chordIndex = 0;

    for (let i = 0; i < noteCount; i++) {
      const pc = chordAbs[chordIndex % chordAbs.length];
      let midi = currentOctave * 12 + pc;

      // Clamp to range
      while (midi < 55) midi += 12;
      while (midi > 81) midi -= 12;

      notes.push({
        startBeat: measureStart + i * (4 / noteCount),
        durationBeats: 4 / noteCount,
        midi,
        velocity: 0.9,
        device: 'arpeggio',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
      });

      // Move to next chord tone
      chordIndex += direction;
      if (chordIndex < 0) chordIndex = chordAbs.length - 1;

      // Sometimes jump octave
      if (Math.random() < 0.2) {
        currentOctave += direction;
      }
    }

    return notes;
  }

  /**
   * Scale Run Device
   * Generates stepwise scale motion
   */
  function generateScaleRun(context) {
    const { chord, rootPc, quality, scale, lastMidi, measureStart } = context;

    if (!window.Scales) return generateArpeggio(context);

    const scalePcs = window.Scales.getScalePitchClasses(rootPc, scale);
    const scaleAbs = scalePcs.map(pc => (rootPc + pc) % 12);

    // Direction: up or down
    const direction = Math.random() < 0.5 ? 1 : -1;

    // Start from nearest scale note to lastMidi
    let currentMidi = findNearestScaleNote(lastMidi, rootPc, scalePcs);

    // Generate 7-8 eighth notes
    const noteCount = 7 + Math.floor(Math.random() * 2);
    const notes = [];

    for (let i = 0; i < noteCount; i++) {
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
      });

      // Move to next scale note
      currentMidi = nextScaleNote(currentMidi, rootPc, scalePcs, direction);

      // Clamp to range
      while (currentMidi < 55) currentMidi += 12;
      while (currentMidi > 81) currentMidi -= 12;
    }

    return notes;
  }

  /**
   * Melodic Cell Device
   * Uses 4-note patterns from the scale
   */
  function generateMelodicCell(context) {
    const { chord, rootPc, quality, scale, lastMidi, measureStart } = context;

    if (!window.MelodicCells || !window.Scales) {
      return generateArpeggio(context);
    }

    // Get random cell
    const cell = window.MelodicCells.getRandomCell();
    const scalePcs = window.Scales.getScalePitchClasses(rootPc, scale);

    // Generate cell pattern (4 notes)
    const notes = [];
    let currentMidi = lastMidi;

    for (let i = 0; i < cell.degrees.length; i++) {
      const degree = cell.degrees[i];
      const midi = window.MelodicCells.degreeToMidi(degree, rootPc, scalePcs, currentMidi);

      notes.push({
        startBeat: measureStart + i * 0.5,
        durationBeats: 0.5,
        midi,
        velocity: 0.9,
        device: 'melodic-cell',
        cellName: cell.name,
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
      });

      currentMidi = midi;
    }

    // Fill remaining measure with scale steps
    let beatPosition = cell.degrees.length * 0.5;
    while (beatPosition < 4) {
      currentMidi = nextScaleNote(currentMidi, rootPc, scalePcs, Math.random() < 0.5 ? 1 : -1);

      notes.push({
        startBeat: measureStart + beatPosition,
        durationBeats: 0.5,
        midi: currentMidi,
        velocity: 0.9,
        device: 'melodic-cell-fill',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
      });

      beatPosition += 0.5;
    }

    return notes;
  }

  /**
   * Neighbor/Enclosure Device
   * Focuses on approach to target note (first beat of next measure)
   */
  function generateNeighborEnclosure(context) {
    const { chord, rootPc, quality, scale, lastMidi, measureStart, nextChord } = context;

    if (!window.Scales || !nextChord) {
      return generateArpeggio(context);
    }

    const scalePcs = window.Scales.getScalePitchClasses(rootPc, scale);
    const notes = [];

    // Generate first part of measure (beats 1-2.5) with normal notes
    let currentMidi = lastMidi;
    for (let i = 0; i < 5; i++) {
      currentMidi = nextScaleNote(currentMidi, rootPc, scalePcs, Math.random() < 0.5 ? 1 : -1);

      notes.push({
        startBeat: measureStart + i * 0.5,
        durationBeats: 0.5,
        midi: currentMidi,
        velocity: 0.9,
        device: 'neighbor-approach',
        chordSymbol: chord.symbol,
        rootPc,
        quality,
        scaleName: scale,
      });
    }

    // Last 3 notes: enclosure approaching next measure
    // Resolve target note from next chord
    const nextRootPc = nextChord.rootPc;
    const nextQuality = nextChord.quality;
    const nextScale = nextChord.scale;
    const nextScalePcs = window.Scales.getScalePitchClasses(nextRootPc, nextScale);

    // Target: chord tone from next measure
    const targetMidi = getRandomChordTone(currentMidi, nextRootPc, nextQuality);

    // Calculate neighbors
    const lowerNeighbor = targetMidi - 1; // half-step below
    const upperNeighbor = getUpperNeighbor(targetMidi, nextRootPc, nextScalePcs);

    // Decide enclosure type
    const enclosureType = Math.random() < 0.5 ? 'upper-lower' : 'lower-upper';

    // Slot 6: first approach
    const slot6Midi = enclosureType === 'upper-lower' ? upperNeighbor : lowerNeighbor;
    notes.push({
      startBeat: measureStart + 3,
      durationBeats: 0.5,
      midi: slot6Midi,
      velocity: 0.9,
      device: 'enclosure',
      enclosureType: enclosureType === 'upper-lower' ? 'upper' : 'lower',
      chordSymbol: chord.symbol,
      rootPc,
      quality,
      scaleName: scale,
    });

    // Slot 7: second approach
    const slot7Midi = enclosureType === 'upper-lower' ? lowerNeighbor : upperNeighbor;
    notes.push({
      startBeat: measureStart + 3.5,
      durationBeats: 0.5,
      midi: slot7Midi,
      velocity: 0.9,
      device: 'enclosure',
      enclosureType: enclosureType === 'upper-lower' ? 'lower' : 'upper',
      chordSymbol: chord.symbol,
      rootPc,
      quality,
      scaleName: scale,
    });

    return notes;
  }

  // ========== DEVICE SELECTION ==========

  /**
   * Select appropriate device for measure
   */
  function selectDevice(context, strategy = 'varied') {
    const { chord, quality } = context;

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
        // Random weighted selection
        const rand = Math.random();
        if (rand < 0.25) return 'arpeggio';
        if (rand < 0.50) return 'scale-run';
        if (rand < 0.75) return 'melodic-cell';
        return 'neighbor-enclosure';
    }
  }

  /**
   * Generate notes for measure using selected device
   */
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
    // Use LickGen if available
    if (window.LickGen) {
      return window.LickGen.chordPitchClasses(rootPc, quality);
    }

    // Fallback
    return [0, 4, 7, 11];
  }

  function findNearestScaleNote(midi, rootPc, scalePcs) {
    const scaleAbs = scalePcs.map(pc => (rootPc + pc) % 12);
    const candidates = [];

    for (let octave = -1; octave <= 2; octave++) {
      for (const pc of scaleAbs) {
        const note = 60 + octave * 12 + pc;
        if (note >= 55 && note <= 81) {
          candidates.push(note);
        }
      }
    }

    candidates.sort((a, b) => Math.abs(a - midi) - Math.abs(b - midi));
    return candidates[0] || midi;
  }

  function nextScaleNote(midi, rootPc, scalePcs, direction = 1) {
    const pc = midi % 12;
    const scaleAbs = scalePcs.map(p => (rootPc + p) % 12);

    // Find current position in scale
    let idx = scaleAbs.findIndex(p => p === pc);
    if (idx === -1) {
      // Not on scale, find nearest
      return findNearestScaleNote(midi, rootPc, scalePcs);
    }

    // Move to next/prev scale note
    idx = (idx + direction + scaleAbs.length) % scaleAbs.length;
    const nextPc = scaleAbs[idx];

    // Adjust octave if needed
    let nextMidi = Math.floor(midi / 12) * 12 + nextPc;

    if (direction > 0 && nextMidi <= midi) {
      nextMidi += 12;
    } else if (direction < 0 && nextMidi >= midi) {
      nextMidi -= 12;
    }

    return nextMidi;
  }

  function getRandomChordTone(nearMidi, rootPc, quality) {
    const chordPcs = getChordPitchClasses(rootPc, quality);
    const chordAbs = chordPcs.map(pc => (rootPc + pc) % 12);

    const candidates = [];
    for (let octave = -1; octave <= 2; octave++) {
      for (const pc of chordAbs) {
        const midi = 60 + octave * 12 + pc;
        if (midi >= 55 && midi <= 81) {
          candidates.push(midi);
        }
      }
    }

    candidates.sort((a, b) => Math.abs(a - nearMidi) - Math.abs(b - nearMidi));
    return candidates[0] || nearMidi;
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
