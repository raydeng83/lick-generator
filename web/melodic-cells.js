// Melodic cell patterns (Rule 5) - four-note groupings for structured melody

window.MelodicCells = (function () {
  // ========== MELODIC CELL DEFINITIONS ==========
  // Each cell is defined as scale degrees (1-based, relative to scale)

  const CELLS = {
    // Ascending cells starting from lower register
    'ascending-1235': { degrees: [1, 2, 3, 5], name: '1-2-3-5 Ascending' },
    'ascending-1345': { degrees: [1, 3, 4, 5], name: '1-3-4-5 Ascending' },

    // Upper structure cells (starting from 5th)
    'upper-5679': { degrees: [5, 6, 7, 9], name: '5-6-7-9 Upper' },
    'upper-5789': { degrees: [5, 7, 8, 9], name: '5-7-8-9 Upper' },

    // Descending variations
    'descending-5321': { degrees: [5, 3, 2, 1], name: '5-3-2-1 Descending' },
    'descending-5431': { degrees: [5, 4, 3, 1], name: '5-4-3-1 Descending' },

    // Mixed direction (creates melodic interest)
    'arch-1351': { degrees: [1, 3, 5, 1], name: '1-3-5-1 Arch' },
    'valley-5135': { degrees: [5, 1, 3, 5], name: '5-1-3-5 Valley' },
  };

  // ========== CELL UTILITIES ==========

  /**
   * Get all available cell patterns
   * @returns {Object} Cell definitions
   */
  function getAllCells() {
    return CELLS;
  }

  /**
   * Get a specific cell pattern
   * @param {string} cellName - Name of the cell
   * @returns {Object|null} Cell definition or null
   */
  function getCell(cellName) {
    return CELLS[cellName] || null;
  }

  /**
   * Get random cell pattern
   * @returns {Object} Cell definition with name
   */
  function getRandomCell() {
    const cellNames = Object.keys(CELLS);
    const randomName = cellNames[Math.floor(Math.random() * cellNames.length)];
    return { name: randomName, ...CELLS[randomName] };
  }

  /**
   * Resolve cell degrees to MIDI pitches using a scale
   * @param {number[]} degrees - Scale degrees (1-9)
   * @param {number} rootPc - Root pitch class
   * @param {number[]} scalePcs - Scale pitch classes (intervals from root)
   * @param {number} startMidi - Starting MIDI pitch for reference
   * @returns {number[]} Array of MIDI pitches
   */
  function resolveCellToMidi(degrees, rootPc, scalePcs, startMidi) {
    const result = [];
    let lastMidi = startMidi;

    for (const degree of degrees) {
      const midi = degreeToMidi(degree, rootPc, scalePcs, lastMidi);
      result.push(midi);
      lastMidi = midi;
    }

    return result;
  }

  /**
   * Convert scale degree to MIDI pitch
   * @param {number} degree - Scale degree (1-9)
   * @param {number} rootPc - Root pitch class
   * @param {number[]} scalePcs - Scale pitch classes
   * @param {number} nearMidi - Reference MIDI for octave selection
   * @returns {number} MIDI pitch
   */
  function degreeToMidi(degree, rootPc, scalePcs, nearMidi) {
    // Map degree to scale index (1-based to 0-based)
    // Degree 1-7 map to scale positions 0-6
    // Degree 8-9 are next octave positions (wrap around)

    let scaleIndex = (degree - 1) % scalePcs.length;
    let octaveOffset = Math.floor((degree - 1) / scalePcs.length);

    const pc = (rootPc + scalePcs[scaleIndex]) % 12;

    // Find MIDI near reference pitch
    const candidates = [
      pcToMidiNear(pc, nearMidi) + (octaveOffset * 12),
      pcToMidiNear(pc, nearMidi + 12) + (octaveOffset * 12),
      pcToMidiNear(pc, nearMidi - 12) + (octaveOffset * 12),
    ];

    // Pick closest to reference
    candidates.sort((a, b) => Math.abs(a - nearMidi) - Math.abs(b - nearMidi));
    return clampRange(candidates[0]);
  }

  function pcToMidiNear(pc, nearMidi) {
    if (nearMidi == null) return 60 + pc;
    const base = Math.round(nearMidi / 12) * 12;
    const candidates = [base - 12 + pc, base + pc, base + 12 + pc];
    candidates.sort((a, b) => Math.abs(a - nearMidi) - Math.abs(b - nearMidi));
    return candidates[0];
  }

  function clampRange(midi, lo = 55, hi = 81) {
    while (midi < lo) midi += 12;
    while (midi > hi) midi -= 12;
    return midi;
  }

  /**
   * Check if a cell fits in available slots
   * @param {number} slotsAvailable - Number of eighth-note slots
   * @returns {boolean}
   */
  function cellFits(slotsAvailable) {
    return slotsAvailable >= 4; // Cells need 4 slots minimum
  }

  /**
   * Get cell categories for selection
   * @returns {Object} Categories with cell names
   */
  function getCellCategories() {
    return {
      ascending: ['ascending-1235', 'ascending-1345'],
      descending: ['descending-5321', 'descending-5431'],
      upper: ['upper-5679', 'upper-5789'],
      mixed: ['arch-1351', 'valley-5135'],
    };
  }

  // ========== PUBLIC API ==========

  return {
    // Data
    CELLS,

    // Utilities
    getAllCells,
    getCell,
    getRandomCell,
    resolveCellToMidi,
    degreeToMidi,
    cellFits,
    getCellCategories,
  };
})();
