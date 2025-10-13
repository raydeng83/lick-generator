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
        const relStartE8 = Math.round((n.startBeat - start) * 2);
        const durE8 = Math.round(n.durationBeats * 2);
        while (cursorE8 < relStartE8) {
          notes.push(new VF.StaveNote({ keys: ["b/4"], duration: "8r", auto_stem: true }));
          cursorE8 += 1;
        }
        const dur = durationFromBeats(n.durationBeats);
        const sn = new VF.StaveNote({ keys: [midiToKey(n.midi)], duration: dur, auto_stem: true });
        notes.push(sn);
        cursorE8 += durE8;
      }
      while (cursorE8 < 8) {
        notes.push(new VF.StaveNote({ keys: ["b/4"], duration: "8r", auto_stem: true }));
        cursorE8 += 1;
      }

      // Place chord symbol above first pitched note BEFORE formatting/drawing
      const firstNote = notes.find(n => String(n.getDuration()).indexOf('r') === -1);
      if (firstNote) {
        const ann = new VF.Annotation(seg.symbol)
          .setFont('Arial', 12, 'normal')
          .setJustification(VF.Annotation.Justify.LEFT)
          .setVerticalJustification(VF.Annotation.VerticalJustify.TOP);
        firstNote.addAnnotation(0, ann);
      }

      const voice = new VF.Voice({ num_beats: 4, beat_value: 4 }).setStrict(true);
      voice.addTickables(notes);
      const formatter = new VF.Formatter().joinVoices([voice]);
      // Fit strictly within note area between left and right barlines
      const noteArea = Math.max(10, (stave.getNoteEndX() - stave.getNoteStartX()) - 8);
      formatter.format([voice], noteArea);
      // Beam eighths within each beat (quarter grouping)
      const beams = VF.Beam.generateBeams(notes, {
        groups: [new VF.Fraction(1, 4)],
        beam_rests: false,
        maintain_stem_directions: false,
      });
      voice.draw(ctx, stave);
      beams.forEach(b => b.setContext(ctx).draw());

      if (!firstNote) {
        // Fallback: draw text at start if no pitched notes
        const text = new VF.TextNote({ text: seg.symbol, duration: "w" })
          .setJustification(VF.TextNote.Justification.LEFT)
          .setLine(0);
        const v2 = new VF.Voice({ num_beats: 4, beat_value: 4 }).addTickables([text]);
        new VF.Formatter().joinVoices([v2]).format([v2], 0);
        v2.draw(ctx, stave);
      }
    }
  }

  return { render };
})();
