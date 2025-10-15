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
    const widthPerMeasure = 240; // base width
    const extraFirstMeasure = 70; // extra room for clef/time per system
    const staveHeight = 120;
    const systemGap = 24; // vertical gap between systems
    const leftMargin = 10;
    const rightMargin = 10;
    const topMargin = 35; // increased to prevent chord symbol truncation
    const bottomMargin = 80; // increased to accommodate enclosure labels below staff
    const containerWidth = Math.max(320, el.clientWidth || (el.parentElement && el.parentElement.clientWidth) || 800);

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
        .sort((a, b) => a.startBeat - b.startBeat);

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

      let noteIndex = 0; // Track index in segNotes for enclosure labeling
      for (const n of segNotes) {
        // Handle rest notes
        if (n.isRest) {
          const relStartE8 = Math.round((n.startBeat - start) * 2);
          const durE8 = Math.round(n.durationBeats * 2);

          // Fill rests up to this rest note
          while (cursorE8 < relStartE8) {
            notes.push(new VF.StaveNote({ keys: ["b/4"], duration: "8r", auto_stem: true }));
            cursorE8 += 1;
          }

          // Add the explicit rest note
          const dur = durationFromBeats(n.durationBeats);
          notes.push(new VF.StaveNote({ keys: ["b/4"], duration: dur + "r", auto_stem: true }));
          cursorE8 += durE8;
          continue;
        }

        // Safety check: ensure note has required properties
        if (!n || typeof n.midi !== 'number' || typeof n.durationBeats !== 'number') {
          console.error('[Notate] Invalid note:', n);
          continue;
        }

        const relStartE8 = Math.round((n.startBeat - start) * 2);
        const durE8 = Math.round(n.durationBeats * 2);

        // Fill rests up to this note
        while (cursorE8 < relStartE8) {
          notes.push(new VF.StaveNote({ keys: ["b/4"], duration: "8r", auto_stem: true }));
          cursorE8 += 1;
        }

        const dur = durationFromBeats(n.durationBeats);
        const key = midiToKey(n.midi, n.noteName);

        // Validate key format before creating note
        if (!key || !key.includes('/')) {
          console.error('[Notate] Invalid MIDI key:', key, 'from MIDI:', n.midi);
          continue;
        }

        const sn = new VF.StaveNote({ keys: [key], duration: dur, auto_stem: true });

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
        if (n.harmonicFunction === 'chord-tone' || n.ruleId === 'chord-tone' ||
            n.ruleId === 'arpeggio-chord-tone' || n.ruleId === 'scale-run-chord-tone') {
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
        } else if (n.harmonicFunction === 'scale-step' || n.ruleId === 'scale-step' ||
                   n.ruleId === 'scale-run' || n.ruleId === 'melodic-cell' ||
                   (n.ruleId === 'neighbor' && n.harmonicFunction === 'scale-step') ||
                   (n.ruleId === 'enclosure-upper' && n.harmonicFunction === 'scale-step') ||
                   (n.ruleId === 'enclosure-lower' && n.harmonicFunction === 'scale-step')) {
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
          // Chromatic/device notes (outside scale): Orange (or black if colors disabled)
          const color = useColors ? '#ff9500' : '#000000';
          sn.setStyle({ fillStyle: color, strokeStyle: color });
        }

        notes.push(sn);
        cursorE8 += durE8;
        noteIndex++; // Increment index for enclosure labeling
      }

      // Fill remaining slots with rests
      while (cursorE8 < 8) {
        notes.push(new VF.StaveNote({ keys: ["b/4"], duration: "8r", auto_stem: true }));
        cursorE8 += 1;
      }

      // Validate all notes before proceeding
      const validNotes = notes.filter(n => n && typeof n.setContext === 'function');

      if (validNotes.length === 0) {
        console.error('[Notate] No valid notes for measure:', seg.symbol);
        continue;
      }

      try {
        console.log('[Notate] Creating voice with', validNotes.length, 'notes for measure:', seg.symbol);

        const voice = new VF.Voice({ num_beats: 4, beat_value: 4 }).setStrict(true);
        voice.addTickables(validNotes);

        const formatter = new VF.Formatter().joinVoices([voice]);
        // Fit strictly within note area between left and right barlines
        const noteArea = Math.max(10, (stave.getNoteEndX() - stave.getNoteStartX()) - 8);
        formatter.format([voice], noteArea);

        // Beam eighths within each beat (quarter grouping)
        const beams = VF.Beam.generateBeams(validNotes, {
          groups: [new VF.Fraction(1, 4)],
          beam_rests: false,
          maintain_stem_directions: false,
        });

        console.log('[Notate] Drawing voice...');
        voice.draw(ctx, stave);

        console.log('[Notate] Drawing', beams.length, 'beams...');
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
            // Skip rests
            if (vfNote.duration.includes('r')) continue;

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

        console.log('[Notate] Measure rendered successfully');

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
