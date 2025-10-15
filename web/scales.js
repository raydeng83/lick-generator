// Comprehensive scale definitions for jazz improvisation
// Based on Rules.md - mapping chord types to appropriate scales

window.Scales = (function () {
  // ========== SCALE DEFINITIONS (interval patterns from root) ==========

  const SCALES = {
    // Major family scales
    'ionian': [0, 2, 4, 5, 7, 9, 11],              // Major scale
    'lydian': [0, 2, 4, 6, 7, 9, 11],              // Major with #11
    'lydian-augmented': [0, 2, 4, 6, 8, 9, 11],    // Lydian with #5

    // Dominant family scales
    'mixolydian': [0, 2, 4, 5, 7, 9, 10],          // Dominant scale
    'lydian-dominant': [0, 2, 4, 6, 7, 9, 10],     // Mixolydian with #11
    'altered': [0, 1, 3, 4, 6, 8, 10],             // Altered dominant (super locrian)
    'mixolydian-b6': [0, 2, 4, 5, 7, 8, 10],       // Mixolydian b13
    'whole-tone': [0, 2, 4, 6, 8, 10],             // Whole tone (6 notes)
    'phrygian-dominant': [0, 1, 4, 5, 7, 8, 10],   // Spanish Phrygian / 5th mode harmonic minor
    'half-whole-diminished': [0, 1, 3, 4, 6, 7, 9, 10], // For 7b9, 7#9 chords (8 notes)

    // Minor family scales
    'dorian': [0, 2, 3, 5, 7, 9, 10],              // Minor with natural 6
    'aeolian': [0, 2, 3, 5, 7, 8, 10],             // Natural minor
    'phrygian': [0, 1, 3, 5, 7, 8, 10],            // Minor with b2
    'melodic-minor': [0, 2, 3, 5, 7, 9, 11],       // Jazz melodic minor
    'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],      // Harmonic minor
    'dorian-b2': [0, 1, 3, 5, 7, 9, 10],           // Phrygian #6

    // Half-diminished scales
    'locrian': [0, 1, 3, 5, 6, 8, 10],             // m7b5 scale
    'locrian-natural-2': [0, 2, 3, 5, 6, 8, 10],   // Locrian with natural 2

    // Diminished scales
    'whole-half-diminished': [0, 2, 3, 5, 6, 8, 9, 11], // For dim7 chords (8 notes)
  };

  // ========== SCALE FAMILIES (Rule 3) ==========

  const SCALE_FAMILIES = {
    major: ['ionian', 'lydian'],
    dominant: [
      'mixolydian',
      'lydian-dominant',
      'altered',
      'mixolydian-b6',
      'whole-tone',
      'phrygian-dominant',
      'half-whole-diminished'
    ],
    minor: [
      'dorian',
      'aeolian',
      'phrygian',
      'melodic-minor',
      'harmonic-minor'
    ],
    diminished: [
      'locrian',
      'locrian-natural-2',
      'whole-half-diminished'
    ],
  };

  // ========== CHORD-TO-SCALE MAPPING (Rule 2) ==========
  // Maps chord symbols (with extensions) to appropriate scales
  // First scale in array is the default/most common choice

  const CHORD_SCALE_MAP = {
    // Major 7th chords
    'maj7': ['ionian', 'lydian'],
    'maj7#11': ['lydian'],
    'maj7#5': ['lydian-augmented'],

    // Dominant 7th chords (basic)
    '7': ['mixolydian'],

    // Dominant 7th with alterations
    '7#11': ['lydian-dominant'],
    '7b13': ['mixolydian-b6'],
    '7#5': ['whole-tone'],
    '7b9': ['phrygian-dominant', 'half-whole-diminished'],
    '7#9': ['half-whole-diminished'],
    '7#9b13': ['altered'],
    '7alt': ['altered'],
    '7sus4b9': ['dorian-b2'],

    // Minor 7th chords
    'm7': ['dorian', 'aeolian', 'phrygian'],
    'mMaj7': ['melodic-minor'],
    'm7b6': ['aeolian'],

    // Half-diminished
    'm7b5': ['locrian', 'locrian-natural-2'],

    // Diminished
    'dim7': ['whole-half-diminished'],

    // Sus chords
    'sus4b9': ['phrygian'],
  };

  // ========== SCALE LOOKUP UTILITIES ==========

  /**
   * Get scale intervals for a given scale name
   * @param {string} scaleName - Name of the scale (e.g., 'dorian')
   * @returns {number[]} Array of intervals from root
   */
  function getScaleIntervals(scaleName) {
    return SCALES[scaleName] || SCALES['ionian']; // fallback to major
  }

  /**
   * Get pitch classes for a scale rooted at a specific pitch class
   * @param {number} rootPc - Root pitch class (0-11)
   * @param {string} scaleName - Name of the scale
   * @returns {number[]} Array of absolute pitch classes
   */
  function getScalePitchClasses(rootPc, scaleName) {
    const intervals = getScaleIntervals(scaleName);
    return intervals.map(interval => (rootPc + interval) % 12);
  }

  /**
   * Get available scales for a chord quality
   * @param {string} chordQuality - Chord quality (e.g., 'm7', '7', 'maj7')
   * @returns {string[]} Array of scale names
   */
  function getScalesForChord(chordQuality) {
    return CHORD_SCALE_MAP[chordQuality] || ['ionian'];
  }

  /**
   * Select a scale for a chord using a strategy
   * @param {string} chordQuality - Chord quality
   * @param {string} strategy - Selection strategy: 'default', 'varied', 'exotic', 'per-family-varied'
   * @returns {string} Selected scale name
   */
  function selectScale(chordQuality, strategy = 'default') {
    const availableScales = getScalesForChord(chordQuality);

    switch (strategy) {
      case 'default':
        // Always use first (most common) scale
        return availableScales[0];

      case 'varied':
        // Randomly choose from all available scales
        return availableScales[Math.floor(Math.random() * availableScales.length)];

      case 'exotic':
        // Prefer later scales in the list (more exotic choices)
        const exoticIndex = Math.floor(availableScales.length / 2);
        const exoticScales = availableScales.slice(exoticIndex);
        return exoticScales[Math.floor(Math.random() * exoticScales.length)];

      case 'per-family-varied':
        // Rule 3: Randomly choose from scales within the chord's family
        // For minor chords, use any minor family scale
        // For dominant chords, use any dominant family scale
        // For major chords, use any major family scale
        const family = getChordFamily(chordQuality);
        const familyScales = SCALE_FAMILIES[family];

        if (familyScales && familyScales.length > 0) {
          // Pick random scale from family
          return familyScales[Math.floor(Math.random() * familyScales.length)];
        }

        // Fallback to available scales for this specific chord
        return availableScales[Math.floor(Math.random() * availableScales.length)];

      default:
        return availableScales[0];
    }
  }

  /**
   * Get the family for a given scale
   * @param {string} scaleName - Name of the scale
   * @returns {string|null} Family name or null if not found
   */
  function getScaleFamily(scaleName) {
    for (const [family, scales] of Object.entries(SCALE_FAMILIES)) {
      if (scales.includes(scaleName)) {
        return family;
      }
    }
    return null;
  }

  /**
   * Get the family for a given chord quality (Rule 3)
   * Maps chord qualities to their scale families
   * @param {string} chordQuality - Chord quality (e.g., 'm7', '7', 'maj7')
   * @returns {string|null} Family name ('minor', 'dominant', 'major', 'diminished') or null
   */
  function getChordFamily(chordQuality) {
    // Major 7th chords -> major family
    if (['maj7', 'maj7#11', 'maj7#5'].includes(chordQuality)) {
      return 'major';
    }

    // Dominant 7th chords -> dominant family
    if (['7', '7#11', '7b13', '7#5', '7b9', '7#9', '7#9b13', '7alt', '7sus4b9'].includes(chordQuality)) {
      return 'dominant';
    }

    // Minor 7th chords -> minor family
    if (['m7', 'mMaj7', 'm7b6'].includes(chordQuality)) {
      return 'minor';
    }

    // Half-diminished and diminished -> diminished family
    if (['m7b5', 'dim7'].includes(chordQuality)) {
      return 'diminished';
    }

    // Sus chords -> minor family (phrygian)
    if (['sus4b9'].includes(chordQuality)) {
      return 'minor';
    }

    // Default fallback
    return 'major';
  }

  /**
   * Get human-readable name for a scale
   * @param {string} scaleName - Internal scale name
   * @returns {string} Display name
   */
  function getScaleDisplayName(scaleName) {
    const displayNames = {
      'ionian': 'Ionian (Major)',
      'lydian': 'Lydian',
      'lydian-augmented': 'Lydian Augmented',
      'mixolydian': 'Mixolydian',
      'lydian-dominant': 'Lydian Dominant',
      'altered': 'Altered',
      'mixolydian-b6': 'Mixolydian ♭6',
      'whole-tone': 'Whole Tone',
      'phrygian-dominant': 'Phrygian Dominant',
      'half-whole-diminished': 'Half-Whole Diminished',
      'dorian': 'Dorian',
      'aeolian': 'Aeolian (Natural Minor)',
      'phrygian': 'Phrygian',
      'melodic-minor': 'Melodic Minor',
      'harmonic-minor': 'Harmonic Minor',
      'dorian-b2': 'Dorian ♭2',
      'locrian': 'Locrian',
      'locrian-natural-2': 'Locrian ♮2',
      'whole-half-diminished': 'Whole-Half Diminished',
    };
    return displayNames[scaleName] || scaleName;
  }

  // ========== PUBLIC API ==========

  return {
    // Data
    SCALES,
    SCALE_FAMILIES,
    CHORD_SCALE_MAP,

    // Utilities
    getScaleIntervals,
    getScalePitchClasses,
    getScalesForChord,
    selectScale,
    getScaleFamily,
    getChordFamily,
    getScaleDisplayName,
  };
})();
