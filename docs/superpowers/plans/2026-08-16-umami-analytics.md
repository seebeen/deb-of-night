# Umami Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Record execution status in the corresponding Beads issues; the numbered actions below are implementation instructions, not a second task tracker.

**Goal:** Replace Google Universal Analytics with the supplied self-hosted Umami tracker and record the approved player, playlist, transcript, and Steam-link events.

**Architecture:** `index.html` owns the single site-wide Umami loader. A focused `src/analytics.js` module contains safe tracker access, stable event metadata, and the stateful playback-event binding; `src/main.js` connects existing UI interactions to that module without making analytics a prerequisite for any behavior.

**Tech Stack:** Vite 8, browser ES modules, Plyr 3, Node.js built-in test runner

## Global Constraints

- Load exactly `https://analytics.oblak.host/script.js` with `defer` and `data-website-id="79e1902f-873a-4d0b-b4d2-0a0a891ab333"`.
- Remove all Google Analytics artifacts: `googletagmanager.com`, `dataLayer`, `gtag`, and `UA-140789866-1`.
- Leave Umami automatic pageview tracking enabled.
- Custom event names are exactly `player-play`, `player-pause`, `player-ended`, `track-select`, `transcript-toggle`, `transcript-seek`, and `steam-click`.
- Custom event data is limited to `track_number`, `track_title`, `segment_number`, `state`, and `destination` as specified per event.
- Do not add identity tracking, session properties, consent UI, retries, queues, local analytics persistence, or additional interaction events.
- A missing, blocked, or throwing Umami tracker must not affect playback, transcript behavior, or navigation.
- Follow test-driven development: run every new test in its failing state before writing its production change.

---

### Task 1: Replace the page-level analytics loader

**Beads:** `debofnight-d0v.9`

**Files:**
- Modify: `scripts/page-layout.test.mjs:101-126`
- Modify: `index.html:24-72`

**Interfaces:**
- Consumes: the supplied Umami script URL and website ID.
- Produces: one deferred Umami loader with automatic pageviews; no legacy Google Analytics runtime.

**Step 1: Add the failing markup test**

Append this test to `scripts/page-layout.test.mjs`:

```js
test('page loads Umami and removes legacy Google Analytics', () => {
  assert.match(
    indexHtml,
    /<script defer src="https:\/\/analytics\.oblak\.host\/script\.js" data-website-id="79e1902f-873a-4d0b-b4d2-0a0a891ab333"><\/script>/,
  );
  assert.doesNotMatch(indexHtml, /googletagmanager\.com/);
  assert.doesNotMatch(indexHtml, /\bdataLayer\b/);
  assert.doesNotMatch(indexHtml, /\bgtag\s*\(/);
  assert.doesNotMatch(indexHtml, /UA-140789866-1/);
});
```

**Step 2: Run the focused test and verify the expected failure**

Run:

```bash
node --test --test-name-pattern="page loads Umami" scripts/page-layout.test.mjs
```

Expected: FAIL because the Umami loader is absent and the Google Analytics strings are still present.

**Step 3: Replace the loader with the minimum markup change**

Add this immediately after the existing font stylesheet in `<head>`:

```html
    <script defer src="https://analytics.oblak.host/script.js" data-website-id="79e1902f-873a-4d0b-b4d2-0a0a891ab333"></script>
```

Delete the complete block at the bottom of `<body>` beginning with `<!-- Global site tag (gtag.js) - Google Analytics -->` and ending with its inline `</script>`. Keep the Vite module script unchanged.

**Step 4: Run the focused test and verify it passes**

Run:

```bash
node --test --test-name-pattern="page loads Umami" scripts/page-layout.test.mjs
```

Expected: PASS with no assertion failures.

**Step 5: Commit the page-level integration**

```bash
git add index.html scripts/page-layout.test.mjs
git commit -m "feat: replace Google Analytics with Umami"
```

---

### Task 2: Add the safe analytics boundary and playback lifecycle

**Beads:** `debofnight-d0v.10`

**Files:**
- Create: `scripts/analytics.test.mjs`
- Create: `src/analytics.js`

**Interfaces:**
- Consumes: `getTrackDisplayTitle(track)` from `src/playlist.js`; a Plyr-compatible object exposing `on(eventName, handler)` and the boolean `ended` property.
- Produces: `trackEvent(eventName, data, tracker?)`, `getTrackAnalyticsData(track, index)`, and `bindPlaybackAnalytics(player, getCurrentTrackData, sendEvent?)` returning `{ reset() }`.

**Step 1: Write failing tests for safe event forwarding and track metadata**

