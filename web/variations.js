// Variation system for Step 3: Add variation to each measure
// Implements flexible note placement based on chord quality

window.Variations = (function () {

  /**
   * Apply Step 3 variations to measures based on chord quality
   *
   * Rules from Generation-Steps.md Step 3:
   * - Dominant chord doesn't need to land on chord tone
   * - Major 7th chord land on 3, 5, 7 or 9
   * - Replace second strong beat with a different note in a measure
   */
  function applyVariations(measures, options = {}) {
    const { variationLevel = 'medium' } = options; // low, medium, high

    const result = measures.map((measure, idx) => {
      const variations = {
        firstBeatConstraint: 'chord-tone', // default
        firstBeatOptions: null,
        secondBeatFree: false,
      };

      // Analyze chord quality
      const quality = measure.quality;

      // Dominant 7th chords: first beat doesn't need chord tone
      if (quality === '7' || quality === '7#11' || quality === '7b13' ||
          quality === '7b9' || quality === '7#9' || quality === '7alt' ||
          quality === '7#5' || quality === '7#9b13') {

        if (variationLevel === 'high' || (variationLevel === 'medium' && Math.random() < 0.5)) {
          variations.firstBeatConstraint = 'flexible'; // any note from scale
        }
      }

      // Major 7th chords: first beat can be 3, 5, 7, or 9
      if (quality === 'maj7' || quality === 'maj7#11' || quality === 'maj7#5') {
        if (variationLevel === 'high' || (variationLevel === 'medium' && Math.random() < 0.7)) {
          variations.firstBeatConstraint = 'chord-tone-varied';
          variations.firstBeatOptions = [3, 5, 7, 9]; // scale degrees
        }
      }

      // Replace second strong beat (beat 3 / slot 4) with non-chord-tone
      const replaceChance = variationLevel === 'high' ? 0.5 : variationLevel === 'medium' ? 0.3 : 0.1;
      if (Math.random() < replaceChance) {
        variations.secondBeatFree = true;
      }

      return {
        ...measure,
        variations,
      };
    });

    return result;
  }

  /**
   * Get first beat note based on variation constraint
   */
  function getFirstBeatNote(constraint, options, lastMidi) {
    const { chord, scale, rootPc, quality, firstBeatOptions } = options;

    switch (constraint) {
      case 'flexible':
        // Dominant chord: any scale note
        return getScaleNote(rootPc, scale, lastMidi);

      case 'chord-tone-varied':
        // Major7: pick from 3, 5, 7, or 9
        const degrees = firstBeatOptions || [3, 5, 7, 9];
        const degree = degrees[Math.floor(Math.random() * degrees.length)];
        return getChordToneByDegree(rootPc, quality, degree, lastMidi);

      case 'chord-tone':
      default:
        // Standard: any chord tone (1, 3, 5, 7)
        return getChordTone(rootPc, quality, lastMidi);
    }
  }

  /**
   * Get a scale note near lastMidi
   */
  function getScaleNote(rootPc, scaleName, lastMidi) {
    if (!window.Scales) return lastMidi;

    const scalePcs = window.Scales.getScalePitchClasses(rootPc, scaleName);
    const scaleAbs = scalePcs.map(pc => (rootPc + pc) % 12);

    // Build candidates in reasonable range
    const candidates = [];
    for (let octave = -1; octave <= 2; octave++) {
      for (const pc of scaleAbs) {
        const midi = 60 + octave * 12 + pc;
        if (midi >= 55 && midi <= 81) {
          candidates.push(midi);
        }
      }
    }

    // Pick closest to lastMidi
    candidates.sort((a, b) => Math.abs(a - lastMidi) - Math.abs(b - lastMidi));
    return candidates[0] || lastMidi;
  }

  /**
   * Get chord tone near lastMidi (any of 1, 3, 5, 7)
   */
  function getChordTone(rootPc, quality, lastMidi) {
    // Use generator's chord pitch classes
    const chordPcs = window.LickGen ? window.LickGen.chordPitchClasses(rootPc, quality) : [0, 4, 7, 11];
    const chordAbs = chordPcs.map(pc => (rootPc + pc) % 12);

    const candidates = [];
    for (let octave = -1; octave <= 2; octave++) {
      for (const pc of chordAbs) {
        const midi = 60 + octave * 12 + pc;
        if (midi >= 55 && midi <= 81) {
          candidates.push(midi);
        }
      }
    }

    candidates.sort((a, b) => Math.abs(a - lastMidi) - Math.abs(b - lastMidi));
    return candidates[0] || lastMidi;
  }

  /**
   * Get specific chord tone by degree (e.g., 3rd, 5th, 7th, 9th)
   */
  function getChordToneByDegree(rootPc, quality, degree, lastMidi) {
    // Map degree to scale step
    // For major7: 1=root, 3=maj3, 5=P5, 7=maj7, 9=maj9
    const degreeToInterval = {
      1: 0,
      3: 4,
      5: 7,
      7: 11,
      9: 2,  // 9th = major 2nd
      11: 5, // 11th = perfect 4th
      13: 9, // 13th = major 6th
    };

    const interval = degreeToInterval[degree] || 0;
    const targetPc = (rootPc + interval) % 12;

    // Find closest octave
    const candidates = [];
    for (let octave = -1; octave <= 2; octave++) {
      const midi = 60 + octave * 12 + targetPc;
      if (midi >= 55 && midi <= 81) {
        candidates.push(midi);
      }
    }

    candidates.sort((a, b) => Math.abs(a - lastMidi) - Math.abs(b - lastMidi));
    return candidates[0] || lastMidi;
  }

  return {
    applyVariations,
    getFirstBeatNote,
  };
})();
