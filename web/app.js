// Wire UI: parse, generate, notate, and play

(function () {
  const $ = (sel) => document.querySelector(sel);
  const d$ = (sel) => Array.from(document.querySelectorAll(sel));

  const ui = {
    progression: $("#progression"),
    tempo: $("#tempo"),
    metronome: $("#metronome"),
    generate: $("#generate"),
    play: $("#play"),
    stop: $("#stop"),
    notation: $("#notation"),
    state: $("#state"),
    copyState: $("#copyState"),
    status: $("#status"),
  };

  // Seed example progression
  ui.progression.value = ui.progression.value || "Dm7 | G7 | Cmaj7 | Cmaj7";

  let lastModel = null;

  function setStatus(s) { ui.status.textContent = s; }

  function buildModel() {
    const meta = Schema.defaultMetadata();
    meta.tempo = parseInt(ui.tempo.value || "120", 10) || 120;
    const { progression, bars } = Schema.parseProgression(ui.progression.value);
    const lick = LickGen.generateLick(progression, meta);
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
      setStatus("Playing...");
      await AudioEngine.play({ lick: lastModel.lick, metadata: lastModel.metadata, metronome: ui.metronome.checked });
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