Create `scripts/analytics.test.mjs` with these initial tests:

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import { getTrackAnalyticsData, trackEvent } from '../src/analytics.js';

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
```

**Step 2: Run the analytics test file and verify the module-not-found failure**

Run:

```bash
node --test scripts/analytics.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/analytics.js`.

**Step 3: Implement safe event forwarding and metadata**

Create `src/analytics.js` with:

```js
import { getTrackDisplayTitle } from './playlist.js';

export function trackEvent(eventName, data, tracker = globalThis.umami) {
  try {
    tracker?.track?.(eventName, data);
  } catch {
    // Analytics must never interrupt the site experience.
  }
}

export function getTrackAnalyticsData(track, index) {
  return {
    track_number: index + 1,
    track_title: getTrackDisplayTitle(track),
  };
}
```

**Step 4: Run the analytics tests and verify the first behaviors pass**

Run:

```bash
node --test scripts/analytics.test.mjs
```

Expected: 4 tests pass.

**Step 5: Add failing playback lifecycle tests**

Extend the import and append the helper and tests below:

```js
import { bindPlaybackAnalytics, getTrackAnalyticsData, trackEvent } from '../src/analytics.js';

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
```

Replace the original import rather than keeping two imports from `src/analytics.js`.

**Step 6: Run the analytics test file and verify the missing-export failure**

Run:

```bash
node --test scripts/analytics.test.mjs
```

Expected: FAIL because `bindPlaybackAnalytics` is not exported.

**Step 7: Implement playback lifecycle binding**

Append this to `src/analytics.js`:

```js
export function bindPlaybackAnalytics(player, getCurrentTrackData, sendEvent = trackEvent) {
  let hasStarted = false;

  player.on('play', () => {
    hasStarted = true;
    sendEvent('player-play', getCurrentTrackData());
  });

  player.on('pause', () => {
    if (hasStarted && !player.ended) {
      sendEvent('player-pause', getCurrentTrackData());
    }
  });

  player.on('ended', () => {
    if (!hasStarted) {
      return;
    }

    sendEvent('player-ended', getCurrentTrackData());
    hasStarted = false;
  });

  return {
    reset() {
      hasStarted = false;
    },
  };
}
```

**Step 8: Run the analytics tests and verify all boundary tests pass**

Run:

```bash
node --test scripts/analytics.test.mjs
```

Expected: 6 tests pass.

**Step 9: Commit the analytics boundary**

```bash
git add src/analytics.js scripts/analytics.test.mjs
git commit -m "feat: add safe Umami event tracking"
```

---

### Task 3: Wire the approved UI events

**Beads:** `debofnight-d0v.11`

**Files:**
- Modify: `scripts/analytics.test.mjs`
- Modify: `src/analytics.js`
- Modify: `index.html:44-59`
- Modify: `src/main.js:4-102`

**Interfaces:**
- Consumes: `trackEvent`, `getTrackAnalyticsData`, and `bindPlaybackAnalytics` from `src/analytics.js`; DOM-like event targets for the playlist, transcript list, transcript summary, and Steam link.
- Produces: `bindInteractionAnalytics(elements, getTrackData, sendEvent?)`, which records the four non-playback events from actual bubbling click events. Together with playback analytics, all seven approved events are covered.

**Step 1: Write failing behavior tests for delegated interaction analytics**

Append these helpers and tests to `scripts/analytics.test.mjs`, and add `bindInteractionAnalytics` to its existing import:

```js
function createClickSource() {
  let clickHandler;
  const containedTargets = new Set();

  return {
    addEventListener(eventName, handler) {
      assert.equal(eventName, 'click');
      clickHandler = handler;
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
```

The click-source double mirrors only the standard `addEventListener`, bubbling-target `closest`, container `contains`, and `dataset` contracts used by the production binder. Assertions remain on the real binder's emitted analytics contract, not on the double.

**Step 2: Run the analytics tests and verify the missing-export failure**

Run:

```bash
node --test scripts/analytics.test.mjs
```

Expected: FAIL because `bindInteractionAnalytics` is not exported.

**Step 3: Implement delegated interaction analytics**

Append this to `src/analytics.js`:

```js
export function bindInteractionAnalytics(elements, getTrackData, sendEvent = trackEvent) {
  elements.playlist.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-track-index]');

    if (!button || !elements.playlist.contains(button)) {
      return;
    }

    const index = Number(button.dataset.trackIndex);

    if (Number.isInteger(index)) {
      sendEvent('track-select', getTrackData(index));
    }
  });

  elements.transcriptList.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-segment-index]');

    if (!button || !elements.transcriptList.contains(button)) {
      return;
    }

    const segmentIndex = Number(button.dataset.segmentIndex);

    if (Number.isInteger(segmentIndex)) {
      sendEvent('transcript-seek', {
        ...getTrackData(),
        segment_number: segmentIndex + 1,
      });
    }
  });

  elements.transcriptSummary.addEventListener('click', () => {
    sendEvent('transcript-toggle', {
      state: elements.transcriptDetails.open ? 'closed' : 'open',
    });
  });

  elements.steamLink.addEventListener('click', () => {
    sendEvent('steam-click', { destination: 'steam-store' });
  });
}
```

Event delegation uses the existing `data-track-index` and `data-segment-index` attributes, so dynamically rendered buttons need no analytics-specific listeners.

**Step 4: Run the analytics tests and verify all ten pass**

Run:

```bash
node --test scripts/analytics.test.mjs
```

Expected: 10 tests pass.

**Step 5: Add stable DOM hooks**

Update the existing transcript summary and Steam anchor in `index.html` without changing their visible content or navigation:

```html
          <summary class="transcript__header" data-transcript-toggle aria-labelledby="transcript-title">
