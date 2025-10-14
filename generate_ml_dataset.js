/**
 * ML Dataset Generator for Jazz Licks
 *
 * Generates a large dataset of ii-V-I licks with varied parameters
 * and exports in multiple ML-ready formats:
 *
 * 1. Tokenized sequences (for transformer/RNN training)
 * 2. Feature vectors (for classification/regression)
 * 3. CSV format (for pandas/sklearn)
 * 4. JSON format (for custom pipelines)
 */

const fs = require('fs');

// Load dependencies
global.window = {};
eval(fs.readFileSync('./web/scales.js', 'utf8'));
eval(fs.readFileSync('./web/devices-new.js', 'utf8'));
eval(fs.readFileSync('./web/generator.js', 'utf8'));

// ========== CONFIGURATION ==========

const CONFIG = {
  // Dataset size
  numSamples: 1000,  // Number of licks to generate

  // Output files
  outputDir: './ml_dataset',

  // Variation parameters
  keys: ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Db', 'Eb', 'Gb', 'Ab', 'Bb'],
  progressionTypes: ['ii-V-I', 'ii-V', 'V-I', 'I-vi-ii-V'],
  deviceStrategies: ['varied', 'arpeggio-heavy', 'enclosure-heavy'],
  swingRatios: [0, 0.3, 0.5, 0.7],

  // Tokenization
  vocabularySize: 128,  // MIDI range 0-127
  maxSequenceLength: 64,  // Max notes per lick
};

// ========== PROGRESSION TEMPLATES ==========

const PROGRESSION_TEMPLATES = {
  'ii-V-I': (key) => [
    { symbol: `${key}m7`, bar: 0, startBeat: 0, durationBeats: 4 },
    { symbol: `${transposeNote(key, 7)}7`, bar: 1, startBeat: 4, durationBeats: 4 },
    { symbol: `${key}maj7`, bar: 2, startBeat: 8, durationBeats: 4 },
  ],
  'ii-V': (key) => [
    { symbol: `${key}m7`, bar: 0, startBeat: 0, durationBeats: 4 },
    { symbol: `${transposeNote(key, 7)}7`, bar: 1, startBeat: 4, durationBeats: 4 },
  ],
  'V-I': (key) => [
    { symbol: `${key}7`, bar: 0, startBeat: 0, durationBeats: 4 },
    { symbol: `${transposeNote(key, 7)}maj7`, bar: 1, startBeat: 4, durationBeats: 4 },
  ],
  'I-vi-ii-V': (key) => [
    { symbol: `${key}maj7`, bar: 0, startBeat: 0, durationBeats: 4 },
    { symbol: `${transposeNote(key, 9)}m7`, bar: 1, startBeat: 4, durationBeats: 4 },
    { symbol: `${transposeNote(key, 2)}m7`, bar: 2, startBeat: 8, durationBeats: 4 },
    { symbol: `${transposeNote(key, 7)}7`, bar: 3, startBeat: 12, durationBeats: 4 },
  ],
};

// ========== HELPER FUNCTIONS ==========

function transposeNote(note, semitones) {
  const notes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const noteMap = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
    'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
  };

  const idx = noteMap[note];
  const newIdx = (idx + semitones) % 12;
  return notes[newIdx];
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ========== TOKENIZATION ==========

/**
 * Convert lick notes to token sequence
 * Token format: [MIDI_NOTE, DURATION, VELOCITY, FUNCTION, DEVICE]
 */
function tokenizeLick(notes) {
  const tokens = [];

  for (const note of notes) {
    const token = {
      // Core features
      midi: note.midi,
      duration: Math.round(note.durationBeats * 2), // Convert to 16th notes
      velocity: Math.round(note.velocity * 127),

      // Musical features
      degree: note.degree || 'X',
      harmonicFunction: note.harmonicFunction || 'unknown',
      device: note.device || 'none',

      // Chord context
      chordRoot: note.rootPc,
      chordQuality: note.quality,
      scale: note.scaleName,
    };

    tokens.push(token);
  }

  return tokens;
}

