// Test specific beaming scenario with detailed output
console.log('=== Beaming Scenario Test ===\n');

// Simulate the validNotes array with a specific scenario:
// Two eighth notes, a rest, then two more eighth notes - all within beat 0-1

const validNotes = [
  // Beat 0.0 - eighth note
  {
    duration: '8',
    startBeat: 0.0,
    durationBeats: 0.5,
    getKeys: () => ['d/4'],
    description: 'Eighth note at beat 0.0'
  },
  // Beat 0.5 - eighth note
  {
    duration: '8',
    startBeat: 0.5,
    durationBeats: 0.5,
    getKeys: () => ['e/4'],
    description: 'Eighth note at beat 0.5'
  },
  // Beat 1.0 - quarter rest
  {
    duration: 'qr',
    startBeat: 1.0,
    durationBeats: 1.0,
    description: 'Quarter rest at beat 1.0'
  },
  // Beat 2.0 - eighth note
  {
    duration: '8',
    startBeat: 2.0,
    durationBeats: 0.5,
    getKeys: () => ['f/4'],
    description: 'Eighth note at beat 2.0'
  },
  // Beat 2.5 - eighth note
  {
    duration: '8',
    startBeat: 2.5,
    durationBeats: 0.5,
    getKeys: () => ['g/4'],
    description: 'Eighth note at beat 2.5'
  }
];

console.log('Input notes:');
validNotes.forEach((n, i) => {
  const isRest = n.duration.includes('r');
  console.log(`  [${i}] ${n.description} (${isRest ? 'REST' : 'NOTE'})`);
});

// Simulate the beaming logic
const beamGroups = [];
let currentGroup = [];

for (let i = 0; i < validNotes.length; i++) {
  const note = validNotes[i];

  console.log(`\nProcessing note ${i}: ${note.description}`);

  // Skip rests
  if (note.duration.includes('r')) {
    console.log('  -> Is rest, skipping');
    // Finish current group if any
    if (currentGroup.length >= 2) {
      console.log(`  -> Finishing beam group with ${currentGroup.length} notes`);
      beamGroups.push(currentGroup);
    } else if (currentGroup.length === 1) {
      console.log(`  -> Current group only has 1 note, discarding`);
    }
    currentGroup = [];
    continue;
  }

  // Check if startBeat and durationBeats are defined
  if (typeof note.startBeat === 'undefined' || typeof note.durationBeats === 'undefined') {
    console.log('  -> Missing timing info, skipping');
    if (currentGroup.length >= 2) {
      beamGroups.push(currentGroup);
    }
    currentGroup = [];
    continue;
  }

  // Only beam eighth notes (duration = 0.5 beats)
  if (note.durationBeats !== 0.5) {
    console.log(`  -> Duration ${note.durationBeats} is not 0.5, skipping`);
    if (currentGroup.length >= 2) {
      beamGroups.push(currentGroup);
    }
    currentGroup = [];
    continue;
  }

  // Check if this note is within the same beat as previous note AND is consecutive
  if (currentGroup.length > 0) {
    const prevNote = currentGroup[currentGroup.length - 1];
    const prevBeat = Math.floor(prevNote.startBeat);
    const currBeat = Math.floor(note.startBeat);

    // Check if notes are consecutive (no gap between them)
    const prevEndBeat = prevNote.startBeat + prevNote.durationBeats;
    const isConsecutive = Math.abs(prevEndBeat - note.startBeat) < 0.01;

    console.log(`  -> Comparing with prev note:`);
    console.log(`     prevNote ends at: ${prevEndBeat}`);
    console.log(`     currNote starts at: ${note.startBeat}`);
    console.log(`     Gap: ${note.startBeat - prevEndBeat}`);
    console.log(`     isConsecutive: ${isConsecutive}`);
    console.log(`     prevBeat: ${prevBeat}, currBeat: ${currBeat}`);

    if (prevBeat !== currBeat || !isConsecutive) {
      // Different beat OR not consecutive - finish current group
      console.log(`  -> Different beat or not consecutive, finishing current group`);
      if (currentGroup.length >= 2) {
        console.log(`     -> Creating beam group with ${currentGroup.length} notes`);
        beamGroups.push(currentGroup);
      }
      console.log(`  -> Starting new group with current note`);
      currentGroup = [note];
    } else {
      // Same beat AND consecutive - add to current group
      console.log(`  -> Same beat and consecutive, adding to current group`);
      currentGroup.push(note);
    }
  } else {
    // Start new group
    console.log(`  -> Starting first group`);
    currentGroup = [note];
  }
}

// Finish last group if any
if (currentGroup.length >= 2) {
  console.log(`\nFinishing final beam group with ${currentGroup.length} notes`);
  beamGroups.push(currentGroup);
} else if (currentGroup.length === 1) {
  console.log(`\nFinal group only has 1 note, discarding`);
}

console.log('\n=== Results ===');
console.log(`Total beam groups created: ${beamGroups.length}`);
beamGroups.forEach((group, i) => {
  console.log(`\nBeam group ${i + 1}:`);
  group.forEach(n => {
    console.log(`  - ${n.description}`);
  });
});

console.log('\n✅ Expected: 2 beam groups (beats 0-0.5 and beats 2-2.5)');
console.log(`✅ Actual: ${beamGroups.length} beam groups`);

if (beamGroups.length === 2) {
  console.log('\n✅ TEST PASSED - Rest correctly breaks beam groups');
} else {
  console.log('\n❌ TEST FAILED - Incorrect number of beam groups');
}
