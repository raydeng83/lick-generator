// VexFlow rendering of the lick and chord symbols

window.Notate = (function () {
  const VF = Vex.Flow;

  function midiToKey(midi) {
    const N = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
    const n = N[(midi % 12 + 12) % 12];
    const o = Math.floor(midi / 12) - 1;
    return `${n}/${o}`;
  }

  function durationFromBeats(beats) {
    if (Math.abs(beats - 0.5) < 1e-6) return "8"; // eighth
    if (Math.abs(beats - 1) < 1e-6) return "q"; // quarter
    if (Math.abs(beats - 2) < 1e-6) return "h"; // half
    if (Math.abs(beats - 4) < 1e-6) return "w"; // whole
    // default
    return "8";
  }

  function render({ container, progression, lick, metadata }) {
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
    const topMargin = 20;
    const bottomMargin = 20;
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
      for (const n of segNotes) {
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
        const key = midiToKey(n.midi);

        // Validate key format before creating note
        if (!key || !key.includes('/')) {
          console.error('[Notate] Invalid MIDI key:', key, 'from MIDI:', n.midi);
          continue;
        }

        const sn = new VF.StaveNote({ keys: [key], duration: dur, auto_stem: true });

        // Color code notes by harmonic function
        if (n.harmonicFunction === 'chord-tone' || n.ruleId === 'chord-tone' ||
            n.ruleId === 'arpeggio-chord-tone' || n.ruleId === 'scale-run-chord-tone') {
          // Chord tones: Blue (includes targets from neighbor/enclosure devices)
          sn.setStyle({ fillStyle: '#4cc3ff', strokeStyle: '#4cc3ff' });

          // Add degree annotation below the note
          if (n.degree) {
            const degreeAnn = new VF.Annotation(n.degree)
              .setFont('Arial', 11, 'bold')
              .setJustification(VF.Annotation.Justify.CENTER)
              .setVerticalJustification(VF.Annotation.VerticalJustify.BOTTOM);
            sn.addAnnotation(0, degreeAnn);
          }
        } else {
          // Scale tones and devices: Green
          sn.setStyle({ fillStyle: '#34c759', strokeStyle: '#34c759' });
        }

        notes.push(sn);
        cursorE8 += durE8;
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
