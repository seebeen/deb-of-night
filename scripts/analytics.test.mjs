import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bindInteractionAnalytics,
  bindPlaybackAnalytics,
  getTrackAnalyticsData,
  trackEvent,
} from '../src/analytics.js';

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

function createClickSource() {
  let clickHandler;
  const containedTargets = new Set();

  return {
    addEventListener(eventName, handler) {
      if (eventName === 'click') {
        clickHandler = handler;
      }
    },
    contains(target) {
      return containedTargets.has(target);
    },
    contain(target) {
      containedTargets.add(target);
    },
    click(target = this) {
      clickHandler({ target });
    },
  };
}

function createClosestTarget(selector, matchedElement) {
  return {
    closest(candidate) {
      return candidate === selector ? matchedElement : null;
    },
  };
}

function createInteractionHarness() {
  const elements = {
    playlist: createClickSource(),
    transcriptList: createClickSource(),
    transcriptSummary: createClickSource(),
    transcriptDetails: { open: false },
    steamLink: createClickSource(),
  };
  const tracks = [
    { title: 'The Deb of Night #1', callerNames: ['Vigo', 'Gomez'] },
    { title: 'The Deb of Night #2', callerNames: ['Greg', 'Andrei'] },
  ];
  const calls = [];

  bindInteractionAnalytics(
    elements,
    (index = 1) => getTrackAnalyticsData(tracks[index], index),
    (...args) => calls.push(args),
  );

  return { calls, elements };
}

test('bindInteractionAnalytics reports delegated playlist selection', () => {
  const { calls, elements } = createInteractionHarness();
  const button = { dataset: { trackIndex: '0' } };
  elements.playlist.contain(button);

  elements.playlist.click(createClosestTarget('[data-track-index]', button));

  assert.deepEqual(calls, [
    ['track-select', { track_number: 1, track_title: 'The Deb of Night #1 - Vigo, Gomez' }],
  ]);
});

test('bindInteractionAnalytics reports delegated transcript seeking', () => {
  const { calls, elements } = createInteractionHarness();
  const button = { dataset: { segmentIndex: '7' } };
  elements.transcriptList.contain(button);

  elements.transcriptList.click(createClosestTarget('[data-segment-index]', button));

  assert.deepEqual(calls, [
    [
      'transcript-seek',
      {
        track_number: 2,
        track_title: 'The Deb of Night #2 - Greg, Andrei',
        segment_number: 8,
      },
    ],
  ]);
});

test('bindInteractionAnalytics reports the transcript state entered by a visitor click', () => {
  const { calls, elements } = createInteractionHarness();

  elements.transcriptSummary.click();
  elements.transcriptDetails.open = true;
  elements.transcriptSummary.click();

  assert.deepEqual(calls, [
    ['transcript-toggle', { state: 'open' }],
    ['transcript-toggle', { state: 'closed' }],
  ]);
});

test('bindInteractionAnalytics reports Steam link activation', () => {
  const { calls, elements } = createInteractionHarness();

  elements.steamLink.click();

  assert.deepEqual(calls, [['steam-click', { destination: 'steam-store' }]]);
});
