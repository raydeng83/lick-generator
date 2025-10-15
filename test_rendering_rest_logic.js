// Test the rest rendering logic (simulating notate.js behavior)
const fs = require('fs');

console.log('=== Testing Rest Rendering Logic ===\n');

/**
 * Simulate the addRestsForGap logic from notate.js
 */
function testAddRestsForGap(gapStartBeat, gapDurationBeats) {
  const rests = [];

  // Calculate measure midpoint
  const measureStart = Math.floor(gapStartBeat / 4) * 4;
  const midpoint = measureStart + 2;
  const gapEndBeat = gapStartBeat + gapDurationBeats;

  // Check if gap crosses midpoint
  if (gapStartBeat < midpoint && gapEndBeat > midpoint) {
    // Split at midpoint
    const beforeMidpoint = midpoint - gapStartBeat;
    const afterMidpoint = gapEndBeat - midpoint;

    // Add rests before midpoint
    addRestsSingleHalf(rests, gapStartBeat, beforeMidpoint);
    // Add rests after midpoint
    addRestsSingleHalf(rests, midpoint, afterMidpoint);
  } else {
    // Doesn't cross midpoint - use normal greedy algorithm
    addRestsSingleHalf(rests, gapStartBeat, gapDurationBeats);
  }

  return rests;
}

function addRestsSingleHalf(rests, startBeat, durationBeats) {
  let remaining = durationBeats;
  let currentBeat = startBeat;

  while (remaining > 0) {
    let restDuration;
    if (remaining >= 2) {
      restDuration = 2;
    } else if (remaining >= 1) {
      restDuration = 1;
    } else {
      restDuration = 0.5;
    }

    rests.push({
      startBeat: currentBeat,
      durationBeats: restDuration,
      endBeat: currentBeat + restDuration
    });

    remaining -= restDuration;
    currentBeat += restDuration;
  }
}

// Test cases
const testCases = [
  { start: 0, duration: 2, description: 'Half rest in first half (0-2)' },
  { start: 2, duration: 2, description: 'Half rest in second half (2-4)' },
  { start: 1, duration: 3, description: 'Rest crossing midpoint (1-4)' },
  { start: 1.5, duration: 2.5, description: 'Rest crossing midpoint (1.5-4)' },
  { start: 0.5, duration: 3.5, description: 'Rest crossing midpoint (0.5-4)' },
  { start: 0, duration: 4, description: 'Whole measure rest (0-4)' },
  { start: 6, duration: 2, description: 'Half rest in second half of measure 2 (6-8)' },
  { start: 5, duration: 3, description: 'Rest crossing midpoint in measure 2 (5-8)' },
];

let violations = 0;

testCases.forEach((testCase, idx) => {
  console.log(`Test ${idx + 1}: ${testCase.description}`);
  console.log(`  Input: beat ${testCase.start} to ${testCase.start + testCase.duration} (duration ${testCase.duration})`);

  const rests = testAddRestsForGap(testCase.start, testCase.duration);

  console.log(`  Output: ${rests.length} rest(s)`);

  let hasViolations = false;
  rests.forEach((rest, restIdx) => {
    const measureStart = Math.floor(rest.startBeat / 4) * 4;
    const midpoint = measureStart + 2;
    const crossesMidpoint = rest.startBeat < midpoint && rest.endBeat > midpoint;

    console.log(`    Rest ${restIdx + 1}: beat ${rest.startBeat} to ${rest.endBeat} (duration ${rest.durationBeats})`);

    if (crossesMidpoint) {
      console.log(`      ❌ VIOLATION: Crosses midpoint at ${midpoint}`);
      hasViolations = true;
      violations++;
    } else {
      if (rest.startBeat < midpoint) {
        console.log(`      ✓ In first half (before midpoint ${midpoint})`);
      } else {
        console.log(`      ✓ In second half (at or after midpoint ${midpoint})`);
      }
    }
  });

  if (hasViolations) {
    console.log(`  ❌ TEST FAILED\n`);
  } else {
    console.log(`  ✓ TEST PASSED\n`);
  }
});

console.log('=== Summary ===');
console.log(`Total test cases: ${testCases.length}`);
console.log(`Violations: ${violations}`);

if (violations > 0) {
  console.log('\n❌ TESTS FAILED - Rest rendering logic has violations');
  process.exit(1);
} else {
  console.log('\n✅ ALL TESTS PASSED - Rest rendering logic respects midpoint rule');
}
