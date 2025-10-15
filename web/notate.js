// VexFlow rendering of the lick and chord symbols

window.Notate = (function () {
  const VF = Vex.Flow;

  /**
   * Convert MIDI to VexFlow key format, using noteName if available
   * @param {number} midi - MIDI note number
   * @param {string} noteName - Optional note name with octave (e.g., "Bb4", "F#5")
   * @returns {string} VexFlow key format (e.g., "bb/4", "f#/5")
   */
  function midiToKey(midi, noteName = null) {
    if (noteName) {
      // Parse noteName (e.g., "Bb4", "F#5", "C4") into VexFlow format
      // noteName format: [A-G][b|#]?[0-9]
      const match = noteName.match(/^([A-G])([b#]?)(\d+)$/);
      if (match) {
        const note = match[1].toLowerCase();
        const accidental = match[2]; // 'b', '#', or ''
        const octave = match[3];
        return `${note}${accidental}/${octave}`;
      }
    }

    // Fallback: use sharps if noteName not available
    const N = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
    const n = N[(midi % 12 + 12) % 12];
    const o = Math.floor(midi / 12) - 1;
    return `${n}/${o}`;
  }

  function durationFromBeats(beats) {
    if (Math.abs(beats - 0.5) < 1e-6) return "8"; // eighth
    if (Math.abs(beats - 1) < 1e-6) return "q"; // quarter
    if (Math.abs(beats - 1.5) < 1e-6) return "qd"; // dotted quarter (3 eighths)
    if (Math.abs(beats - 2) < 1e-6) return "h"; // half
    if (Math.abs(beats - 2.5) < 1e-6) return "hd"; // dotted half (5 eighths)
    if (Math.abs(beats - 3) < 1e-6) return "hd"; // dotted half (6 eighths)
    if (Math.abs(beats - 3.5) < 1e-6) return "hdd"; // double-dotted half (7 eighths)
    if (Math.abs(beats - 4) < 1e-6) return "w"; // whole
    // default - fallback to eighth note
    console.warn(`[Notate] Unsupported duration: ${beats} beats, defaulting to eighth note`);
    return "8";
  }

  function render({ container, progression, lick, metadata, useColors = true }) {
    const el = typeof container === "string" ? document.querySelector(container) : container;
    if (!el) return;
    el.innerHTML = "";

    // One measure per chord segment
    const measures = [...progression].sort((a, b) => a.startBeat - b.startBeat);
    const measureCount = measures.length;

    // Layout: wrap measures onto multiple lines based on container width
    const renderer = new VF.Renderer(el, VF.Renderer.Backends.SVG);
    const widthPerMeasure = 320; // base width - increased for better spacing
    const extraFirstMeasure = 70; // extra room for clef/time per system
    const staveHeight = 120;
    const systemGap = 24; // vertical gap between systems
    const leftMargin = 10;
    const rightMargin = 10;
    const topMargin = 35; // increased to prevent chord symbol truncation
    const bottomMargin = 80; // increased to accommodate enclosure labels below staff
    const containerWidth = Math.max(320, el.clientWidth || (el.parentElement && el.parentElement.clientWidth) || 1200);

    // First pass: compute measure positions and number of systems
    const layout = [];
    let lineIndex = 0;
    let x = leftMargin;
    let y = topMargin;
    let isStartOfSystem = true;
    for (let i = 0; i < measureCount; i++) {
      let mWidth = widthPerMeasure + (isStartOfSystem ? extraFirstMeasure : 0);
      const maxWidth = Math.max(80, containerWidth - leftMargin - rightMargin);
      if (!isStartOfSystem && x + mWidth + rightMargin > containerWidth) {
        // wrap to next system
        lineIndex += 1;
        x = leftMargin;
        y = topMargin + lineIndex * (staveHeight + systemGap);
        isStartOfSystem = true;
        mWidth = widthPerMeasure + extraFirstMeasure;
      }
      if (mWidth > maxWidth) mWidth = maxWidth; // clamp if very narrow viewport
      layout.push({ x, y, width: mWidth, isSystemStart: isStartOfSystem });
      x += mWidth; // next measure in system
      isStartOfSystem = false;
    }

    const totalHeight = (lineIndex + 1) * (staveHeight + systemGap) - systemGap + topMargin + bottomMargin;
    renderer.resize(containerWidth, totalHeight);
    const ctx = renderer.getContext();


    for (let i = 0; i < measureCount; i++) {
      const seg = measures[i];
      const { x, y, width: mWidth, isSystemStart } = layout[i];
      const stave = new VF.Stave(x, y, mWidth);
      if (isSystemStart) {
        stave.addClef("treble").addTimeSignature(metadata.timeSig || "4/4");
      }
      stave.setContext(ctx).draw();

      // Collect lick notes inside this chord segment
      const start = seg.startBeat;
      const end = seg.startBeat + seg.durationBeats;
      const segNotes = lick
        .filter(n => n.startBeat >= start && n.startBeat < end)
        .sort((a, b) => a.startBeat - b.startBeat)
        .map(n => {
          // Clip notes that extend beyond measure boundary
          const noteEnd = n.startBeat + n.durationBeats;
          if (noteEnd > end) {
            const clippedDuration = end - n.startBeat;
            console.warn(`[Notate] Clipping note that extends beyond measure: ${n.startBeat} + ${n.durationBeats} -> ${n.startBeat} + ${clippedDuration}`);
            return { ...n, durationBeats: clippedDuration };
          }
          return n;
        });

      // Safety check: if no notes in this measure, fill with rests
      if (segNotes.length === 0) {
        console.warn('[Notate] No notes in measure:', seg.symbol, 'filling with rests');
        // Create a full measure of rests
        const wholeRest = new VF.StaveNote({ keys: ["b/4"], duration: "wr", auto_stem: true });
        const voice = new VF.Voice({ num_beats: 4, beat_value: 4 }).setStrict(false);
        voice.addTickables([wholeRest]);
        const formatter = new VF.Formatter().joinVoices([voice]);
        const noteArea = Math.max(10, (stave.getNoteEndX() - stave.getNoteStartX()) - 8);
        formatter.format([voice], noteArea);
        voice.draw(ctx, stave);
        continue;
      }

      // Debug: log segNotes to see if rests are present
      console.log(`[Notate DEBUG] ${seg.symbol} - segNotes from lick data (${segNotes.length} total):`,
        segNotes.map((n, i) => ({
          index: i,
          startBeat: n.startBeat,
          durationBeats: n.durationBeats,
          isRest: n.isRest,
          midi: n.midi,
          device: n.device
        }))
      );

      // Build exactly 8 eighth-note slots (4/4) using integer eighths to avoid float drift
      const notes = [];
      let cursorE8 = 0; // 0..8

      // Track accidental state for each pitch letter+octave in this measure
      // Key: "c4", "d5", etc (pitch letter + octave)
      // Value: 'sharp', 'flat', 'natural', or null (not seen yet)
      const accidentalState = new Map();

      // Detect enclosure patterns for labeling (only on non-rest notes)
      // Map: note index -> enclosure type ('2-note' or '3-note')
      // Pattern structure:
      // - 2-note enclosure: target → fill → enclosure → enclosure → next target
      // - 3-note enclosure: target → enclosure → enclosure → enclosure → next target
      const enclosureLabels = new Map();
      let skipUntilIdx = -1; // Track which notes are already part of a labeled enclosure

      // Filter out rest notes for enclosure detection
      const nonRestNotes = segNotes.filter(n => !n.isRest);

      for (let idx = 0; idx < nonRestNotes.length; idx++) {
        // Skip if this note is already part of a previous enclosure
        if (idx <= skipUntilIdx) continue;

        const note = nonRestNotes[idx];

        // Look for enclosure-target as the start of a pattern
        if (note.device === 'enclosure-target') {
          // Check what follows the target
          if (idx + 1 < nonRestNotes.length) {
            const nextNote = nonRestNotes[idx + 1];

            if (nextNote.device === 'enclosure-fill') {
              // 2-note enclosure: target → fill → 2 enclosure notes → (target or ending)
              // Count the enclosure notes after the fill
              let enclosureCount = 0;
              for (let j = idx + 2; j < nonRestNotes.length && nonRestNotes[j].device === 'enclosure'; j++) {
                enclosureCount++;
              }

              if (enclosureCount === 2) {
                // Check if followed by ending note (Scenario B variant where beat 10 IS ending)
                // or by another target (regular scenario)
                const targetOrEnding = idx + 4 < nonRestNotes.length ?
                  (nonRestNotes[idx + 4].device === 'enclosure-target' || nonRestNotes[idx + 4].device === 'ending') : false;

                if (targetOrEnding || idx + 4 >= nonRestNotes.length) {
                  // Label at the fill note (first note of the visual pattern)
                  enclosureLabels.set(idx + 1, '2-note');
                  skipUntilIdx = idx + 3; // Skip fill + 2 enclosure notes
                }
              }
            } else if (nextNote.device === 'enclosure') {
              // 3-note enclosure: target → 3 enclosure notes (no fill)
              let enclosureCount = 1; // Already found first enclosure
              for (let j = idx + 2; j < nonRestNotes.length && nonRestNotes[j].device === 'enclosure'; j++) {
                enclosureCount++;
              }

              if (enclosureCount === 3) {
                // Label at the first enclosure note
                enclosureLabels.set(idx + 1, '3-note');
                skipUntilIdx = idx + 3; // Skip 3 enclosure notes
              }
            }
          }
        }
      }

      /**
       * Helper to add rests that respect measure midpoint
       * @param {number} gapStartBeat - Start beat of the gap (absolute)
       * @param {number} gapDurationBeats - Duration of the gap in beats
       */
      function addRestsForGap(gapStartBeat, gapDurationBeats) {
        // Calculate measure midpoint
        const measureStart = Math.floor(gapStartBeat / 4) * 4;
        const midpoint = measureStart + 2;
        const gapEndBeat = gapStartBeat + gapDurationBeats;

        // Check if gap crosses midpoint
        if (gapStartBeat < midpoint && gapEndBeat > midpoint) {
          // Split at midpoint
          const beforeMidpoint = midpoint - gapStartBeat;
          const afterMidpoint = gapEndBeat - midpoint;

          // Add rests before midpoint
          addRestsSingleHalf(gapStartBeat, beforeMidpoint);
          // Add rests after midpoint
          addRestsSingleHalf(midpoint, afterMidpoint);
        } else {
          // Doesn't cross midpoint - use normal greedy algorithm
          addRestsSingleHalf(gapStartBeat, gapDurationBeats);
        }
      }

      /**
       * Helper to add rests within a single half of a measure (greedy algorithm)
       * @param {number} startBeat - Start beat (absolute)
       * @param {number} durationBeats - Duration in beats
       */
      function addRestsSingleHalf(startBeat, durationBeats) {
        let remaining = durationBeats;
        let currentBeat = startBeat;

        while (remaining > 0) {
          let restDuration;
          if (remaining >= 2) {
            restDuration = 2;
          } else if (remaining >= 1) {
            restDuration = 1;
          } else {
            restDuration = 0.5;
          }

          const dur = durationFromBeats(restDuration);
          const restNote = new VF.StaveNote({ keys: ["b/4"], duration: dur + "r", auto_stem: true });
          restNote.startBeat = currentBeat;
          restNote.durationBeats = restDuration;
          restNote._isRestNote = true; // EXPLICIT FLAG: Mark this as a rest for beaming logic
          console.log(`[Notate DEBUG]     Created rest: duration="${dur}r", startBeat=${currentBeat}, notes.length before push=${notes.length}`);
          notes.push(restNote);
          console.log(`[Notate DEBUG]     Pushed rest, notes.length after push=${notes.length}, notes array:`,
            notes.map((n, i) => `[${i}] ${n.duration}@${n.startBeat}${n._isRestNote ? 'r' : ''}`).join(', '));

          const durE8 = Math.round(restDuration * 2);
          cursorE8 += durE8;
          remaining -= restDuration;
          currentBeat += restDuration;
        }
      }

      let noteIndex = 0; // Track index in segNotes for enclosure labeling
      for (const n of segNotes) {
        // Handle rest notes
        if (n.isRest) {
          console.log(`[Notate DEBUG] Processing REST at beat ${n.startBeat}, duration ${n.durationBeats}, cursorE8 BEFORE = ${cursorE8}`);
          const relStartE8 = Math.round((n.startBeat - start) * 2);

          // Fill gaps before this rest using midpoint-aware logic
          if (cursorE8 < relStartE8) {
            console.log(`[Notate DEBUG]   Filling gap from cursorE8=${cursorE8} to relStartE8=${relStartE8}`);
            const gapStartBeat = start + (cursorE8 / 2);
            const gapDurationBeats = (relStartE8 - cursorE8) / 2;
            addRestsForGap(gapStartBeat, gapDurationBeats);
            console.log(`[Notate DEBUG]   After gap fill, cursorE8 = ${cursorE8}`);
          }

          // Add the explicit rest note using midpoint-aware logic
          console.log(`[Notate DEBUG]   Adding explicit rest, cursorE8 BEFORE = ${cursorE8}`);
          addRestsForGap(n.startBeat, n.durationBeats);
          console.log(`[Notate DEBUG]   After rest add, cursorE8 = ${cursorE8}`);
          // Note: cursorE8 is automatically updated inside addRestsSingleHalf

          continue;
        }

        // Safety check: ensure note has required properties
        if (!n || typeof n.midi !== 'number' || typeof n.durationBeats !== 'number') {
          console.error('[Notate] Invalid note:', n);
          continue;
        }

        console.log(`[Notate DEBUG] Processing NOTE at beat ${n.startBeat}, duration ${n.durationBeats}, cursorE8 BEFORE = ${cursorE8}`);
        const relStartE8 = Math.round((n.startBeat - start) * 2);
        const durE8 = Math.round(n.durationBeats * 2);

        // Fill gaps before this note using midpoint-aware logic
        if (cursorE8 < relStartE8) {
          console.log(`[Notate DEBUG]   Filling gap before note from cursorE8=${cursorE8} to relStartE8=${relStartE8}`);
          const gapStartBeat = start + (cursorE8 / 2);
          const gapDurationBeats = (relStartE8 - cursorE8) / 2;
          addRestsForGap(gapStartBeat, gapDurationBeats);
          console.log(`[Notate DEBUG]   After gap fill, cursorE8 = ${cursorE8}`);
        }

        const dur = durationFromBeats(n.durationBeats);
        const key = midiToKey(n.midi, n.noteName);

        // Validate key format before creating note
        if (!key || !key.includes('/')) {
          console.error('[Notate] Invalid MIDI key:', key, 'from MIDI:', n.midi);
          continue;
        }

        const sn = new VF.StaveNote({ keys: [key], duration: dur, auto_stem: true });

        // Preserve startBeat for manual beaming
        sn.startBeat = n.startBeat;
        sn.durationBeats = n.durationBeats;

        // Add accidentals following standard notation rules:
        // - Show accidental on first occurrence in measure
        // - Show natural sign if previous note had sharp/flat on same pitch letter
        // - Accidentals carry through the measure for the same pitch+octave

        // Parse the key to extract pitch letter and accidental
        const keyParts = key.split('/'); // e.g., ["db", "4"] or ["c#", "4"] or ["d", "4"]
        const noteName = keyParts[0]; // e.g., "db", "c#", "d"
        const octave = keyParts[1];

        // Extract pitch letter (first character)
        const pitchLetter = noteName[0]; // e.g., "d", "c"
        const pitchKey = pitchLetter + octave; // e.g., "d4", "c4"

        // Determine current accidental type
        const hasSharp = noteName.includes('#');
        const hasFlat = noteName.includes('b') && noteName.length > 1; // "bb" or "db", but not "b" (B natural)
        let currentAccidental = 'natural';
        if (hasSharp) currentAccidental = 'sharp';
        if (hasFlat) currentAccidental = 'flat';

        // Check if we need to show an accidental
        const previousAccidental = accidentalState.get(pitchKey);

        if (previousAccidental === undefined) {
          // First occurrence of this pitch in the measure
          if (currentAccidental === 'sharp') {
            sn.addAccidental(0, new VF.Accidental('#'));
          } else if (currentAccidental === 'flat') {
            sn.addAccidental(0, new VF.Accidental('b'));
          }
          // Natural notes don't need accidental on first occurrence
        } else if (previousAccidental !== currentAccidental) {
          // Accidental state changed - show the new accidental
          if (currentAccidental === 'natural') {
            sn.addAccidental(0, new VF.Accidental('n')); // Natural sign
          } else if (currentAccidental === 'sharp') {
            sn.addAccidental(0, new VF.Accidental('#'));
          } else if (currentAccidental === 'flat') {
            sn.addAccidental(0, new VF.Accidental('b'));
          }
        }
        // else: same accidental as before, no need to show it again

        // Update state
        accidentalState.set(pitchKey, currentAccidental);

        // Get scale degree for display (for scale tones)
        // Use degree from JSON if available (for scale-step notes), otherwise calculate it
        let scaleDegree = null;
        if (n.harmonicFunction === 'scale-step' || n.ruleId === 'scale-step' ||
            n.ruleId === 'scale-run' || n.ruleId === 'melodic-cell' ||
            n.ruleId === 'neighbor' || n.ruleId === 'enclosure' ||
            n.ruleId === 'enclosure-upper' || n.ruleId === 'enclosure-lower') {
          // For neighbor and enclosure notes, check if they're actually scale tones (not chromatic)
          if (n.harmonicFunction === 'chromatic') {
            // Chromatic notes (lower neighbor) don't get scale degree
            scaleDegree = null;
          } else if (n.degree && n.harmonicFunction === 'scale-step') {
            // Use pre-calculated degree from JSON (for scale-step notes)
            scaleDegree = n.degree;
          } else if (n.midi !== undefined && n.rootPc !== undefined && n.scaleName && window.Scales) {
            // Calculate scale degree for notes that don't have it in JSON
            const pc = (n.midi % 12 + 12) % 12;
            const scalePcs = window.Scales.getScalePitchClasses(n.rootPc, n.scaleName);
            // scalePcs contains absolute pitch classes, so search for absolute pc (not relative)
            const scaleIndex = scalePcs.indexOf(pc);
            if (scaleIndex !== -1) {
              scaleDegree = String(scaleIndex + 1); // 1-indexed
            }
          }
        }

        // Color code notes by harmonic function
        // IMPORTANT: Check harmonicFunction ONLY, not ruleId
        // harmonicFunction is the authoritative label for color assignment
        if (n.harmonicFunction === 'chord-tone') {
          // Chord tones: Blue (or black if colors disabled)
          const color = useColors ? '#4cc3ff' : '#000000';
          sn.setStyle({ fillStyle: color, strokeStyle: color });

          // Add degree annotation below the note
          if (n.degree) {
            const degreeAnn = new VF.Annotation(n.degree)
              .setFont('Arial', 11, 'bold')
              .setJustification(VF.Annotation.Justify.CENTER)
              .setVerticalJustification(VF.Annotation.VerticalJustify.BOTTOM);
            sn.addAnnotation(0, degreeAnn);
          }
        } else if (n.harmonicFunction === 'scale-step') {
          // Scale tones: Green (or black if colors disabled)
          const color = useColors ? '#34c759' : '#000000';
          sn.setStyle({ fillStyle: color, strokeStyle: color });

          // Add scale degree annotation below the note
          if (scaleDegree) {
            const degreeAnn = new VF.Annotation(scaleDegree)
              .setFont('Arial', 11, 'bold')
              .setJustification(VF.Annotation.Justify.CENTER)
              .setVerticalJustification(VF.Annotation.VerticalJustify.BOTTOM);
            sn.addAnnotation(0, degreeAnn);
          }
        } else {
          // Chromatic notes (outside scale): Orange (or black if colors disabled)
          const color = useColors ? '#ff9500' : '#000000';
          sn.setStyle({ fillStyle: color, strokeStyle: color });
        }

        notes.push(sn);
        console.log(`[Notate DEBUG]   Pushed NOTE, notes.length after push=${notes.length}, notes array:`,
          notes.map((n, i) => `[${i}] ${n.duration}@${n.startBeat}`).join(', '));
        cursorE8 += durE8;
        console.log(`[Notate DEBUG]   After adding note, cursorE8 = ${cursorE8}`);
        noteIndex++; // Increment index for enclosure labeling
      }

      // Fill remaining slots with rests using midpoint-aware logic
      if (cursorE8 < 8) {
        const gapStartBeat = start + (cursorE8 / 2);
        const gapDurationBeats = (8 - cursorE8) / 2;
        addRestsForGap(gapStartBeat, gapDurationBeats);
      }

      // Debug: log all notes before filtering
      console.log(`[Notate DEBUG] ${seg.symbol} - notes array before filtering (${notes.length} total):`,
        notes.map((n, i) => ({
          index: i,
          duration: n.duration,
          isRest: n._isRestNote || false,
          startBeat: n.startBeat,
          hasSetContext: typeof n.setContext === 'function'
        }))
      );

      // Validate all notes before proceeding
      const validNotes = notes.filter(n => n && typeof n.setContext === 'function');

      if (validNotes.length === 0) {
        console.error('[Notate] No valid notes for measure:', seg.symbol);
        continue;
      }

      try {
        const voice = new VF.Voice({ num_beats: 4, beat_value: 4 }).setStrict(true);
        voice.addTickables(validNotes);

        const formatter = new VF.Formatter().joinVoices([voice]);
        // Fit strictly within note area between left and right barlines
        const noteArea = Math.max(10, (stave.getNoteEndX() - stave.getNoteStartX()) - 8);
        formatter.format([voice], noteArea);

        // Manual beaming based on actual beat positions
        // This ensures beams only connect notes within the same beat boundary

        // IMPORTANT: Log the actual validNotes array to debug beaming issues
        console.log(`[Notate DEBUG] Measure ${seg.symbol}:`, validNotes.map((n, i) => ({
          index: i,
          duration: n.duration,
          isRest: n._isRestNote || false,
          startBeat: n.startBeat,
          durationBeats: n.durationBeats,
          keys: n.getKeys ? n.getKeys() : 'no keys'
        })));

        const beamGroups = [];
        let currentGroup = [];

        for (let i = 0; i < validNotes.length; i++) {
          const note = validNotes[i];

          // Skip rests - check explicit _isRestNote flag
          if (note._isRestNote) {
            // Finish current group if any
            if (currentGroup.length >= 2) {
              beamGroups.push(currentGroup);
            }
            currentGroup = [];
            continue;
          }

          // Only beam eighth notes (duration = 0.5 beats)
          // Check if startBeat and durationBeats are defined
          if (typeof note.startBeat === 'undefined' || typeof note.durationBeats === 'undefined') {
            // Missing timing info - can't reliably beam this note
            if (currentGroup.length >= 2) {
              beamGroups.push(currentGroup);
            }
            currentGroup = [];
            continue;
          }

          if (note.durationBeats !== 0.5) {
            // Finish current group if any
            if (currentGroup.length >= 2) {
              beamGroups.push(currentGroup);
            }
            currentGroup = [];
            continue;
          }

          // Check if this note is within the same beat as previous note AND is consecutive
          if (currentGroup.length > 0) {
            const prevNote = currentGroup[currentGroup.length - 1];

            // Safety check: ensure prevNote has timing info
            if (typeof prevNote.startBeat === 'undefined' || typeof prevNote.durationBeats === 'undefined') {
              // Previous note missing timing info - start new group
              currentGroup = [note];
              continue;
            }

            const prevBeat = Math.floor(prevNote.startBeat);
            const currBeat = Math.floor(note.startBeat);

            // Check if notes are consecutive (no gap between them)
            const prevEndBeat = prevNote.startBeat + prevNote.durationBeats;
            const isConsecutive = Math.abs(prevEndBeat - note.startBeat) < 0.01; // tolerance for float precision

            if (prevBeat !== currBeat || !isConsecutive) {
              // Different beat OR not consecutive - finish current group
              if (currentGroup.length >= 2) {
                beamGroups.push(currentGroup);
              }
              currentGroup = [note];
            } else {
              // Same beat AND consecutive - add to current group
              currentGroup.push(note);
            }
          } else {
            // Start new group
            currentGroup = [note];
          }
        }

        // Finish last group if any
        if (currentGroup.length >= 2) {
          beamGroups.push(currentGroup);
        }

        // Log the beam groups that were created
        console.log(`[Notate DEBUG] Created ${beamGroups.length} beam groups for ${seg.symbol}`);
        beamGroups.forEach((group, i) => {
          console.log(`  Group ${i + 1}: ${group.length} notes starting at beat ${group[0].startBeat}`);
        });

        // Set consistent stem directions for each beam group before creating beams
        beamGroups.forEach(group => {
          // Calculate average pitch to determine stem direction
          // VexFlow uses line numbers where middle line (B4) is 0
          let totalLine = 0;
          group.forEach(note => {
            // Get the key line position (approximate)
            const keys = note.getKeys();
            if (keys && keys.length > 0) {
              // Parse key format like "d/4" or "f#/5"
              const keyMatch = keys[0].match(/([a-g][#b]?)\/(\d+)/);
              if (keyMatch) {
                const noteLetter = keyMatch[1][0];
                const octave = parseInt(keyMatch[2]);

                // Calculate approximate line number (B4 = middle line = 0)
                // Lines go: C4=-1, D4=0, E4=1, F4=2, G4=3, A4=4, B4=5, C5=6, etc.
                const noteOrder = {'c': 0, 'd': 1, 'e': 2, 'f': 3, 'g': 4, 'a': 5, 'b': 6};
                const baseLine = noteOrder[noteLetter];
                const lineFromMiddle = baseLine + (octave - 4) * 7;
                totalLine += lineFromMiddle;
              }
            }
          });

          const avgLine = totalLine / group.length;

          // If average position is above middle of staff (line > 3), stems go down
          // Otherwise stems go up
          const stemDirection = avgLine > 3 ? VF.Stem.DOWN : VF.Stem.UP;

          group.forEach(note => {
            note.setStemDirection(stemDirection);
          });
        });

        // Create VF.Beam objects for each valid group
        const beams = beamGroups.map(group => new VF.Beam(group));

        voice.draw(ctx, stave);

        // Filter out any null/undefined beams before drawing
        beams.filter(b => b).forEach(b => b.setContext(ctx).draw());

        // Draw enclosure labels spanning across note groups
        enclosureLabels.forEach((enclosureType, startIdx) => {
          // startIdx now points to either:
          // - enclosure-fill (for 2-note enclosure)
          // - first enclosure note (for 3-note enclosure)

          // Calculate endIdx based on pattern type
          let endIdx;
          if (enclosureType === '2-note') {
            // 2-note: fill + 2 enclosure notes = 3 total notes
            endIdx = startIdx + 2;
          } else {
            // 3-note: 3 enclosure notes = 3 total notes
            endIdx = startIdx + 2;
          }

          // Get the visual positions of the first and last notes in the pattern
          // Map segNotes index to validNotes index (accounting for rests)
          let firstNoteIdx = -1;
          let lastNoteIdx = -1;
          let segNoteCounter = 0;

          for (let i = 0; i < validNotes.length; i++) {
            const vfNote = validNotes[i];
            // Skip rests - check explicit _isRestNote flag
            if (vfNote._isRestNote) continue;

            if (segNoteCounter === startIdx) firstNoteIdx = i;
            if (segNoteCounter === endIdx) lastNoteIdx = i;

            segNoteCounter++;
          }

          if (firstNoteIdx !== -1 && lastNoteIdx !== -1) {
            try {
              const firstNote = validNotes[firstNoteIdx];
              const lastNote = validNotes[lastNoteIdx];

              // Get note positions
              const firstX = firstNote.getAbsoluteX();
              const lastX = lastNote.getAbsoluteX();
              const centerX = (firstX + lastX) / 2;

              // Position below the staff and below degree annotations
              // Staff is at y, staff lines span ~80px, degree annotations are ~15px below staff
              const textY = y + 175; // Much lower to avoid overlap with degree numbers

              // Draw the label
              const labelText = enclosureType === '2-note' ? '2-note enclosure' : '3-note enclosure';
              ctx.save();
              ctx.setFont('Arial', 9, 'italic');
              ctx.fillStyle = '#000000'; // Black color
              ctx.textAlign = 'center';
              ctx.fillText(labelText, centerX, textY);
              ctx.restore();
            } catch (error) {
              console.error('[Notate] Error drawing enclosure label:', error);
            }
          }
        });

        // Draw chord symbol and scale name as text above the stave (after voice is drawn)
        try {
          ctx.save();
          ctx.setFont('Arial', 12, 'normal');
          ctx.fillStyle = '#111827';
          ctx.fillText(seg.symbol, stave.getNoteStartX() + 5, y - 10);

          // Draw scale name below chord symbol if available
          const firstSegNote = segNotes[0];
          if (firstSegNote && firstSegNote.scaleName) {
            const scaleDisplayName = window.Scales ? window.Scales.getScaleDisplayName(firstSegNote.scaleName) : firstSegNote.scaleName;
            ctx.setFont('Arial', 9, 'italic');
            ctx.fillStyle = '#6b7280';
            ctx.fillText(scaleDisplayName, stave.getNoteStartX() + 5, y + 2);
          }
          ctx.restore();
        } catch (error) {
          console.error('[Notate] Error drawing text labels:', error);
        }
      } catch (error) {
        console.error('[Notate] Error rendering measure:', seg.symbol, error);
        console.error('[Notate] Valid notes:', validNotes);
        console.error('[Notate] Lick notes:', segNotes);
        throw error;
      }
    }
  }

  return { render };
})();
