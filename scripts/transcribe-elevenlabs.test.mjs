import assert from 'node:assert/strict';
import test from 'node:test';

import { estimateCredits } from './transcript-utils.mjs';
import { createTranscriptionOptions, discoverTracks, printInventory } from './transcribe-elevenlabs.mjs';

test('dry-run inventories the five radio loops and estimates keyterm credits', () => {
  const lines = [];
  const originalLog = console.log;
  console.log = (message) => lines.push(message);

  return discoverTracks()
    .then((tracks) => {
      const estimate = estimateCredits(
        tracks.map((track) => track.duration),
        { keyterms: true },
      );

      printInventory(tracks, estimate);

      const output = lines.join('\n');

      assert.match(output, /radio_loop_1\.mp3/);
      assert.match(output, /radio_loop_5\.mp3/);
      assert.match(output, /Total minutes: 48\.8285/);
      assert.match(output, /Estimated credits with keyterms: 19336/);
    })
    .finally(() => {
      console.log = originalLog;
    });
});

test('createTranscriptionOptions enables Scribe v2 diarization without fixed speaker count', () => {
  const options = createTranscriptionOptions('/tmp/radio_loop_1.mp3');

  assert.equal(options.modelId, 'scribe_v2');
  assert.equal(options.languageCode, 'en');
  assert.equal(options.timestampsGranularity, 'word');
  assert.equal(options.tagAudioEvents, true);
  assert.equal(options.diarize, true);
  assert.equal(Object.hasOwn(options, 'numSpeakers'), false);
  assert.deepEqual(options.file, {
    path: '/tmp/radio_loop_1.mp3',
    filename: 'radio_loop_1.mp3',
    contentType: 'audio/mpeg',
  });
});
