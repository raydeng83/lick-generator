// Musical devices for improvisation (Step 2: Device Selection)

window.Devices = (function () {
  // ========== DEVICE TYPES ==========

  const DEVICE_TYPES = {
    ARPEGGIO: 'arpeggio',
    SCALE_RUN: 'scale-run',
    NEIGHBOR: 'neighbor',
    ENCLOSURE: 'enclosure',
    MELODIC_CELL: 'melodic-cell',
    CHORD_TONES: 'chord-tones', // Default Rule 1 behavior
  };

  // ========== DEVICE GENERATORS ==========

  /**
   * Generate arpeggio device plan
   * Sequences through chord tones: 1-3-5-7 or variations
   * @param {Object} options - Chord info
   * @returns {Object} Device plan
   */
  function generateArpeggio(options = {}) {
    const patterns = [
      [1, 3, 5, 7],    // ascending
      [7, 5, 3, 1],    // descending
      [1, 3, 5, 3],    // up and back
      [1, 5, 3, 7],    // skip pattern
      [3, 5, 7, 5],    // from 3rd
    ];

    const pattern = patterns[Math.floor(Math.random() * patterns.length)];

    return {
      type: DEVICE_TYPES.ARPEGGIO,
      pattern: pattern,
      name: 'Arpeggio',
      slotsNeeded: pattern.length,
    };
  }

  /**
   * Generate scale run device plan
   * Stepwise motion through scale
   * @param {Object} options - Scale info
   * @returns {Object} Device plan
   */
  function generateScaleRun(options = {}) {
    const { slotsAvailable = 4 } = options;
    const direction = Math.random() < 0.5 ? 'up' : 'down';

    return {
      type: DEVICE_TYPES.SCALE_RUN,
      direction: direction,
      name: direction === 'up' ? 'Scale Ascending' : 'Scale Descending',
      slotsNeeded: Math.min(slotsAvailable, 6),
    };
  }

  /**
   * Generate neighbor tone device plan
   * Target → Neighbor → Target
   * @param {Object} options
   * @returns {Object} Device plan
   */
  function generateNeighbor(options = {}) {
    const neighborType = Math.random() < 0.5 ? 'upper' : 'lower';

    return {
      type: DEVICE_TYPES.NEIGHBOR,
      neighborType: neighborType,
      name: neighborType === 'upper' ? 'Upper Neighbor' : 'Lower Neighbor',
      slotsNeeded: 3, // target, neighbor, target
    };
  }

  /**
   * Generate enclosure device plan
   * Chromatic approach from both sides
   * @param {Object} options
   * @returns {Object} Device plan
   */
  function generateEnclosure(options = {}) {
    const enclosureType = Math.random() < 0.5 ? 'upper-lower' : 'lower-upper';

    return {
      type: DEVICE_TYPES.ENCLOSURE,
      enclosureType: enclosureType,
      name: 'Chromatic Enclosure',
      slotsNeeded: 4, // approaches + target
    };
  }

  /**
   * Generate melodic cell device plan (Rule 5)
   * @param {Object} options
   * @returns {Object} Device plan
   */
  function generateMelodicCell(options = {}) {
    const cell = window.MelodicCells ? window.MelodicCells.getRandomCell() : null;

    if (!cell) {
      // Fallback if MelodicCells not loaded
      return generateScaleRun(options);
    }

    return {
      type: DEVICE_TYPES.MELODIC_CELL,
      cellName: cell.name,
      cellDegrees: cell.degrees,
      name: `Cell: ${cell.name}`,
      slotsNeeded: cell.degrees.length,
    };
  }

  // ========== DEVICE SELECTION ==========

  /**
   * Select device for a measure or half-measure
   * @param {Object} context - Musical context (chord, scale, position)
   * @param {Object} options - User preferences
   * @returns {Object} Selected device plan
   */
  function selectDevice(context, options = {}) {
    const { slotsAvailable = 8, deviceStrategy = 'varied' } = options;

    // Build available devices based on slots
    const availableDevices = [];

    if (slotsAvailable >= 4) {
      availableDevices.push('arpeggio', 'melodic-cell', 'scale-run');
    }
    if (slotsAvailable >= 3) {
      availableDevices.push('neighbor');
    }
    if (slotsAvailable >= 4) {
      availableDevices.push('enclosure');
    }
    availableDevices.push('chord-tones'); // Always available

    // Select based on strategy
    let deviceType;
    switch (deviceStrategy) {
      case 'arpeggio-focused':
        deviceType = 'arpeggio';
        break;
      case 'cell-focused':
        deviceType = 'melodic-cell';
        break;
      case 'scale-focused':
        deviceType = 'scale-run';
        break;
      case 'neighbor-enclosure':
        // Focus on neighbor and enclosure devices
        const neighborEnclosureDevices = availableDevices.filter(d => d === 'neighbor' || d === 'enclosure');
        if (neighborEnclosureDevices.length > 0) {
          deviceType = neighborEnclosureDevices[Math.floor(Math.random() * neighborEnclosureDevices.length)];
        } else {
          deviceType = 'chord-tones'; // Fallback
        }
        break;
      case 'varied':
      default:
        // Random selection with weights
        const weights = {
          'arpeggio': 2,
          'scale-run': 2,
          'melodic-cell': 3,
          'neighbor': 1,
          'enclosure': 1,
          'chord-tones': 1,
        };
        deviceType = weightedRandom(availableDevices, weights);
        break;
    }

    // Generate device plan
    switch (deviceType) {
      case 'arpeggio':
        return generateArpeggio(options);
      case 'scale-run':
        return generateScaleRun({ ...options, slotsAvailable });
      case 'neighbor':
        return generateNeighbor(options);
      case 'enclosure':
        return generateEnclosure(options);
      case 'melodic-cell':
        return generateMelodicCell(options);
      case 'chord-tones':
      default:
        return {
          type: DEVICE_TYPES.CHORD_TONES,
          name: 'Chord Tones',
          slotsNeeded: slotsAvailable,
        };
    }
  }

  function weightedRandom(items, weights) {
    const weightedItems = [];
    for (const item of items) {
      const weight = weights[item] || 1;
      for (let i = 0; i < weight; i++) {
        weightedItems.push(item);
      }
    }
    return weightedItems[Math.floor(Math.random() * weightedItems.length)];
  }

  /**
   * Check if device can fit in available slots
   * @param {Object} device - Device plan
   * @param {number} slotsAvailable
   * @returns {boolean}
   */
  function deviceFits(device, slotsAvailable) {
    return device.slotsNeeded <= slotsAvailable;
  }

  // ========== PUBLIC API ==========

  return {
    // Constants
    DEVICE_TYPES,

    // Generators
    generateArpeggio,
    generateScaleRun,
    generateNeighbor,
    generateEnclosure,
    generateMelodicCell,

    // Selection
    selectDevice,
    deviceFits,
  };
})();
