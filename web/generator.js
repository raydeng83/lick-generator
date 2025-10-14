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

    // Parse with extensions for scale selection
    // Check specific extended chords first (most specific to least specific)
    if (/(maj7|Δ|M7).*#11/.test(rest)) return "maj7#11";
    if (/(maj7|Δ|M7).*#5/.test(rest)) return "maj7#5";
    if (/maj7|Δ|M7/i.test(rest)) return "maj7";

    if (/(7).*alt/i.test(rest)) return "7alt";
    if (/(7).*#9.*b13/.test(rest)) return "7#9b13";
    if (/(7).*#11/.test(rest)) return "7#11";
    if (/(7).*b13/.test(rest)) return "7b13";
    if (/(7).*#5/.test(rest)) return "7#5";
    if (/(7).*b9/.test(rest)) return "7b9";
    if (/(7).*#9/.test(rest)) return "7#9";
    if (/(7sus4).*b9/.test(rest)) return "7sus4b9";
    if (/(7)/.test(rest)) return "7";

    if (/(m7b5|ø)/i.test(rest)) return "m7b5";
    if (/(dim|o7)/i.test(rest)) return "dim7";
    if (/(mMaj7|m\(maj7\)|mM7)/i.test(rest)) return "mMaj7";
    if (/(m7).*b6/.test(rest)) return "m7b6";
    if (/(m7|min7|−7|mi7|m)/i.test(rest)) return "m7";

    if (/sus4.*b9/.test(rest)) return "sus4b9";

    return "maj7";
  }

  function chordPitchClasses(rootPc, quality) {
    // Base chord tones (root, 3rd, 5th, 7th) for each quality
    // Extensions are handled by scale selection, not chord tones
    switch (quality) {
      // Major 7th family
      case "maj7":
      case "maj7#11":
        return [0, 4, 7, 11];
      case "maj7#5":
        return [0, 4, 8, 11]; // #5 instead of 5

      // Dominant 7th family
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
        return [0, 4, 8, 10]; // #5 instead of 5

      // Minor 7th family
      case "m7":
      case "m7b6":
        return [0, 3, 7, 10];
      case "mMaj7":
        return [0, 3, 7, 11]; // major 7th

      // Half-diminished
      case "m7b5":
        return [0, 3, 6, 10];

      // Diminished
      case "dim7":
        return [0, 3, 6, 9];

      // Sus chords
      case "sus4b9":
        return [0, 5, 7, 10]; // no 3rd, has 4th

      default:
        return [0, 4, 7, 11];
    }
  }

  function scalePitchClasses(rootPc, quality, scaleName = null) {
    // If specific scale provided, use it
    if (scaleName) {
      return Scales.getScalePitchClasses(rootPc, scaleName);
    }

    // Otherwise, select scale based on chord quality (Rule 2 & 3)
    const selectedScale = Scales.selectScale(quality, 'default');
    return Scales.getScalePitchClasses(rootPc, selectedScale);
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

  // ========== PIPELINE STAGE 1.5: DEVICE SELECTION ==========

  function selectDevices(skeleton, progression, options = {}) {
    const { deviceStrategy = 'varied', useDevices = false } = options;

    // If devices disabled or not loaded, return skeleton unchanged
    if (!useDevices || !window.Devices) {
      return skeleton;
    }

    try {
      // Select device per measure
      const result = [...skeleton];
      const measuresProcessed = new Set();

      for (let i = 0; i < result.length; i += 8) { // Process 8 slots (1 measure) at a time
        const measureStart = i;
        const measureEnd = Math.min(i + 8, result.length);

        if (!result[measureStart]) continue;

        const bar = result[measureStart].bar;

        if (measuresProcessed.has(bar)) continue;
        measuresProcessed.add(bar);

        // Get chord for this measure
        const seg = progression.find(s =>
          result[measureStart].startBeat >= s.startBeat &&
          result[measureStart].startBeat < s.startBeat + s.durationBeats
        ) || progression[0];

        const slotsAvailable = measureEnd - measureStart;

        // Select device
        const device = window.Devices.selectDevice({
          chord: seg,
          slotsAvailable,
        }, { deviceStrategy });

        // Tag slots with device info
        for (let j = measureStart; j < measureEnd; j++) {
          if (result[j]) {
            result[j].device = device;
          }
        }
      }

      return result;
    } catch (error) {
      console.error('[Generator] Error in selectDevices:', error);
      // Return skeleton unchanged if error occurs
      return skeleton;
    }
  }

  // ========== PIPELINE STAGE 2: HARMONIC FUNCTION ASSIGNMENT ==========

  function assignHarmonicFunctions(skeleton, progression, options = {}) {
    const {
      scaleStrategy = 'default'
    } = options;

    const functionalPhrase = skeleton.map((slot, idx) => {
      const seg = findChordAtBeat(progression, slot.startBeat);
      const rootPc = parseRoot(seg.symbol) ?? 0;
      const quality = parseQuality(seg.symbol);

      // Select scale for this chord (Rule 2 & 3)
      const scaleName = Scales.selectScale(quality, scaleStrategy);

      const isStrongBeat = (slot.slot % 4 === 0); // beats 1, 3

      let harmonicFunc = {
        chordSymbol: seg.symbol,
        rootPc,
        quality,
        scaleName, // Store selected scale
      };

      // RULE 1: Always put chord tones on strong beats
      if (isStrongBeat) {
        harmonicFunc.function = 'chord-tone';
        // Don't choose degree here - let Stage 3 pick randomly for variety
      } else {
        // Weak beats: scale steps (removed chromatic approach)
        harmonicFunc.function = 'scale-step';
        harmonicFunc.direction = null;
      }

      return { ...slot, ...harmonicFunc };
    });

    // RULE 4: Mark next target chord tone for scale navigation
    for (let i = 0; i < functionalPhrase.length; i++) {
      if (functionalPhrase[i].function !== 'chord-tone') {
        // Find next chord tone
        const nextChordToneIdx = findNextChordTone(functionalPhrase, i);
        if (nextChordToneIdx !== -1) {
          functionalPhrase[i].nextChordToneIndex = nextChordToneIdx;
        }
      }
    }

    return functionalPhrase;
  }

  function findNextChordTone(phrase, fromIndex) {
    for (let i = fromIndex + 1; i < phrase.length; i++) {
      if (phrase[i].function === 'chord-tone') {
        return i;
      }
    }
    return -1;
  }

  // ========== PIPELINE STAGE 3: PITCH REALIZATION ==========

  function realizePitches(functionalPhrase, options = {}) {
    const { startPitch = 64, range = [55, 81], useDevices = false } = options;
    let lastMidi = startPitch;

    // If devices are enabled and present, use device-based realization
    if (useDevices && functionalPhrase.length > 0 && functionalPhrase[0].device) {
      return realizeWithDevices(functionalPhrase, startPitch, range);
    }

    // Otherwise, use original Rules 1-4 realization
    return realizeWithRules(functionalPhrase, startPitch, range);
  }

  // ========== DEVICE-BASED REALIZATION ==========

  function realizeWithDevices(functionalPhrase, startPitch, range) {
    const result = [];
    let lastMidi = startPitch;

    // Process each measure with its device
    for (let measureStart = 0; measureStart < functionalPhrase.length; measureStart += 8) {
      const measureEnd = Math.min(measureStart + 8, functionalPhrase.length);
      const measureSlots = functionalPhrase.slice(measureStart, measureEnd);

      if (measureSlots.length === 0) continue;

      const device = measureSlots[0].device;

      // Realize this measure using the device as a guide
      const measureNotes = realizeMeasureWithDevice(measureSlots, device, lastMidi, range);

      for (const note of measureNotes) {
        result.push(note);
        lastMidi = note.midi;
      }
    }

    return result;
  }

  function realizeMeasureWithDevice(slots, device, startMidi, range) {
    if (!device || device.type === 'chord-tones') {
      // No device - use Rules 1-4 for each slot
      let lastMidi = startMidi;
      return slots.map((slot, idx) => {
        const note = realizeSingleNote(slot, lastMidi, slots, idx, range);
        lastMidi = note.midi;
        return note;
      });
    }

    // Device influences melodic direction/pattern but keeps all slots
    let lastMidi = startMidi;
    const result = [];

    switch (device.type) {
      case 'arpeggio':
        // Arpeggio: cycle through chord tones on strong beats, fill weak beats with passing tones
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i];
          const isStrongBeat = (slot.slot % 4 === 0); // beats 1, 3

          if (isStrongBeat && device.pattern) {
            // Use arpeggio pattern for strong beats
            const patternIdx = Math.floor(i / 2) % device.pattern.length;
            const degree = device.pattern[patternIdx];
            const chordToneNote = { ...slot, targetDegree: degree };
            const result_ct = resolveChordTone(chordToneNote, lastMidi);

            result.push({
              ...slot,
              midi: result_ct.midi,
              velocity: 0.9,
              ruleId: 'arpeggio-chord-tone',
              harmonicFunction: 'chord-tone',
              degree: result_ct.degree,
            });
            lastMidi = result_ct.midi;
          } else {
            // Weak beats: scale steps connecting arpeggio tones
            const realized = realizeSingleNote(slot, lastMidi, slots, i, range);
            result.push(realized);
            lastMidi = realized.midi;
          }
        }
        break;

      case 'scale-run':
        // Scale run: continuous stepwise motion in one direction
        const direction = device.direction === 'up' ? 1 : -1;
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i];
          const isStrongBeat = (slot.slot % 4 === 0);

          if (isStrongBeat) {
            // Strong beat: chord tone (Rule 1)
            const result_ct = resolveChordTone(slot, lastMidi);
            result.push({
              ...slot,
              midi: result_ct.midi,
              velocity: 0.9,
              ruleId: 'scale-run-chord-tone',
              harmonicFunction: 'chord-tone',
              degree: result_ct.degree,
            });
            lastMidi = result_ct.midi;
          } else {
            // Weak beat: scale step in device direction
            const scalePcs = scalePitchClasses(slot.rootPc, slot.quality, slot.scaleName);
            const midi = scaleStep(lastMidi, slot.rootPc, scalePcs, direction);
            result.push({
              ...slot,
              midi,
              velocity: 0.9,
              ruleId: 'scale-run',
              harmonicFunction: 'scale-step',
              degree: null,
            });
            lastMidi = midi;
          }
        }
        break;

      case 'melodic-cell':
        // Melodic cell: use cell pattern for first 4 notes, then fill remaining
        const cellDegrees = device.cellDegrees || [1, 2, 3, 5];
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i];
          const isStrongBeat = (slot.slot % 4 === 0);

          if (i < cellDegrees.length) {
            // Use cell pattern for first N notes
            const degree = cellDegrees[i];
            const scalePcs = scalePitchClasses(slot.rootPc, slot.quality, slot.scaleName);
            const midi = window.MelodicCells
              ? window.MelodicCells.degreeToMidi(degree, slot.rootPc, scalePcs, lastMidi)
              : lastMidi;

            result.push({
              ...slot,
              midi,
              velocity: 0.9,
              ruleId: 'melodic-cell',
              harmonicFunction: isStrongBeat ? 'chord-tone' : 'scale-step',
              degree: String(degree),
            });
            lastMidi = midi;
          } else {
            // Fill remaining slots with Rules 1-4
            const realized = realizeSingleNote(slot, lastMidi, slots, i, range);
            result.push(realized);
            lastMidi = realized.midi;
          }
        }
        break;

      case 'neighbor':
        // Neighbor tone: target → neighbor → target pattern (Rule 8)
        // Lower neighbor: half-step down (chromatic)
        // Upper neighbor: next scale note from above (diatonic)
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i];
          const isStrongBeat = (slot.slot % 4 === 0);

          // Check if we can fit a neighbor pattern (need 3 consecutive slots)
          if (i + 2 < slots.length && isStrongBeat) {
            // Target (chord tone)
            const target = resolveChordTone(slot, lastMidi);
            result.push({
              ...slot,
              midi: target.midi,
              velocity: 0.9,
              ruleId: 'neighbor-target',
              harmonicFunction: 'chord-tone',
              degree: target.degree,
            });
            lastMidi = target.midi;
            i++;

            // Neighbor (Rule 8: half-step down OR scale note from above)
            const neighborType = device.neighborType || 'upper';
            const scalePcs = scalePitchClasses(slots[i].rootPc, slots[i].quality, slots[i].scaleName);
            const neighborMidi = neighborType === 'upper'
              ? getUpperNeighbor(target.midi, slots[i].rootPc, scalePcs)  // Scale note from above
              : getLowerNeighbor(target.midi);                             // Half-step down

            result.push({
              ...slots[i],
              midi: neighborMidi,
              velocity: 0.9,
              ruleId: 'neighbor',
              harmonicFunction: 'scale-step',
              degree: null,
            });
            lastMidi = neighborMidi;
            i++;

            // Return to target
            result.push({
              ...slots[i],
              midi: target.midi,
              velocity: 0.9,
              ruleId: 'neighbor-return',
              harmonicFunction: 'chord-tone',
              degree: target.degree,
            });
            lastMidi = target.midi;
          } else {
            // No room for pattern - use standard realization
            const realized = realizeSingleNote(slot, lastMidi, slots, i, range);
            result.push(realized);
            lastMidi = realized.midi;
          }
        }
        break;

      case 'enclosure':
        // Enclosure: use both neighbor tones to approach target (Rule 8)
        // Upper neighbor: next scale note from above (diatonic)
        // Lower neighbor: half-step down (chromatic)
        // Pattern: upper → lower → target OR lower → upper → target
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i];
          const isStrongBeat = (slot.slot % 4 === 0);

          // Check if we can fit enclosure pattern (need 3 consecutive slots)
          if (i + 2 < slots.length && isStrongBeat) {
            // Determine target (next strong beat chord tone)
            const targetSlot = slots[i + 2] < slots.length ? slots[i + 2] : slot;
            const target = resolveChordTone(targetSlot, lastMidi);

            // Calculate both neighbor tones per Rule 8
            const scalePcs = scalePitchClasses(slot.rootPc, slot.quality, slot.scaleName);
            const upperNeighbor = getUpperNeighbor(target.midi, slot.rootPc, scalePcs);  // Scale note from above
            const lowerNeighbor = getLowerNeighbor(target.midi);                          // Half-step down

            // Apply enclosure pattern
            const enclosureType = device.enclosureType || 'upper-lower';
            if (enclosureType === 'upper-lower') {
              // Upper approach (diatonic scale note from above)
              result.push({
                ...slot,
                midi: upperNeighbor,
                velocity: 0.9,
                ruleId: 'enclosure-upper',
                harmonicFunction: 'scale-step',
                degree: null,
              });
              lastMidi = upperNeighbor;
              i++;

              // Lower approach (chromatic half-step down)
              result.push({
                ...slots[i],
                midi: lowerNeighbor,
                velocity: 0.9,
                ruleId: 'enclosure-lower',
                harmonicFunction: 'scale-step',
                degree: null,
              });
              lastMidi = lowerNeighbor;
              i++;
            } else {
              // Lower-upper
              // Lower approach (chromatic half-step down)
              result.push({
                ...slot,
                midi: lowerNeighbor,
                velocity: 0.9,
                ruleId: 'enclosure-lower',
                harmonicFunction: 'scale-step',
                degree: null,
              });
              lastMidi = lowerNeighbor;
              i++;

              // Upper approach (diatonic scale note from above)
              result.push({
                ...slots[i],
                midi: upperNeighbor,
                velocity: 0.9,
                ruleId: 'enclosure-upper',
                harmonicFunction: 'scale-step',
                degree: null,
              });
              lastMidi = upperNeighbor;
              i++;
            }

            // Target
            result.push({
              ...slots[i],
              midi: target.midi,
              velocity: 0.9,
              ruleId: 'enclosure-target',
              harmonicFunction: 'chord-tone',
              degree: target.degree,
            });
            lastMidi = target.midi;
          } else {
            // No room for pattern - use standard realization
            const realized = realizeSingleNote(slot, lastMidi, slots, i, range);
            result.push(realized);
            lastMidi = realized.midi;
          }
        }
        break;

      default:
        // Unknown device - fall back to Rules 1-4
        for (let i = 0; i < slots.length; i++) {
          const realized = realizeSingleNote(slots[i], lastMidi, slots, i, range);
          result.push(realized);
          lastMidi = realized.midi;
        }
    }

    return result;
  }


  // ========== RULES 1-4 REALIZATION ==========

  function realizeWithRules(functionalPhrase, startPitch, range) {
    let lastMidi = startPitch;

    // First pass: resolve all chord tones
    const pitches = functionalPhrase.map((note, idx) => {
      if (note.function === 'chord-tone') {
        const result = resolveChordTone(note, lastMidi);
        lastMidi = result.midi;
        return { ...note, midi: result.midi, degree: result.degree };
      }
      return { ...note, midi: null, degree: null };
    });

    // Second pass: resolve weak beats with Rule 4 navigation
    lastMidi = startPitch;
    return pitches.map((note, idx) => {
      let midi = note.midi;
      let degree = note.degree;
      const nextNote = functionalPhrase[idx + 1];

      if (midi === null) {
        // Not a chord tone - use scale steps
        // RULE 4: Navigate toward next chord tone using scale
        if (note.nextChordToneIndex !== undefined && note.nextChordToneIndex !== -1) {
          const targetChordTone = pitches[note.nextChordToneIndex];
          const stepsToTarget = note.nextChordToneIndex - idx;
          midi = navigateTowardTarget(lastMidi, targetChordTone.midi, note, stepsToTarget);
        } else {
          // No target - random scale step
          midi = resolveScaleStep(note, lastMidi);
        }
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
        degree,
        scaleName: note.scaleName, // Pass scale name for display
        chordSymbol: note.chordSymbol, // Pass chord symbol
      };
    });
  }

  function realizeSingleNote(note, lastMidi, phrase, idx, range) {
    // Realize a single note using Rules 1-4
    // If lastMidi is null, use the default
    const refMidi = lastMidi !== null && lastMidi !== undefined ? lastMidi : 64;
    let midi;
    let degree = null;
    const nextNote = phrase[idx + 1];

    if (note.function === 'chord-tone') {
      const result = resolveChordTone(note, refMidi);
      midi = result.midi;
      degree = result.degree;
    } else {
      // Use scale steps for all weak beats
      const nextChordToneIdx = findNextChordTone(phrase, idx);
      if (nextChordToneIdx !== -1) {
        const targetChordTone = phrase[nextChordToneIdx];
        const targetResult = resolveChordTone(targetChordTone, refMidi);
        const stepsToTarget = nextChordToneIdx - idx;
        midi = navigateTowardTarget(refMidi, targetResult.midi, note, stepsToTarget);
      } else {
        midi = resolveScaleStep(note, refMidi);
      }
    }

    midi = constrainToRange(midi, refMidi, range);

    return {
      startBeat: note.startBeat,
      durationBeats: note.durationBeats,
      midi,
      velocity: 0.9,
      ruleId: note.function,
      harmonicFunction: note.function,
      degree,
      scaleName: note.scaleName,
      chordSymbol: note.chordSymbol,
    };
  }

  // ========== STRATEGY SELECTION ==========

  function selectGenerationStrategy(progression, metadata) {
    // All weak beats use scale steps (chromatic approach removed)
    return {
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
    console.log('[Generator] Starting generation with options:', options);

    // Stage 1: Generate rhythmic skeleton
    const skeleton = generateRhythmicSkeleton(progression, metadata, options);
    console.log('[Generator] Stage 1 complete: skeleton has', skeleton.length, 'slots');

    // Stage 1.5: Select devices (NEW - Step 2 from Generation-Steps)
    const devicePlanned = selectDevices(skeleton, progression, options);
    console.log('[Generator] Stage 1.5 complete: devices selected');

    // Stage 2: Assign harmonic functions (device-aware)
    const strategy = selectGenerationStrategy(progression, metadata);
    // Merge user options with strategy
    const mergedOptions = { ...strategy, ...options };
    const functionalPhrase = assignHarmonicFunctions(devicePlanned, progression, mergedOptions);
    console.log('[Generator] Stage 2 complete: harmonic functions assigned');

    // Stage 3: Realize pitches
    const phrase = realizePitches(functionalPhrase, options);
    console.log('[Generator] Stage 3 complete: pitches realized');
    console.log('[Generator] Generated', phrase.length, 'notes');

    // Validate output
    const invalidNotes = phrase.filter(n => !n || typeof n.midi !== 'number');
    if (invalidNotes.length > 0) {
      console.error('[Generator] Found', invalidNotes.length, 'invalid notes:', invalidNotes);
    }

    // Stage 4: Post-process
    const final = postProcess(phrase, options);
    console.log('[Generator] Stage 4 complete: post-processing done');

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

    // If a specific target degree was requested, use it
    if (note.targetDegree) {
      const midi = resolveSpecificDegree(note.targetDegree, nearMidi, note.rootPc, chordPcs);
      const degree = getChordDegree(midi, note.rootPc, chordPcs);
      return { midi, degree };
    }

    // Otherwise choose randomly from available chord tones
    const midi = randomChordTone(nearMidi, note.rootPc, chordPcs);
    const degree = getChordDegree(midi, note.rootPc, chordPcs);
    return { midi, degree };
  }

  function resolveSpecificDegree(targetDegree, nearMidi, rootPc, chordPcs) {
    // Map degree (1, 3, 5, 7) to interval
    const degreeToInterval = { 1: 0, 3: chordPcs[1], 5: chordPcs[2], 7: chordPcs[3] };
    const interval = degreeToInterval[targetDegree] ?? 0;
    const targetPc = (rootPc + interval) % 12;
    return clampRange(pcToMidiNear(targetPc, nearMidi ?? 64));
  }

  function randomChordTone(nearMidi, rootPc, chordPcs) {
    // Build all possible chord tone candidates in range
    const pcs = chordPcs.map(pc => (rootPc + pc) % 12);
    const allCandidates = [];

    for (const pc of pcs) {
      allCandidates.push(clampRange(pcToMidiNear(pc, nearMidi ?? 64)));
      allCandidates.push(clampRange(pcToMidiNear(pc, (nearMidi ?? 64) + 12)));
      allCandidates.push(clampRange(pcToMidiNear(pc, (nearMidi ?? 64) - 12)));
    }

    // Remove duplicates and sort by distance
    const uniqueCandidates = [...new Set(allCandidates)];
    uniqueCandidates.sort((a, b) => Math.abs(a - (nearMidi ?? 64)) - Math.abs(b - (nearMidi ?? 64)));

    // Weighted random selection favoring closer notes but allowing variety
    // 50% chance: pick from closest 2 candidates
    // 30% chance: pick from next 2 candidates
    // 20% chance: pick from remaining candidates
    const rand = Math.random();
    if (rand < 0.5 && uniqueCandidates.length >= 2) {
      // Closest 2
      return uniqueCandidates[Math.floor(Math.random() * Math.min(2, uniqueCandidates.length))];
    } else if (rand < 0.8 && uniqueCandidates.length >= 4) {
      // Next 2
      return uniqueCandidates[2 + Math.floor(Math.random() * Math.min(2, uniqueCandidates.length - 2))];
    } else {
      // Any remaining
      return uniqueCandidates[Math.floor(Math.random() * uniqueCandidates.length)];
    }
  }

  function nearestChordTone(midiPrev, rootPc, chordPcs) {
    const pcs = chordPcs.map(pc => (rootPc + pc) % 12);
    const candidates = pcs.map(pc => clampRange(pcToMidiNear(pc, midiPrev ?? 64)));
    candidates.sort((a, b) => Math.abs(a - (midiPrev ?? 64)) - Math.abs(b - (midiPrev ?? 64)));
    return candidates[0];
  }

  function getChordDegree(midi, rootPc, chordPcs) {
    // Map pitch class to chord degree (1, 3, 5, 7, 9, 11, 13)
    const pc = (midi % 12 + 12) % 12;
    const relPc = (pc - rootPc + 12) % 12;

    // Map relative pitch class to degree
    const degreeMap = {
      0: '1',   // root
      2: '9',   // 9th
      3: 'b3',  // minor 3rd
      4: '3',   // major 3rd
      5: '11',  // 11th
      6: 'b5',  // flat 5
      7: '5',   // 5th
      9: '13',  // 13th
      10: 'b7', // minor 7th
      11: '7'   // major 7th
    };

    return degreeMap[relPc] || '?';
  }

  function resolveScaleStep(note, lastMidi) {
    const scalePcs = scalePitchClasses(note.rootPc, note.quality, note.scaleName);
    return scaleStep(lastMidi, note.rootPc, scalePcs);
  }

  /**
   * RULE 4: Navigate toward target chord tone using scale
   * Handles special cases:
   * - Same note: move up/down scale then return
   * - Adjacent (1-2 semitones): chromatic or scalar approach
   * - Far distance: stepwise motion toward target
   */
  function navigateTowardTarget(currentMidi, targetMidi, note, stepsAvailable) {
    const scalePcs = scalePitchClasses(note.rootPc, note.quality, note.scaleName);
    const distance = Math.abs(targetMidi - currentMidi);

    // Case 1: Same note or very close (same pitch class)
    if (distance === 0 || (currentMidi % 12) === (targetMidi % 12)) {
      // Move away and come back: use scale decoration
      const direction = Math.random() < 0.5 ? 1 : -1;
      return scaleStep(currentMidi, note.rootPc, scalePcs, direction);
    }

    // Case 2: Very close (1-3 semitones) - could use chromatic or scale
    if (distance <= 3 && stepsAvailable <= 2) {
      // Close enough - just use scale step toward target
      const direction = targetMidi > currentMidi ? 1 : -1;
      return scaleStep(currentMidi, note.rootPc, scalePcs, direction);
    }

    // Case 3: Far distance - stepwise scale motion toward target
    if (distance > 3) {
      // Move stepwise using scale toward target
      const direction = targetMidi > currentMidi ? 1 : -1;
      return scaleStep(currentMidi, note.rootPc, scalePcs, direction);
    }

    // Default: scale step toward target
    const direction = targetMidi > currentMidi ? 1 : -1;
    return scaleStep(currentMidi, note.rootPc, scalePcs, direction);
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

  /**
   * RULE 8: Get lower neighbor tone
   * Lower neighbor is always a half-step down (chromatic)
   */
  function getLowerNeighbor(targetMidi) {
    return targetMidi - 1;
  }

  /**
   * RULE 8: Get upper neighbor tone
   * Upper neighbor is the next scale note from above (diatonic)
   */
  function getUpperNeighbor(targetMidi, rootPc, scalePcs) {
    // Find next scale note above target
    return scaleStep(targetMidi, rootPc, scalePcs, 1);
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