/**
 * Convert tokens to simple MIDI sequence (for basic models)
 */
function tokensToMidiSequence(tokens) {
  return tokens.map(t => t.midi);
}

/**
 * Convert tokens to interval sequence (pitch-invariant representation)
 */
function tokensToIntervalSequence(tokens) {
  if (tokens.length === 0) return [];

  const intervals = [0]; // First note is reference
  for (let i = 1; i < tokens.length; i++) {
    intervals.push(tokens[i].midi - tokens[i - 1].midi);
  }
  return intervals;
}

/**
 * Convert tokens to scale degree sequence
 */
function tokensToScaleDegreeSequence(tokens) {
  return tokens.map(t => {
    const degree = t.degree;
    // Map degree to number (1-7 for diatonic, + for chromatic)
    if (!degree || degree === 'X') return 0;
    if (degree === '1') return 1;
    if (degree === '2' || degree === '9') return 2;
    if (degree === 'b3') return 3;
    if (degree === '3') return 3;
    if (degree === '4' || degree === '11') return 4;
    if (degree === 'b5' || degree === '#11') return 5;
    if (degree === '5') return 5;
    if (degree === '13') return 6;
    if (degree === 'b7') return 7;
    if (degree === '7') return 7;
    return 0; // chromatic
  });
}

/**
 * Extract feature vector for each note (for supervised learning)
 */
function extractFeatureVectors(tokens) {
  const features = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const prevToken = i > 0 ? tokens[i - 1] : null;
    const nextToken = i < tokens.length - 1 ? tokens[i + 1] : null;

    const featureVector = {
      // Note properties
      midi: token.midi,
      duration: token.duration,
      velocity: token.velocity,

      // Position
      position: i,
      beatPosition: i % 8, // Position within measure (assuming 8 notes/measure)
      isDownbeat: i % 8 === 0,

      // Intervals
      prevInterval: prevToken ? token.midi - prevToken.midi : 0,
      nextInterval: nextToken ? nextToken.midi - token.midi : 0,

      // Chord context (one-hot encoded)
      chordRoot: token.chordRoot,
      isMinor: token.chordQuality.includes('m'),
      isDominant: token.chordQuality.includes('7') && !token.chordQuality.includes('maj'),
      isMajor: token.chordQuality.includes('maj'),

      // Harmonic function (one-hot encoded)
      isChordTone: token.harmonicFunction === 'chord-tone',
      isScaleStep: token.harmonicFunction === 'scale-step',
      isChromatic: token.harmonicFunction === 'chromatic',

      // Device type (one-hot encoded)
      deviceArpeggio: token.device.includes('arpeggio'),
      deviceEnclosure: token.device.includes('enclosure'),
      deviceNeighbor: token.device.includes('neighbor'),
      deviceApproach: token.device.includes('approach'),

      // Target label (for supervised learning)
      label: token.harmonicFunction,
    };

    features.push(featureVector);
  }

  return features;
}

// ========== DATASET STATISTICS ==========

function calculateStats(licks) {
  const stats = {
    totalLicks: licks.length,
    totalNotes: 0,
    avgNotesPerLick: 0,
    avgDuration: 0,

    // Pitch stats
    pitchRange: { min: 127, max: 0 },
    avgPitch: 0,

    // Interval stats
    intervals: {},

    // Device distribution
    devices: {},

    // Harmonic function distribution
    functions: {},

    // Chord progression distribution
    progressions: {},
  };

  let totalNotes = 0;
  let totalPitch = 0;

  for (const lick of licks) {
    totalNotes += lick.notes.length;
    stats.progressions[lick.metadata.progressionType] =
      (stats.progressions[lick.metadata.progressionType] || 0) + 1;

    for (let i = 0; i < lick.notes.length; i++) {
      const note = lick.notes[i];

      // Pitch stats
      totalPitch += note.midi;
      stats.pitchRange.min = Math.min(stats.pitchRange.min, note.midi);
      stats.pitchRange.max = Math.max(stats.pitchRange.max, note.midi);

      // Interval stats
      if (i > 0) {
        const interval = note.midi - lick.notes[i - 1].midi;
        stats.intervals[interval] = (stats.intervals[interval] || 0) + 1;
      }

      // Device stats
      const device = note.device || 'none';
      stats.devices[device] = (stats.devices[device] || 0) + 1;

      // Function stats
      const func = note.harmonicFunction || 'unknown';
      stats.functions[func] = (stats.functions[func] || 0) + 1;
    }
  }

  stats.totalNotes = totalNotes;
  stats.avgNotesPerLick = totalNotes / licks.length;
  stats.avgPitch = totalPitch / totalNotes;

  return stats;
}