```

```html
        now go buy <a data-steam-link href="http://store.steampowered.com/app/2600/">vampire: the masquerade - bloodlines</a>
```

**Step 6: Import analytics and cache the new elements**

Replace the analytics import in `src/main.js` with:

```js
import { bindInteractionAnalytics, bindPlaybackAnalytics, getTrackAnalyticsData } from './analytics.js';
```

Add these entries to `elements`:

```js
  transcriptSummary: document.querySelector('[data-transcript-toggle]'),
  steamLink: document.querySelector('[data-steam-link]'),
```

**Step 7: Bind playback and delegated interaction analytics**

Immediately after creating `player`, bind its lifecycle:

```js
const playbackAnalytics = bindPlaybackAnalytics(player, () =>
  getTrackAnalyticsData(state.tracks[state.currentIndex], state.currentIndex),
);
```

Bind interaction analytics immediately after playback analytics:

```js
bindInteractionAnalytics(elements, (index = state.currentIndex) =>
  getTrackAnalyticsData(state.tracks[index], index),
);
```

Because the binder observes actual clicks, restoring `details.open` through `localStorage` does not emit `transcript-toggle`. Keyboard activation of `<summary>` still produces a click event. Delegation from the existing playlist and transcript containers captures both button and nested-span targets.

**Step 8: Reset lifecycle state before every valid source change**

In `selectTrack`, after the invalid-track guard and before assigning `state.currentIndex`, add:

```js
  playbackAnalytics.reset();
```

The reset occurs before `player.source` changes, so any pause generated by source replacement is suppressed.

**Step 9: Run focused analytics tests and verify they pass**

Run:

```bash
node --test scripts/analytics.test.mjs
```

Expected: 10 tests pass.

**Step 10: Run the existing player/layout regression tests**

Run:

```bash
node --test scripts/player-helpers.test.mjs scripts/page-layout.test.mjs
```

Expected: all existing tests plus the new loader test pass.

**Step 11: Commit the interaction wiring**

```bash
git add index.html src/analytics.js src/main.js scripts/analytics.test.mjs
git commit -m "feat: track player and transcript engagement"
```

---

### Task 4: Verify the complete production change

**Beads:** `debofnight-d0v.12`

**Files:**
- Verify only: all tracked implementation and test files

**Interfaces:**
- Consumes: the completed work from Tasks 1-3.
- Produces: fresh evidence that tests, production bundling, and repository whitespace checks succeed together.

**Step 1: Run the complete automated test suite**

Run:

```bash
npm test
```

Expected: every `scripts/*.test.mjs` test passes with zero failures.

**Step 2: Build the production bundle**

Run:

```bash
npm run build
```

Expected: Vite exits successfully and emits the production bundle without errors.

**Step 3: Check the complete diff for whitespace errors**

Run:

```bash
git diff --check origin/master...HEAD
```

Expected: exit status 0 with no output.

**Step 4: Review scope against the approved design**

Run:

```bash
git diff --stat origin/master...HEAD
git diff origin/master...HEAD -- index.html src/analytics.js src/main.js scripts/analytics.test.mjs scripts/page-layout.test.mjs
```

Expected: only the Umami loader, legacy analytics removal, analytics boundary, seven approved events, DOM hooks, and their tests are present.

**Step 5: Confirm the worktree is clean**

Run:

```bash
git status --short --branch
```

Expected: no unstaged or uncommitted files; the feature branch is ahead of its remote until the repository completion workflow pushes it.
