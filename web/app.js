// Wire UI: parse, generate, notate, and play

(function () {
  const $ = (sel) => document.querySelector(sel);
  const d$ = (sel) => Array.from(document.querySelectorAll(sel));

  const ui = {
    // Mode toggles
    modeProgression: $("#modeProgression"),
    modeRhythm: $("#modeRhythm"),

    // Progression mode
    progressionControls: $("#progressionControls"),
    progression: $("#progression"),

    // Rhythm exercise mode
    rhythmControls: $("#rhythmControls"),
    exerciseChord: $("#exerciseChord"),
    numRests: $("#numRests"),
    diceIt: $("#diceIt"),
    firstPattern: $("#firstPattern"),
    prevPattern: $("#prevPattern"),
    nextPattern: $("#nextPattern"),
    patternInfo: $("#patternInfo"),
    resetOriginal: $("#resetOriginal"),

    // Common controls
    tempo: $("#tempo"),
    instrument: $("#instrument"),
    scaleStrategy: $("#scaleStrategy"),
    deviceStrategy: $("#deviceStrategy"),
    swing: $("#swing"),
    swingValue: $("#swingValue"),
    metronome: $("#metronome"),
    chords: $("#chords"),
    showRests: $("#showRests"),
    regenerateRests: $("#regenerateRests"),
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

  // Toggle showing/hiding rests (without regenerating the rest pattern)
  if (ui.showRests) {
    ui.showRests.addEventListener("change", () => {
      if (lastModelWithoutRests) {
        // Show rests or hide rests based on checkbox state
        const finalLick = ui.showRests.checked && lastModelWithRests
          ? lastModelWithRests.lick
          : lastModelWithoutRests.lick;

        lastModel = {
          ...lastModelWithoutRests,
          lick: finalLick
        };

        renderAll(lastModel);
        setStatus(ui.showRests.checked ? "Showing rests." : "Hiding rests.");
      }
    });
  }

  // Generate new rest pattern button
  if (ui.regenerateRests) {
    ui.regenerateRests.addEventListener("click", () => {
      if (lastModelWithoutRests) {
        // Generate a NEW random rest pattern
        const lickWithNewRests = applyRandomRests(lastModelWithoutRests.lick);

        lastModelWithRests = {
          ...lastModelWithoutRests,
          lick: lickWithNewRests
        };

        // If "Show Rests" is checked, display the new pattern immediately
        if (ui.showRests.checked) {
          lastModel = lastModelWithRests;
          renderAll(lastModel);
          setStatus("New rest pattern generated.");
        } else {
          setStatus("New rest pattern generated (check 'Show Rests' to view).");
        }
      }
    });
  }

  let lastModel = null;
  let lastModelWithoutRests = null; // Store version without inserted rests
  let lastModelWithRests = null; // Store version with current rest pattern

  // Rhythm exercise state
  let rhythmExerciseMode = false;
  let originalRhythmPhrase = null; // The 8-note phrase without rests
  let currentRhythmPhrase = null; // The phrase with rests inserted
  let allPatterns = []; // All possible rest patterns for current numRests
  let currentPatternIndex = 0; // Index in allPatterns

  function setStatus(s) { ui.status.textContent = s; }

  // Mode switching
  function switchMode(mode) {
    rhythmExerciseMode = (mode === 'rhythm');

    if (rhythmExerciseMode) {
      // Show rhythm controls, hide progression controls
      ui.progressionControls.style.display = 'none';
      ui.rhythmControls.style.display = 'block';
      ui.regenerateRests.style.display = 'none';
      ui.showRests.parentElement.style.display = 'none'; // Hide "Show Rests" checkbox
      ui.diceIt.style.display = 'inline-block';
      ui.firstPattern.style.display = 'inline-block';
      ui.prevPattern.style.display = 'inline-block';
      ui.nextPattern.style.display = 'inline-block';
      ui.patternInfo.style.display = 'inline-block';
      ui.resetOriginal.style.display = 'inline-block';
      ui.generate.textContent = 'Generate Phrase';
    } else {
      // Show progression controls, hide rhythm controls
      ui.progressionControls.style.display = 'block';
      ui.rhythmControls.style.display = 'none';
      ui.regenerateRests.style.display = 'inline-block';
      ui.showRests.parentElement.style.display = 'inline-block';
      ui.diceIt.style.display = 'none';
      ui.firstPattern.style.display = 'none';
      ui.prevPattern.style.display = 'none';
      ui.nextPattern.style.display = 'none';
      ui.patternInfo.style.display = 'none';
      ui.resetOriginal.style.display = 'none';
      ui.generate.textContent = 'Generate';
    }
  }

  // Mode toggle listeners
  ui.modeProgression.addEventListener('change', () => {
    if (ui.modeProgression.checked) {
      switchMode('progression');
    }
  });

  ui.modeRhythm.addEventListener('change', () => {
    if (ui.modeRhythm.checked) {
      switchMode('rhythm');
    }
  });

  // Initialize mode
  switchMode('progression');

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

  // Rhythm exercise functions

  /**
   * Generate all possible rest patterns for given number of rests
   * Returns array of arrays, where each inner array contains indices [0-7]
   */
  function generateAllPatterns(numRests) {
    if (numRests === 0) return [[]];
    if (numRests === 8) return [[0,1,2,3,4,5,6,7]];

    const patterns = [];

    // Generate combinations using recursion
    function combine(start, chosen) {
      if (chosen.length === numRests) {
        patterns.push([...chosen]);
        return;
      }

      for (let i = start; i < 8; i++) {
        chosen.push(i);
        combine(i + 1, chosen);
        chosen.pop();
      }
    }

    combine(0, []);
    return patterns;
  }

  /**
   * Apply a specific rest pattern to the original phrase
   * Combines consecutive rests while respecting measure midpoint (beat 2)
   */
  function applyPattern(pattern) {
    if (!originalRhythmPhrase) return null;

    const result = [];
    let i = 0;

    while (i < 8) {
      if (pattern.includes(i)) {
        // This position should be a rest
        // Find consecutive rests
        let consecutiveCount = 1;
        while (i + consecutiveCount < 8 && pattern.includes(i + consecutiveCount)) {
          consecutiveCount++;
        }

        const startBeat = i * 0.5; // Each eighth note is 0.5 beats
        const originalNote = originalRhythmPhrase[i];

        // Check if rests cross midpoint (beat 2 = index 4)
        const startIndex = i;
        const endIndex = i + consecutiveCount - 1;

        // Midpoint is at index 4 (beat 2)
        if (startIndex < 4 && endIndex >= 4) {
          // Rests cross midpoint - split into two rests
          const restsBeforeMidpoint = 4 - startIndex; // Number of eighth rests before midpoint
          const restsAfterMidpoint = endIndex - 3; // Number of eighth rests after midpoint (inclusive)

          // Add rest before midpoint
          result.push({
            startBeat: startBeat,
            durationBeats: restsBeforeMidpoint * 0.5,
            isRest: true,
            device: 'rest',
            chordSymbol: originalNote.chordSymbol,
            rootPc: originalNote.rootPc,
            quality: originalNote.quality,
            scaleName: originalNote.scaleName,
          });

          // Add rest after midpoint
          result.push({
            startBeat: 2, // Midpoint is at beat 2
            durationBeats: restsAfterMidpoint * 0.5,
            isRest: true,
            device: 'rest',
            chordSymbol: originalNote.chordSymbol,
            rootPc: originalNote.rootPc,
            quality: originalNote.quality,
            scaleName: originalNote.scaleName,
          });
        } else {
          // Rests don't cross midpoint - combine into single rest
          result.push({
            startBeat: startBeat,
            durationBeats: consecutiveCount * 0.5,
            isRest: true,
            device: 'rest',
            chordSymbol: originalNote.chordSymbol,
            rootPc: originalNote.rootPc,
            quality: originalNote.quality,
            scaleName: originalNote.scaleName,
          });
        }

        i += consecutiveCount;
      } else {
        // This position is a note
        result.push(originalRhythmPhrase[i]);
        i++;
      }
    }

    return result;
  }

  /**
   * Update pattern info display
   */
  function updatePatternInfo() {
    const numRests = parseInt(ui.numRests.value, 10) || 0;
    if (numRests === 0 || allPatterns.length === 0) {
      ui.patternInfo.textContent = '';
    } else {
      ui.patternInfo.textContent = `${currentPatternIndex + 1}/${allPatterns.length}`;
    }
  }

  function buildRhythmExerciseModel() {
    const chordSymbol = ui.exerciseChord.value || 'Cmaj7';
    const meta = Schema.defaultMetadata();
    meta.tempo = 120;

    const options = {
      scaleStrategy: ui.scaleStrategy.value || 'default',
      deviceStrategy: ui.deviceStrategy.value || 'varied',
    };

    // Generate original phrase (8 eighth notes)
    const phrase = LickGen.generateRhythmExercisePhrase(chordSymbol, options);

    // Store original phrase
    originalRhythmPhrase = phrase;
    currentRhythmPhrase = phrase;

    // Reset pattern state
    allPatterns = [];
    currentPatternIndex = 0;
    updatePatternInfo();

    // Create progression with single measure
    const progression = [{ symbol: chordSymbol, bar: 0, startBeat: 0, durationBeats: 4 }];

    const model = { progression, bars: 1, lick: phrase, metadata: meta };
    lastModel = model;
    return model;
  }

  function diceItPattern() {
    if (!originalRhythmPhrase) {
      setStatus('Generate a phrase first.');
      return;
    }

    const numRests = parseInt(ui.numRests.value, 10) || 0;

    // Generate all patterns if not already done
    if (allPatterns.length === 0 || allPatterns[0].length !== numRests) {
      allPatterns = generateAllPatterns(numRests);
      console.log(`[Rhythm Exercise] Generated ${allPatterns.length} patterns for ${numRests} rests`);
    }

    // Pick random pattern
    currentPatternIndex = Math.floor(Math.random() * allPatterns.length);
    const pattern = allPatterns[currentPatternIndex];

    // Apply pattern
    const phraseWithRests = applyPattern(pattern);
    currentRhythmPhrase = phraseWithRests;

    // Update model
    const chordSymbol = ui.exerciseChord.value || 'Cmaj7';
    const progression = [{ symbol: chordSymbol, bar: 0, startBeat: 0, durationBeats: 4 }];
    const model = { progression, bars: 1, lick: phraseWithRests, metadata: lastModel.metadata };
    lastModel = model;

    updatePatternInfo();
    renderAll(model);
    setStatus(`Pattern ${currentPatternIndex + 1}/${allPatterns.length}`);
  }

  function nextPattern() {
    if (!originalRhythmPhrase || allPatterns.length === 0) {
      setStatus('Generate a phrase and dice it first.');
      return;
    }

    currentPatternIndex = (currentPatternIndex + 1) % allPatterns.length;
    const pattern = allPatterns[currentPatternIndex];

    // Apply pattern
    const phraseWithRests = applyPattern(pattern);
    currentRhythmPhrase = phraseWithRests;

    // Update model
    const chordSymbol = ui.exerciseChord.value || 'Cmaj7';
    const progression = [{ symbol: chordSymbol, bar: 0, startBeat: 0, durationBeats: 4 }];
    const model = { progression, bars: 1, lick: phraseWithRests, metadata: lastModel.metadata };
    lastModel = model;

    updatePatternInfo();
    renderAll(model);
    setStatus(`Pattern ${currentPatternIndex + 1}/${allPatterns.length}`);
  }

  function previousPattern() {
    if (!originalRhythmPhrase || allPatterns.length === 0) {
      setStatus('Generate a phrase and dice it first.');
      return;
    }

    currentPatternIndex = (currentPatternIndex - 1 + allPatterns.length) % allPatterns.length;
    const pattern = allPatterns[currentPatternIndex];

    // Apply pattern
    const phraseWithRests = applyPattern(pattern);
    currentRhythmPhrase = phraseWithRests;

    // Update model
    const chordSymbol = ui.exerciseChord.value || 'Cmaj7';
    const progression = [{ symbol: chordSymbol, bar: 0, startBeat: 0, durationBeats: 4 }];
    const model = { progression, bars: 1, lick: phraseWithRests, metadata: lastModel.metadata };
    lastModel = model;

    updatePatternInfo();
    renderAll(model);
    setStatus(`Pattern ${currentPatternIndex + 1}/${allPatterns.length}`);
  }

  function resetToOriginalPhrase() {
    if (!originalRhythmPhrase) {
      setStatus('Generate a phrase first.');
      return;
    }

    currentRhythmPhrase = originalRhythmPhrase;
    allPatterns = [];
    currentPatternIndex = 0;
    updatePatternInfo();

    const chordSymbol = ui.exerciseChord.value || 'Cmaj7';
    const progression = [{ symbol: chordSymbol, bar: 0, startBeat: 0, durationBeats: 4 }];
    const model = { progression, bars: 1, lick: originalRhythmPhrase, metadata: lastModel.metadata };
    lastModel = model;

    renderAll(model);
    setStatus('Reset to original phrase.');
  }

  function firstPattern() {
    if (!originalRhythmPhrase) {
      setStatus('Generate a phrase first.');
      return;
    }

    const numRests = parseInt(ui.numRests.value, 10) || 0;

    // Generate all patterns if not already done
    if (allPatterns.length === 0 || allPatterns[0].length !== numRests) {
      allPatterns = generateAllPatterns(numRests);
      console.log(`[Rhythm Exercise] Generated ${allPatterns.length} patterns for ${numRests} rests`);
    }

    // Go to first pattern
    currentPatternIndex = 0;
    const pattern = allPatterns[currentPatternIndex];

    // Apply pattern
    const phraseWithRests = applyPattern(pattern);
    currentRhythmPhrase = phraseWithRests;

    // Update model
    const chordSymbol = ui.exerciseChord.value || 'Cmaj7';
    const progression = [{ symbol: chordSymbol, bar: 0, startBeat: 0, durationBeats: 4 }];
    const model = { progression, bars: 1, lick: phraseWithRests, metadata: lastModel.metadata };
    lastModel = model;

    updatePatternInfo();
    renderAll(model);
    setStatus(`Pattern 1/${allPatterns.length}`);
  }

  // Rhythm exercise button listeners
  ui.diceIt.addEventListener('click', diceItPattern);
  ui.firstPattern.addEventListener('click', firstPattern);
  ui.nextPattern.addEventListener('click', nextPattern);
  ui.prevPattern.addEventListener('click', previousPattern);
  ui.resetOriginal.addEventListener('click', resetToOriginalPhrase);

  function buildModel() {
    if (rhythmExerciseMode) {
      return buildRhythmExerciseModel();
    }

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
      insertRests: false  // Always generate without rests first
    };

    // Generate base lick without rests
    const lickWithoutRests = LickGen.generateLick(progression, meta, options);

    // Store the version without rests
    lastModelWithoutRests = { progression, bars, lick: lickWithoutRests, metadata: meta };

    // Reset the rest pattern when generating a new lick
    lastModelWithRests = null;

    // Show the lick without rests by default
    const model = { progression, bars, lick: lickWithoutRests, metadata: meta };
    lastModel = model;
    return model;
  }

  // Apply random rests to a lick (can be toggled on/off)
  function applyRandomRests(lick) {
    if (!lick || lick.length === 0) return lick;

    // Use the generator's insertRandomRests logic
    // We need to call it with the lick data
    const options = { insertRests: true };

    // Clone the lick to avoid modifying the original
    const lickCopy = JSON.parse(JSON.stringify(lick));

    // Call the internal rest insertion function
    // Note: We'll need to expose this from the generator
    if (window.LickGen.insertRandomRests) {
      return window.LickGen.insertRandomRests(lickCopy, options);
    }

    return lickCopy;
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