// ========== GENERATION ==========

function generateDataset() {
  console.log('🎵 Generating ML Dataset for Jazz Licks');
  console.log(`Target: ${CONFIG.numSamples} samples`);
  console.log('');

  const dataset = [];
  const progressBar = 50;

  for (let i = 0; i < CONFIG.numSamples; i++) {
    // Random parameters
    const key = randomChoice(CONFIG.keys);
    const progressionType = randomChoice(CONFIG.progressionTypes);
    const deviceStrategy = randomChoice(CONFIG.deviceStrategies);
    const swing = randomChoice(CONFIG.swingRatios);

    // Generate progression
    const progression = PROGRESSION_TEMPLATES[progressionType](key);

    // Generate lick
    const notes = window.LickGen.generateLick(
      progression,
      { title: `Lick ${i}`, key, progressionType },
      { deviceStrategy, swing }
    );

    // Tokenize
    const tokens = tokenizeLick(notes);
    const midiSeq = tokensToMidiSequence(tokens);
    const intervalSeq = tokensToIntervalSequence(tokens);
    const degreeSeq = tokensToScaleDegreeSequence(tokens);
    const features = extractFeatureVectors(tokens);

    // Store
    dataset.push({
      id: i,
      metadata: {
        key,
        progressionType,
        deviceStrategy,
        swing,
        numNotes: notes.length,
        duration: notes[notes.length - 1].startBeat + notes[notes.length - 1].durationBeats,
      },
      notes,
      tokens,
      sequences: {
        midi: midiSeq,
        intervals: intervalSeq,
        degrees: degreeSeq,
      },
      features,
    });

    // Progress bar
    if ((i + 1) % Math.ceil(CONFIG.numSamples / progressBar) === 0) {
      const percent = Math.round(((i + 1) / CONFIG.numSamples) * 100);
      const filled = Math.round((percent / 100) * progressBar);
      const bar = '█'.repeat(filled) + '░'.repeat(progressBar - filled);
      process.stdout.write(`\r[${bar}] ${percent}% (${i + 1}/${CONFIG.numSamples})`);
    }
  }

  console.log('\n');
  return dataset;
}

// ========== EXPORT ==========

