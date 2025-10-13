Lick Generator Web UI (Prototype)

This is a minimal, no-build web prototype for exploring a rule-based jazz lick generator with notation and audio playback. It uses VexFlow and Tone.js via CDN so you can open it directly in a browser.

Quickstart

**Important**: Due to CORS restrictions with local audio files, you must serve the app via HTTP:

```bash
# Start local server
python3 -m http.server -d web 5173

# Then open in browser
open http://localhost:5173
```

Or use any other local server (Node's `http-server`, PHP's built-in server, etc.)

Features

- Chord progression input (iRealPro-style, e.g., `Cmaj7 | Dm7 G7 | Cmaj7 | Cmaj7`).
- **Rule 1**: Always place chord tones on strong beats (beats 1, 3) - highlighted in blue with degree labels.
- Multi-stage pipeline generator (rhythmic skeleton → harmonic function → pitch realization → post-processing).
- **Instruments**: Piano (sampled) and Synth (samples hosted locally).
- Staff notation rendered with VexFlow (treble, 4/4), one measure per chord with proper beaming.
- Playback with Tone.js, metronome toggle, tempo control (40-300 BPM).
- JSON state preview for interop.

Notes

- This prototype is dependency-free (no bundler). VexFlow and Tone.js load from CDNs at runtime.
- Audio samples (~1.1MB) are hosted locally in `web/samples/` for offline use and fast loading.
- The generator uses a pipeline architecture (see `web/generator.js`) for easy extension.
- VexFlow rendering assumes 4/4 and eighth-note quantization for simplicity.
- **Must use HTTP server** - direct file:// access blocked by browser CORS policy.

Next Steps

- Add swing and humanize options to playback.
- Expand chord parser (extensions, slashes, time changes).
- Color notes by function (chord/scalar/chromatic) and add rule explanations on hover.
- Export MIDI/MusicXML; shareable URL state.
