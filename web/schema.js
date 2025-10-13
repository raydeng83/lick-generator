// JSON schema helpers and simple chord progression parsing

window.Schema = (function () {
  const DEFAULT_PPQ = 480;

  function defaultMetadata() {
    return { tempo: 120, timeSig: "4/4", key: "C", ppq: DEFAULT_PPQ };
  }

  function normalizeProgressionText(text) {
    return (text || "")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Very simple parser: split by bars `|`, each bar is 4 beats (4/4)
  // Space-separated chords within a bar split beats equally (e.g., 2 chords => 2 beats each).
  function parseProgression(text) {
    const cleaned = normalizeProgressionText(text);
    if (!cleaned) return { progression: [], bars: 0 };

    const bars = cleaned.split("|").map(s => s.trim()).filter(Boolean);
    const progression = [];
    let barIdx = 0;
    let globalBeat = 0;
    for (const bar of bars) {
      const tokens = bar.split(" ").filter(Boolean);
      const perChordBeats = 4 / Math.max(1, tokens.length);
      let beatInBar = 0;
      for (const symbol of tokens) {
        progression.push({
          bar: barIdx,
          startBeat: globalBeat + beatInBar,
          symbol,
          durationBeats: perChordBeats,
        });
        beatInBar += perChordBeats;
      }
      barIdx += 1;
      globalBeat += 4; // 4/4
    }
    return { progression, bars: barIdx };
  }

  function toState({ progression, lick, metadata }) {
    return JSON.stringify({ progression, lick, metadata }, null, 2);
  }

  return {
    defaultMetadata,
    parseProgression,
    toState,
  };
})();