function exportDataset(dataset) {
  console.log('💾 Exporting dataset...');

  // Create output directory
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // 1. Full dataset (JSON)
  fs.writeFileSync(
    `${CONFIG.outputDir}/full_dataset.json`,
    JSON.stringify(dataset, null, 2)
  );
  console.log(`✓ Exported full_dataset.json (${dataset.length} samples)`);

  // 2. MIDI sequences only (for simple models)
  const midiSequences = dataset.map(d => ({
    id: d.id,
    metadata: d.metadata,
    sequence: d.sequences.midi,
  }));
  fs.writeFileSync(
    `${CONFIG.outputDir}/midi_sequences.json`,
    JSON.stringify(midiSequences, null, 2)
  );
  console.log(`✓ Exported midi_sequences.json`);

  // 3. Interval sequences (pitch-invariant)
  const intervalSequences = dataset.map(d => ({
    id: d.id,
    metadata: d.metadata,
    sequence: d.sequences.intervals,
  }));
  fs.writeFileSync(
    `${CONFIG.outputDir}/interval_sequences.json`,
    JSON.stringify(intervalSequences, null, 2)
  );
  console.log(`✓ Exported interval_sequences.json`);

  // 4. Feature vectors (CSV for sklearn/pandas)
  const csvLines = ['id,lick_id,position,midi,duration,velocity,prev_interval,next_interval,chord_root,is_minor,is_dominant,is_major,is_chord_tone,is_scale_step,is_chromatic,device_arpeggio,device_enclosure,device_neighbor,device_approach,label'];

  for (const lick of dataset) {
    for (let i = 0; i < lick.features.length; i++) {
      const f = lick.features[i];
      csvLines.push([
        `${lick.id}_${i}`,
        lick.id,
        f.position,
        f.midi,
        f.duration,
        f.velocity,
        f.prevInterval,
        f.nextInterval,
        f.chordRoot,
        f.isMinor ? 1 : 0,
        f.isDominant ? 1 : 0,
        f.isMajor ? 1 : 0,
        f.isChordTone ? 1 : 0,
        f.isScaleStep ? 1 : 0,
        f.isChromatic ? 1 : 0,
        f.deviceArpeggio ? 1 : 0,
        f.deviceEnclosure ? 1 : 0,
        f.deviceNeighbor ? 1 : 0,
        f.deviceApproach ? 1 : 0,
        f.label,
      ].join(','));
    }
  }

  fs.writeFileSync(
    `${CONFIG.outputDir}/features.csv`,
    csvLines.join('\n')
  );
  console.log(`✓ Exported features.csv (${csvLines.length - 1} rows)`);

  // 5. Metadata summary
  const stats = calculateStats(dataset);
  fs.writeFileSync(
    `${CONFIG.outputDir}/dataset_stats.json`,
    JSON.stringify(stats, null, 2)
  );
  console.log(`✓ Exported dataset_stats.json`);

  // 6. Vocabulary (for tokenizer)
  const vocabulary = {
    midiRange: { min: stats.pitchRange.min, max: stats.pitchRange.max },
    devices: Object.keys(stats.devices),
    functions: Object.keys(stats.functions),
    progressions: Object.keys(stats.progressions),
  };
  fs.writeFileSync(
    `${CONFIG.outputDir}/vocabulary.json`,
    JSON.stringify(vocabulary, null, 2)
  );
  console.log(`✓ Exported vocabulary.json`);

  // 7. Train/validation/test split (80/10/10)
  const shuffled = [...dataset].sort(() => Math.random() - 0.5);
  const trainSize = Math.floor(dataset.length * 0.8);
  const valSize = Math.floor(dataset.length * 0.1);

  const splits = {
    train: shuffled.slice(0, trainSize).map(d => d.id),
    validation: shuffled.slice(trainSize, trainSize + valSize).map(d => d.id),
    test: shuffled.slice(trainSize + valSize).map(d => d.id),
  };

  fs.writeFileSync(
    `${CONFIG.outputDir}/splits.json`,
    JSON.stringify(splits, null, 2)
  );
  console.log(`✓ Exported splits.json (train: ${splits.train.length}, val: ${splits.validation.length}, test: ${splits.test.length})`);

  console.log('');
  console.log('📊 Dataset Statistics:');
  console.log(`   Total licks: ${stats.totalLicks}`);
  console.log(`   Total notes: ${stats.totalNotes}`);
  console.log(`   Avg notes/lick: ${stats.avgNotesPerLick.toFixed(1)}`);
  console.log(`   Pitch range: ${stats.pitchRange.min}-${stats.pitchRange.max}`);
  console.log(`   Avg pitch: ${stats.avgPitch.toFixed(1)}`);
  console.log('');
  console.log('✅ Dataset generation complete!');
  console.log(`📁 Output directory: ${CONFIG.outputDir}`);
}

// ========== README GENERATOR ==========

