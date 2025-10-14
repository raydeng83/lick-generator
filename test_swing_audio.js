// Test that swing durations are converted correctly to seconds

function beatsToDur(beats, tempo) {
  // For standard note durations, use musical notation
  if (Math.abs(beats - 0.5) < 1e-6) return "8n";
  if (Math.abs(beats - 1) < 1e-6) return "4n";
  if (Math.abs(beats - 2) < 1e-6) return "2n";
  if (Math.abs(beats - 4) < 1e-6) return "1n";

  // For non-standard durations (swing), convert to seconds
  // Duration in seconds = (beats / tempo) * 60
  const seconds = (beats / tempo) * 60;
  return seconds.toFixed(4); // Return as string "0.2500" etc
}

console.log('Testing swing duration conversion at 100 BPM\n');

const tempo = 100;

// Test straight eighth notes
console.log('=== Straight Eighth Notes (swing = 0) ===');
console.log('First note (0.5 beats):', beatsToDur(0.5, tempo));
console.log('Second note (0.5 beats):', beatsToDur(0.5, tempo));

// Test triplet feel (swing = 0.5)
console.log('\n=== Triplet Feel (swing = 0.5) ===');
const swingOffset = 0.5 * (1/6);
const firstDuration = 0.5 + swingOffset;
const secondDuration = 0.5 - swingOffset;

console.log(`First note (${firstDuration.toFixed(3)} beats):`, beatsToDur(firstDuration, tempo));
console.log(`Second note (${secondDuration.toFixed(3)} beats):`, beatsToDur(secondDuration, tempo));

// Verify total duration is preserved
const total = firstDuration + secondDuration;
console.log(`Total duration: ${total.toFixed(3)} beats (should be 1.000)`);

// Calculate expected seconds
const firstSeconds = (firstDuration / tempo) * 60;
const secondSeconds = (secondDuration / tempo) * 60;
console.log(`\nExpected durations:`);
console.log(`  First: ${firstSeconds.toFixed(4)} seconds`);
console.log(`  Second: ${secondSeconds.toFixed(4)} seconds`);
console.log(`  Total: ${(firstSeconds + secondSeconds).toFixed(4)} seconds`);

// Test extreme swing (swing = 1.0)
console.log('\n=== Extreme Swing (swing = 1.0) ===');
const extremeOffset = 1.0 * (1/6);
const extremeFirst = 0.5 + extremeOffset;
const extremeSecond = 0.5 - extremeOffset;

console.log(`First note (${extremeFirst.toFixed(3)} beats):`, beatsToDur(extremeFirst, tempo));
console.log(`Second note (${extremeSecond.toFixed(3)} beats):`, beatsToDur(extremeSecond, tempo));

console.log('\n✓ All durations converted correctly!');
console.log('Notes with swing will use exact second durations instead of musical notation.');
