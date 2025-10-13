// Tone.js playback of lick + metronome

window.AudioEngine = (function () {
  const state = {
    synth: null,
    click: null,
    part: null,
    metro: null,
  };

  function ensureSynth() {
    if (!state.synth) {
      state.synth = new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.1 },
      }).toDestination();
    }
    if (!state.click) {
      state.click = new Tone.MembraneSynth({ volume: -6 }).toDestination();
    }
  }

  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function beatsToMusicTime(beats) {
    const bar = Math.floor(beats / 4);
    const beatInBar = Math.floor(beats % 4);
    const sixteenths = Math.round(((beats - Math.floor(beats)) * 4)); // 0..3
    return `${bar}:${beatInBar}:${sixteenths}`;
  }

  function beatsToDur(beats) {
    if (Math.abs(beats - 0.5) < 1e-6) return "8n";
    if (Math.abs(beats - 1) < 1e-6) return "4n";
    if (Math.abs(beats - 2) < 1e-6) return "2n";
    if (Math.abs(beats - 4) < 1e-6) return "1n";
    return `${beats * 0.5}n`; // fallback
  }

  function scheduleLick(lick) {
    // Clear previous scheduled events
    Tone.Transport.cancel();
    if (state.part) { state.part.dispose(); state.part = null; }
    // Create a Part with musical time positions
    const events = lick.map(n => ({
      time: beatsToMusicTime(n.startBeat),
      note: n.midi,
      dur: beatsToDur(n.durationBeats),
      vel: n.velocity ?? 0.9,
    }));
    state.part = new Tone.Part((time, ev) => {
      state.synth.triggerAttackRelease(midiToFreq(ev.note), ev.dur, time, ev.vel);
    }, events).start(0);
    state.part.loop = 0; // play once
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

  async function play({ lick, metadata, metronome }) {
    ensureSynth();
    await Tone.start();
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.bpm.value = metadata.tempo || 120;
    Tone.Transport.timeSignature = 4;

    scheduleLick(lick);
    scheduleMetronome(metronome);

    // compute loop end and schedule stop
    const last = lick[lick.length - 1];
    const totalBeats = last ? (last.startBeat + last.durationBeats) : 0;
    Tone.Transport.start();
    Tone.Transport.scheduleOnce(() => stop(), beatsToMusicTime(totalBeats));
  }

  function stop() {
    Tone.Transport.stop();
  }

  return { play, stop };
})();
