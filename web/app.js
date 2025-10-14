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

  // Update swing display
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

  let lastModel = null;

  function setStatus(s) { ui.status.textContent = s; }

  function buildModel() {
    const meta = Schema.defaultMetadata();
    meta.tempo = parseInt(ui.tempo.value || "120", 10) || 120;
    const { progression, bars } = Schema.parseProgression(ui.progression.value);

    // Pass scale and device strategies to generator
    const deviceStrategyValue = ui.deviceStrategy.value || 'disabled';
    const swingValue = parseFloat(ui.swing.value) || 0;
    const options = {
      scaleStrategy: ui.scaleStrategy.value || 'default',
      deviceStrategy: deviceStrategyValue,
      useDevices: deviceStrategyValue !== 'disabled',
      swing: swingValue
    };

    const lick = LickGen.generateLick(progression, meta, options);
    const model = { progression, bars, lick, metadata: meta };
    lastModel = model;
    return model;
  }

  function renderAll(model) {
    Notate.render({ container: ui.notation, progression: model.progression, lick: model.lick, metadata: model.metadata });
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
      const instrumentName = ui.instrument.value;
      const needsLoading = instrumentName !== 'synth';

      setStatus(needsLoading ? "Loading samples..." : "Playing...");
      await AudioEngine.play({
        lick: lastModel.lick,
        metadata: lastModel.metadata,
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
