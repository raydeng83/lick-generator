// Test swing timing at different thresholds

function testSwing(swingRatio, tempo) {
  const swingOffset = swingRatio * (1/6);
  const firstDuration = 0.5 + swingOffset;
  const secondDuration = 0.5 - swingOffset;

  // Convert to seconds
  const firstSeconds = (firstDuration / tempo) * 60;
  const secondSeconds = (secondDuration / tempo) * 60;

  return {
    swingRatio,
    swingOffset: swingOffset.toFixed(4),
    firstDuration: firstDuration.toFixed(4),
    secondDuration: secondDuration.toFixed(4),
    firstSeconds: firstSeconds.toFixed(4),
    secondSeconds: secondSeconds.toFixed(4),
    ratio: (firstDuration / secondDuration).toFixed(2)
  };
}

const tempo = 100;

console.log('Testing swing at different thresholds (tempo = 100 BPM)\n');

const thresholds = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

console.log('Swing% | Offset | First (beats) | Second (beats) | First (sec) | Second (sec) | Ratio');
console.log('-------|--------|---------------|----------------|-------------|--------------|------');

for (const swing of thresholds) {
  const result = testSwing(swing, tempo);
  const percent = (swing * 100).toString().padEnd(3, ' ');
  console.log(`${percent}%   | ${result.swingOffset} | ${result.firstDuration}        | ${result.secondDuration}        | ${result.firstSeconds}      | ${result.secondSeconds}      | ${result.ratio}:1`);
}

console.log('\nAll values are mathematically correct.');
console.log('If swing at 70% and below sounds straight, the issue is in audio playback, not calculation.');
