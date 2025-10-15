// Wire UI: parse, generate, notate, and play

(function () {
  const $ = (sel) => document.querySelector(sel);
  const d$ = (sel) => Array.from(document.querySelectorAll(sel));

  const ui = {
    progression: $("#progression"),
    tempo: $("#tempo"),
    instrument: $("#instrument"),
    scaleStrategy: $("#scaleStrategy"),
    deviceStrategy: $("#deviceStrategy"),
    swing: $("#swing"),
    swingValue: $("#swingValue"),
    metronome: $("#metronome"),
    chords: $("#chords"),
    insertRests: $("#insertRests"),
    coloredNotes: $("#coloredNotes"),
    generate: $("#generate"),
    play: $("#play"),
    stop: $("#stop"),
    notation: $("#notation"),
    state: $("#state"),
    copyState: $("#copyState"),
    status: $("#status"),
  };

  // Seed example progression
  ui.progression.value = ui.progression.value || "Dm7 | G7 | Cmaj7";

  // Update swing display only (don't regenerate)
  function updateSwingDisplay() {
    const value = parseFloat(ui.swing.value);
    const percent = Math.round(value * 100);
    if (value === 0) {
      ui.swingValue.textContent = "0% (Straight)";
    } else if (value === 0.5) {
      ui.swingValue.textContent = "50% (Triplet Feel)";
    } else {
      ui.swingValue.textContent = `${percent}%`;
    }
  }

  ui.swing.addEventListener("input", updateSwingDisplay);
  updateSwingDisplay();

  // Re-render notation when color toggle changes
  if (ui.coloredNotes) {
    ui.coloredNotes.addEventListener("change", () => {
      if (lastModel) {
        renderAll(lastModel);
      }
    });
  }

  let lastModel = null;

  function setStatus(s) { ui.status.textContent = s; }

  // Apply swing timing to a lick (without regenerating notes)
  function applySwingToLick(lick, swingRatio) {
    if (swingRatio === 0 || !lick || lick.length === 0) {
      return lick;
    }

    const swung = [];
    for (let i = 0; i < lick.length; i++) {
      const note = lick[i];
      const nextNote = i < lick.length - 1 ? lick[i + 1] : null;

      // Check if this is an eighth note pair (both 0.5 beats)
      const isEighthNote = note.durationBeats === 0.5;
      const isOnBeat = isEighthNote && (note.startBeat % 1 === 0);
      const hasNextEighthNote = nextNote && nextNote.durationBeats === 0.5 &&
                                 nextNote.startBeat === note.startBeat + 0.5;

      if (isOnBeat && hasNextEighthNote) {
        // Apply swing to this pair
        const swingOffset = swingRatio * (1/6);

        // Lengthen first note
        swung.push({
          ...note,
          durationBeats: 0.5 + swingOffset,
        });

        // Shorten and delay second note
        swung.push({
          ...nextNote,
          startBeat: note.startBeat + 0.5 + swingOffset,
          durationBeats: 0.5 - swingOffset,
        });

        i++; // Skip next note since we've processed it
      } else {
        // Not part of a swung pair, keep as-is
        swung.push(note);
      }
    }

    return swung;
  }

  function buildModel() {
    const meta = Schema.defaultMetadata();
    meta.tempo = 120;  // Default tempo (actual tempo set at playback time)
    const { progression, bars } = Schema.parseProgression(ui.progression.value);

    // Pass scale and device strategies to generator
    const deviceStrategyValue = ui.deviceStrategy.value || 'disabled';
    const options = {
      scaleStrategy: ui.scaleStrategy.value || 'default',
      deviceStrategy: deviceStrategyValue,
      useDevices: deviceStrategyValue !== 'disabled',
      swing: 0,  // Always generate with straight timing (swing applied at playback)
      insertRests: ui.insertRests.checked  // Random rest insertion
    };

    const lick = LickGen.generateLick(progression, meta, options);
    const model = { progression, bars, lick, metadata: meta };
    lastModel = model;
    return model;
  }

  function renderAll(model) {
    Notate.render({
      container: ui.notation,
      progression: model.progression,
      lick: model.lick,
      metadata: model.metadata,
      useColors: ui.coloredNotes.checked
    });
    ui.state.textContent = Schema.toState(model);
  }

  ui.generate.addEventListener("click", () => {
    try {
      const model = buildModel();
      renderAll(model);
      setStatus("Generated.");
    } catch (e) {
      console.error(e);
      setStatus("Error generating lick.");
    }
  });

  ui.play.addEventListener("click", async () => {
    try {
      if (!lastModel) {
        const model = buildModel();
        renderAll(model);
      }

      // Apply swing to the existing lick before playing
      const swingValue = parseFloat(ui.swing.value) || 0;
      console.log('[App] Applying swing:', swingValue);
      const lickToPlay = applySwingToLick(lastModel.lick, swingValue);
      console.log('[App] Original lick length:', lastModel.lick.length);
      console.log('[App] Swung lick length:', lickToPlay.length);
      if (lickToPlay.length > 0) {
        console.log('[App] First note duration:', lickToPlay[0].durationBeats);
        if (lickToPlay.length > 1) {
          console.log('[App] Second note duration:', lickToPlay[1].durationBeats);
        }
      }

      // Get current tempo from UI (not from lastModel)
      const currentTempo = parseInt(ui.tempo.value || "120", 10) || 120;
      const metadata = { ...lastModel.metadata, tempo: currentTempo };

      const instrumentName = ui.instrument.value;
      const needsLoading = instrumentName !== 'synth';

      setStatus(needsLoading ? "Loading samples..." : "Playing...");
      await AudioEngine.play({
        lick: lickToPlay,
        metadata: metadata,
        metronome: ui.metronome.checked,
        instrument: instrumentName,
        chords: ui.chords.checked,
        progression: lastModel.progression
      });
      setStatus("Playing...");
    } catch (e) {
      console.error(e);
      setStatus("Playback error.");
    }
  });

  ui.stop.addEventListener("click", () => {
    AudioEngine.stop();
    setStatus("Stopped.");
  });

  ui.copyState.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(ui.state.textContent || "");
      setStatus("JSON copied.");
    } catch {
      setStatus("Copy failed.");
    }
  });

  // initial render
  (function init() {
    const model = buildModel();
    renderAll(model);
  })();
})();
