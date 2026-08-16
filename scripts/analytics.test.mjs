import assert from 'node:assert/strict';
import test from 'node:test';

import { bindPlaybackAnalytics, getTrackAnalyticsData, trackEvent } from '../src/analytics.js';

test('trackEvent forwards the event name and data to Umami', () => {
  const calls = [];
  const tracker = {
    track(...args) {
      calls.push(args);
    },
  };

  trackEvent('steam-click', { destination: 'steam-store' }, tracker);

  assert.deepEqual(calls, [['steam-click', { destination: 'steam-store' }]]);
});

test('trackEvent is inert when Umami is unavailable', () => {
  assert.doesNotThrow(() => trackEvent('steam-click', { destination: 'steam-store' }, null));
});

test('trackEvent contains synchronous tracker failures', () => {
  const tracker = {
    track() {
      throw new Error('tracker failed');
    },
  };

  assert.doesNotThrow(() => trackEvent('steam-click', { destination: 'steam-store' }, tracker));
});

test('getTrackAnalyticsData returns one-based track metadata with its display title', () => {
  assert.deepEqual(
    getTrackAnalyticsData(
      {
        title: 'The Deb of Night #1',
        callerNames: ['Vigo', 'Gomez'],
      },
      0,
    ),
    {
      track_number: 1,
      track_title: 'The Deb of Night #1 - Vigo, Gomez',
    },
  );
});

function createPlayerHarness() {
  const handlers = new Map();
  const player = {
    ended: false,
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  };

  return {
    player,
    emit(eventName) {
      handlers.get(eventName)?.();
    },
  };
}

test('bindPlaybackAnalytics reports play, user pause, resume, and natural completion in order', () => {
  const harness = createPlayerHarness();
  const calls = [];
  const trackData = { track_number: 2, track_title: 'The Deb of Night #2 - Greg, Andrei' };

  bindPlaybackAnalytics(harness.player, () => trackData, (...args) => calls.push(args));
  harness.emit('play');
  harness.emit('pause');
  harness.emit('play');
  harness.player.ended = true;
  harness.emit('pause');
  harness.emit('ended');
  harness.player.ended = false;
  harness.emit('pause');

  assert.deepEqual(calls, [
    ['player-play', trackData],
    ['player-pause', trackData],
    ['player-play', trackData],
    ['player-ended', trackData],
  ]);
});

test('bindPlaybackAnalytics suppresses pauses before playback and after a source reset', () => {
  const harness = createPlayerHarness();
  const calls = [];
  const lifecycle = bindPlaybackAnalytics(
    harness.player,
    () => ({ track_number: 1, track_title: 'The Deb of Night #1' }),
    (...args) => calls.push(args),
  );

  harness.emit('pause');
  harness.emit('play');
  lifecycle.reset();
  harness.emit('pause');

  assert.deepEqual(calls.map(([eventName]) => eventName), ['player-play']);
});
