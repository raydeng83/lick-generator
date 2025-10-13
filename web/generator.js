// Simple rule-based lick generator

window.LickGen = (function () {
  // Pitch helpers
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
    // crude quality detection
    const rest = sym.replace(/^([A-Ga-g][b#]?)/, "");
    if (/maj7|Δ|maj/i.test(rest)) return "maj7";
    if (/(m7b5|ø)/i.test(rest)) return "m7b5";
    if (/(dim|o7)/i.test(rest)) return "dim7";
    if (/(m7|min7|−7|mi7|m)/i.test(rest)) return "m7";
    if (/(7)/.test(rest)) return "7";
    return "maj7"; // default
  }

  function chordPitchClasses(rootPc, quality) {
    // triad/7th chord pcs relative to root
    switch (quality) {
      case "maj7": return [0, 4, 7, 11];
      case "m7": return [0, 3, 7, 10];
      case "7": return [0, 4, 7, 10];
      case "m7b5": return [0, 3, 6, 10];
      case "dim7": return [0, 3, 6, 9];
      default: return [0, 4, 7, 11];
    }
  }

  function scalePitchClasses(rootPc, quality) {
    // basic parent scales: Ionian, Dorian, Mixolydian, Locrian for m7b5
    switch (quality) {
      case "maj7": return [0, 2, 4, 5, 7, 9, 11];
      case "m7": return [0, 2, 3, 5, 7, 9, 10];
      case "7": return [0, 2, 4, 5, 7, 9, 10];
      case "m7b5": return [0, 2, 3, 5, 6, 8, 10];
      case "dim7": return [0, 2, 3, 5, 6, 8, 9]; // half-whole-ish
      default: return [0, 2, 4, 5, 7, 9, 11];
    }
  }

  function pcToMidiNear(pc, nearMidi) {
    // choose midi with given pitch class near a target midi (keep within small leap)
    if (nearMidi == null) return 60 + pc; // anchor around middle C
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

  function nearestChordTone(midiPrev, rootPc, chordPcs) {
    const pcs = chordPcs.map(pc => (rootPc + pc) % 12);
    const candidates = pcs.map(pc => clampRange(pcToMidiNear(pc, midiPrev ?? 64)));
    candidates.sort((a, b) => Math.abs(a - (midiPrev ?? 64)) - Math.abs(b - (midiPrev ?? 64)));
    return candidates[0];
  }

  function approachFromBelow(targetMidi) {
    return targetMidi - 1; // chromatic approach from below
  }

  function scaleStep(midiPrev, rootPc, scalePcs, dir = 0) {
    const targetPc = ((midiPrev ?? 64) % 12 + 12) % 12;
    const scaleAbs = scalePcs.map(pc => (rootPc + pc + 120) % 12);
    // find nearest scale degree and step by 1 degree up/down
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

  function generateLick(prog, metadata) {
    // Generate 8 eighth-notes per bar (4/4), targeting chord tones on beats 1 and 3
    const lick = [];
    let lastMidi = 64; // E4
    const totalBars = Math.max(0, ...prog.map(p => p.bar)) + 1;

    for (let bar = 0; bar < totalBars; bar++) {
      // get segments in this bar (one or more chords)
      const segs = prog.filter(p => p.bar === bar);
      // build 8 positions (eighths) with the active chord for that position
      for (let i = 0; i < 8; i++) {
        const posBeat = bar * 4 + i * 0.5; // global beat position
        const seg = segs.find(s => posBeat >= s.startBeat && posBeat < s.startBeat + s.durationBeats) || segs[0];
        const rootPc = parseRoot(seg.symbol) ?? 0;
        const qual = parseQuality(seg.symbol);
        const chordPcs = chordPitchClasses(rootPc, qual);
        const scalePcs = scalePitchClasses(rootPc, qual);

        let midi = lastMidi;
        let ruleId = "scale-step";

        const isStrongBeat = (i % 4 === 0); // beats 1 and 3
        const isUpbeatBeforeStrong = (i % 4 === 1); // the 'and' after 1 and 3

        if (isStrongBeat) {
          midi = nearestChordTone(lastMidi, rootPc, chordPcs);
          ruleId = "chord-tone-target";
        } else if (isUpbeatBeforeStrong) {
          const target = nearestChordTone(lastMidi, rootPc, chordPcs);
          midi = approachFromBelow(target);
          ruleId = "chromatic-approach";
        } else {
          midi = scaleStep(lastMidi, rootPc, scalePcs);
          ruleId = "scale-step";
        }

        // constrain leap size moderately
        if (Math.abs(midi - lastMidi) > 9) {
          midi = pcToMidiNear((midi % 12 + 12) % 12, lastMidi);
        }
        midi = clampRange(midi, 55, 81);

        lick.push({
          startBeat: posBeat,
          durationBeats: 0.5,
          midi,
          velocity: 0.9,
          ruleId,
        });
        lastMidi = midi;
      }
    }

    return lick;
  }

  return {
    generateLick,
    parseRoot,
    parseQuality,
  };
})();

