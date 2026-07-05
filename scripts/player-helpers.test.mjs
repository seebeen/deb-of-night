import assert from 'node:assert/strict';
import test from 'node:test';

import { getWrappedTrackIndex, normalizeTrackUrl } from '../src/playlist.js';
import { createRainPosition } from '../src/rain.js';
import { findActiveSegment, getDisplaySpeakerLabel } from '../src/transcript.js';

test('findActiveSegment keeps the current segment active until the next one starts', () => {
  const segments = [
    { index: 0, start: 0, end: 1.5, text: 'First' },
    { index: 1, start: 2, end: 3, text: 'Second' },
    { index: 2, start: 4, end: 5, text: 'Third' },
  ];

  assert.equal(findActiveSegment(segments, 0)?.index, 0);
  assert.equal(findActiveSegment(segments, 2.75)?.index, 1);
  assert.equal(findActiveSegment(segments, 3.5)?.index, 1);
  assert.equal(findActiveSegment(segments, 5.5)?.index, 2);
});

test('findActiveSegment returns null when no segments are available', () => {
  assert.equal(findActiveSegment([], 12), null);
});

test('getDisplaySpeakerLabel hides generic diarization labels', () => {
  assert.equal(getDisplaySpeakerLabel('Speaker 1'), '');
  assert.equal(getDisplaySpeakerLabel('speaker 27'), '');
  assert.equal(getDisplaySpeakerLabel('Deb'), 'Deb');
  assert.equal(getDisplaySpeakerLabel('Caller 2'), 'Caller 2');
});

test('normalizeTrackUrl preserves absolute public URLs and anchors relative paths to the site root', () => {
  assert.equal(normalizeTrackUrl('/audio/radio_loop_1.mp3'), '/audio/radio_loop_1.mp3');
  assert.equal(normalizeTrackUrl('audio/radio_loop_1.mp3'), '/audio/radio_loop_1.mp3');
  assert.equal(
    normalizeTrackUrl('https://cdn.example.test/radio_loop_1.mp3'),
    'https://cdn.example.test/radio_loop_1.mp3',
  );
});

test('getWrappedTrackIndex wraps previous and next indices through the playlist length', () => {
  assert.equal(getWrappedTrackIndex(0, -1, 5), 4);
  assert.equal(getWrappedTrackIndex(4, 1, 5), 0);
  assert.equal(getWrappedTrackIndex(2, 1, 5), 3);
});

test('createRainPosition matches the legacy random 125px jitter range', () => {
  const values = [0.5, 0.25];
  const random = () => values.shift();

  assert.equal(createRainPosition(random), '62.5px 31.25px');
});