function generateReadme() {
  const readme = [
    '# Jazz Licks ML Dataset',
    '',
    '## Overview',
    '',
    `This dataset contains ${CONFIG.numSamples} automatically generated jazz licks for training machine learning models.`,
    '',
    '## Dataset Files',
    '',
    '- `full_dataset.json` - Complete dataset with all features and metadata',
    '- `midi_sequences.json` - Simple MIDI note sequences',
    '- `interval_sequences.json` - Pitch-invariant interval sequences',
    '- `features.csv` - Feature vectors for supervised learning (pandas/sklearn compatible)',
    '- `dataset_stats.json` - Statistical summary of the dataset',
    '- `vocabulary.json` - Vocabulary for tokenization',
    '- `splits.json` - Train/validation/test split indices (80/10/10)',
    '',
    '## Data Format',
    '',
    '### MIDI Sequences',
    '```json',
    '{',
    '  "id": 0,',
    '  "metadata": {',
    '    "key": "C",',
    '    "progressionType": "ii-V-I",',
    '    "deviceStrategy": "varied",',
    '    "swing": 0.5',
    '  },',
    '  "sequence": [62, 64, 67, 65, ...]',
    '}',
    '```',
    '',
    '### Interval Sequences (Pitch-Invariant)',
    '```json',
    '{',
    '  "id": 0,',
    '  "metadata": {...},',
    '  "sequence": [0, 2, 3, -2, 4, -1, ...]',
    '}',
    '```',
    '',
    '### Feature Vectors (CSV)',
    'Each row represents one note with these features:',
    '- Position features: position, beat_position, is_downbeat',
    '- Pitch features: midi, prev_interval, next_interval',
    '- Harmonic features: chord_root, is_chord_tone, is_scale_step, is_chromatic',
    '- Device features: device_arpeggio, device_enclosure, device_neighbor, device_approach',
    '- Label: harmonic_function',
    '',
    '## Usage Examples',
    '',
    '### Load with Python (PyTorch)',
    '```python',
    'import json',
    'import torch',
    'from torch.utils.data import Dataset',
    '',
    'class JazzLickDataset(Dataset):',
    '    def __init__(self, data_path, splits_path, split="train"):',
    '        with open(data_path) as f:',
    '            self.data = json.load(f)',
    '        with open(splits_path) as f:',
    '            self.split_ids = json.load(f)[split]',
    '        self.samples = [d for d in self.data if d["id"] in self.split_ids]',
    '',
    '    def __len__(self):',
    '        return len(self.samples)',
    '',
    '    def __getitem__(self, idx):',
    '        sample = self.samples[idx]',
    '        midi_seq = torch.tensor(sample["sequences"]["midi"])',
    '        return midi_seq',
    '',
    'dataset = JazzLickDataset("full_dataset.json", "splits.json", split="train")',
    '```',
    '',
    '### Load with Python (pandas/sklearn)',
    '```python',
    'import pandas as pd',
    'from sklearn.ensemble import RandomForestClassifier',
    '',
    'df = pd.read_csv("features.csv")',
    'X = df.drop(["id", "lick_id", "label"], axis=1)',
    'y = df["label"]',
    '',
    'clf = RandomForestClassifier()',
    'clf.fit(X, y)',
    '```',
    '',
    '## Dataset Parameters',
    '',
    `- Keys: ${CONFIG.keys.join(', ')}`,
    `- Progression types: ${CONFIG.progressionTypes.join(', ')}`,
    `- Device strategies: ${CONFIG.deviceStrategies.join(', ')}`,
    `- Swing ratios: ${CONFIG.swingRatios.join(', ')}`,
    '',
    '## License',
    '',
    'This dataset is generated by an automated system and is provided for educational and research purposes.',
    ''
  ].join('\n');

  fs.writeFileSync(`${CONFIG.outputDir}/README.md`, readme);
  console.log(`✓ Generated README.md`);
}

// ========== MAIN ==========

function main() {
  console.log('═'.repeat(60));
  console.log('  Jazz Licks ML Dataset Generator');
  console.log('═'.repeat(60));
  console.log('');

  const dataset = generateDataset();
  exportDataset(dataset);
  generateReadme();

  console.log('');
  console.log('🎉 All done! You can now use this dataset to train ML models.');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Review the README.md for usage examples');
  console.log('  2. Load the dataset in your ML framework (PyTorch, TensorFlow, etc.)');
  console.log('  3. Start training!');
  console.log('');
}

// Run
main();
