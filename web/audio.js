// Tone.js playback of lick + metronome with sampled instruments

window.AudioEngine = (function () {
  const state = {
    instruments: {},
    currentInstrument: null,
    chordSynth: null,
    click: null,
    part: null,
    chordPart: null,
    metro: null,
  };

  function ensureInstruments() {
    // Create piano sampler if not exists
    if (!state.instruments.piano) {
      console.log('[AudioEngine] Creating piano sampler...');
      state.instruments.piano = new Tone.Sampler({
        urls: {
          C3: "C3.mp3",
          "D#3": "Ds3.mp3",
          "F#3": "Fs3.mp3",
          A3: "A3.mp3",
          C4: "C4.mp3",
          "D#4": "Ds4.mp3",
          "F#4": "Fs4.mp3",
          A4: "A4.mp3",
          C5: "C5.mp3",
          "D#5": "Ds5.mp3",
          "F#5": "Fs5.mp3",
          A5: "A5.mp3",
        },
        release: 1,
        baseUrl: "./samples/piano/",
        onload: () => console.log('[AudioEngine] Piano loaded successfully'),
        onerror: (err) => console.error('[AudioEngine] Piano load error:', err),
      }).toDestination();
    }

    // Create synth fallback if not exists
    if (!state.instruments.synth) {
      console.log('[AudioEngine] Creating synth...');
      state.instruments.synth = new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.1 },
      }).toDestination();
      console.log('[AudioEngine] Synth created successfully');
    }

    // Create chord synth if not exists
    if (!state.chordSynth) {
      state.chordSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 1 },
        volume: -12,
      }).toDestination();
      console.log('[AudioEngine] Chord synth created');
    }

    // Create metronome click if not exists
    if (!state.click) {
      state.click = new Tone.MembraneSynth({ volume: -6 }).toDestination();
    }

    // Set default instrument
    if (!state.currentInstrument) {
      state.currentInstrument = state.instruments.piano;
    }
  }

  function setInstrument(instrumentName) {
    console.log('[AudioEngine] setInstrument called with:', instrumentName);
    ensureInstruments();
    if (state.instruments[instrumentName]) {
      state.currentInstrument = state.instruments[instrumentName];
      console.log('[AudioEngine] Current instrument set to:', instrumentName, state.currentInstrument);
    } else {
      console.error('[AudioEngine] Instrument not found:', instrumentName);
    }
  }

  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function beatsToMusicTime(beats) {
    const bar = Math.floor(beats / 4);
    const beatInBar = Math.floor(beats % 4);
    const sixteenths = Math.round(((beats - Math.floor(beats)) * 4)); // 0..3
    return `${bar}:${beatInBar}:${sixteenths}`;
  }

  function beatsToDur(beats, tempo) {
    // For standard note durations, use musical notation
    if (Math.abs(beats - 0.5) < 1e-6) return "8n";
    if (Math.abs(beats - 1) < 1e-6) return "4n";
    if (Math.abs(beats - 2) < 1e-6) return "2n";
    if (Math.abs(beats - 4) < 1e-6) return "1n";

    // For non-standard durations (swing), convert to seconds
    // Duration in seconds = (beats / tempo) * 60
    const seconds = (beats / tempo) * 60;
    return seconds.toFixed(4); // Return as string "0.2500" etc
  }

  function scheduleLick(lick, tempo) {
    // Clear previous scheduled events
    Tone.Transport.cancel();
    if (state.part) { state.part.dispose(); state.part = null; }
    // Create a Part with musical time positions
    const events = lick.map(n => ({
      time: beatsToMusicTime(n.startBeat),
      note: n.midi,
      dur: beatsToDur(n.durationBeats, tempo),
      vel: n.velocity ?? 0.9,
    }));
    state.part = new Tone.Part((time, ev) => {
      // Use sampler for piano, frequency for synth
      if (state.currentInstrument instanceof Tone.Sampler) {
        const note = midiToNote(ev.note);
        console.log('[AudioEngine] Triggering sampler note:', note, 'dur:', ev.dur);
        state.currentInstrument.triggerAttackRelease(note, ev.dur, time, ev.vel);
      } else {
        const freq = midiToFreq(ev.note);
        console.log('[AudioEngine] Triggering synth freq:', freq, 'dur:', ev.dur);
        state.currentInstrument.triggerAttackRelease(freq, ev.dur, time, ev.vel);
      }
    }, events).start(0);
    state.part.loop = 0; // play once
  }

  function midiToNote(midi) {
    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const octave = Math.floor(midi / 12) - 1;
    const note = notes[midi % 12];
    return note + octave;
  }

  function noteToMidi(noteName) {
    const noteMap = { "C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11 };
    const match = noteName.match(/^([A-G])([b#]?)(\d+)$/);
    if (!match) return 60; // default to C4

    const letter = match[1];
    const accidental = match[2];
    const octave = parseInt(match[3]);

    let pc = noteMap[letter];
    if (accidental === "b") pc -= 1;
    if (accidental === "#") pc += 1;

    return (octave + 1) * 12 + pc;
  }

  function generateChordVoicing(symbol) {
    // Parse root and quality (reuse generator logic)
    const rootMatch = symbol.match(/^([A-Ga-g])([b#]?)/);
    if (!rootMatch) return [];

    const rootLetter = rootMatch[1].toUpperCase();
    const accidental = rootMatch[2] || "";
    const rootNoteName = rootLetter + accidental;

    const rest = symbol.replace(/^([A-Ga-g][b#]?)/, "");
    let quality = "maj7";
    if (/maj7|Δ|maj/i.test(rest)) quality = "maj7";
    else if (/(m7b5|ø)/i.test(rest)) quality = "m7b5";
    else if (/(dim|o7)/i.test(rest)) quality = "dim7";
    else if (/(m7|min7|−7|mi7|m)/i.test(rest)) quality = "m7";
    else if (/(7)/.test(rest)) quality = "7";

    // Create jazz voicing in mid range
    const octave = 3;
    const rootMidi = noteToMidi(rootNoteName + octave);

    // Build intervals based on quality
    let intervals = [];
    switch(quality) {
      case "maj7":
        intervals = [0, 4, 7, 11]; // root, M3, P5, M7
        break;
      case "m7":
        intervals = [0, 3, 7, 10]; // root, m3, P5, m7
        break;
      case "7":
        intervals = [0, 4, 7, 10]; // root, M3, P5, m7
        break;
      case "m7b5":
        intervals = [0, 3, 6, 10]; // root, m3, dim5, m7
        break;
      case "dim7":
        intervals = [0, 3, 6, 9]; // root, m3, dim5, dim7
        break;
      default:
        intervals = [0, 4, 7, 11];
    }

    // Convert to note names
    return intervals.map(interval => midiToNote(rootMidi + interval));
  }

  function scheduleChords(progression, enabled) {
    if (state.chordPart) { state.chordPart.dispose(); state.chordPart = null; }
    if (!enabled) return;

    // Create chord events at start of each measure
    const events = progression.map((ch, idx) => ({
      time: `${idx}:0:0`,
      notes: generateChordVoicing(ch.symbol),
      duration: "1n", // whole note
    }));

    console.log('[AudioEngine] Scheduling chords:', events);

    state.chordPart = new Tone.Part((time, ev) => {
      state.chordSynth.triggerAttackRelease(ev.notes, ev.duration, time, 0.5);
    }, events).start(0);
    state.chordPart.loop = 0; // play once
  }

  function scheduleMetronome(enabled) {
    if (state.metro) { state.metro.dispose(); state.metro = null; }
    if (!enabled) return;
    let clickCount = 0;
    state.metro = new Tone.Loop((time) => {
      const accent = (clickCount % 4 === 0);
      state.click.triggerAttackRelease(accent ? "C3" : "C2", "16n", time, accent ? 0.9 : 0.6);
      clickCount++;
    }, "4n");
    state.metro.start(0);
  }

  async function play({ lick, metadata, metronome, instrument = 'piano', chords = false, progression = [] }) {
    console.log('[AudioEngine] play() called with instrument:', instrument, 'chords:', chords);
    ensureInstruments();
    setInstrument(instrument);

    // Wait for sampler to load before playing
    if (state.currentInstrument instanceof Tone.Sampler) {
      console.log('[AudioEngine] Waiting for sampler to load...');
      await state.currentInstrument.loaded;
      console.log('[AudioEngine] Sampler loaded and ready');
    }

    await Tone.start();
    console.log('[AudioEngine] Tone.js started, context state:', Tone.context.state);
    Tone.Transport.stop();
    Tone.Transport.cancel();
    const tempo = metadata.tempo || 120;
    Tone.Transport.bpm.value = tempo;
    Tone.Transport.timeSignature = 4;

    scheduleLick(lick, tempo);
    scheduleChords(progression, chords);
    scheduleMetronome(metronome);

    // compute loop end and schedule stop
    const last = lick[lick.length - 1];
    const totalBeats = last ? (last.startBeat + last.durationBeats) : 0;
    console.log('[AudioEngine] Starting transport, total beats:', totalBeats);
    Tone.Transport.start();
    Tone.Transport.scheduleOnce(() => stop(), beatsToMusicTime(totalBeats));
  }

  function stop() {
    Tone.Transport.stop();
  }

  return { play, stop, setInstrument };
})();
