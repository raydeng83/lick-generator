Lick Generator Web UI (Prototype)

This is a minimal, no-build web prototype for exploring a rule-based jazz lick generator with notation and audio playback. It uses VexFlow and Tone.js via CDN so you can open it directly in a browser.

Quickstart

- Open `web/index.html` in a modern browser (Chrome, Edge, or Safari).
- If your browser blocks local file audio, serve locally:
  - Python: `python3 -m http.server -d web 5173`
  - Then open: `http://localhost:5173`

Features

- Chord progression input (iRealPro-style, e.g., `Cmaj7 | Dm7 G7 | Cmaj7 | Cmaj7`).
- Simple rule-based generator (chord-tone targets, chromatic approaches, scale steps).
- Staff notation rendered with VexFlow (treble, 4/4), one measure per chord with the chord symbol above the first note of that measure.
- Playback with Tone.js (synth lead), metronome toggle, tempo control.
- JSON state preview for interop.

Notes

- This prototype is dependency-free (no bundler). Libraries load from CDNs at runtime.
- The generator is intentionally simple and deterministic; extend `web/generator.js` with your rules and weights.
- VexFlow rendering assumes 4/4 and eighth-note quantization for simplicity.

Next Steps

- Add swing and humanize options to playback.
- Expand chord parser (extensions, slashes, time changes).
- Color notes by function (chord/scalar/chromatic) and add rule explanations on hover.
- Export MIDI/MusicXML; shareable URL state.
