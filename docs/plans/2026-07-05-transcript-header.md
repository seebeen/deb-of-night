# Transcript Header Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render a compact transcript panel with curated speaker names, no duplicate transcript/play header wording, and no visible timestamps.

**Architecture:** Create `assets/js/transcript-renderer.mjs` with pure functions and a DOM initializer. Speaker labels come from range-aware rules keyed by track id, speaker id, and segment/time ranges. `index.html` provides a single transcript mount and loads the module after the existing player code.

**Tech Stack:** Static HTML/CSS, MediaElement/jQuery player, browser ES modules, Node `node:test`.

---

### Task 1: Add Failing Helper Tests

**Files:**
- Create: `scripts/transcript-renderer.test.mjs`

**Step 1: Write the failing test**

Test that `resolveSpeakerName()` maps the same speaker id to different names in different ranges, `buildTranscriptHeader()` de-duplicates names, and `renderTranscriptSegments()` omits timestamps.

**Step 2: Run test to verify it fails**

Run: `node --test scripts/transcript-renderer.test.mjs`

Expected: FAIL because `assets/js/transcript-renderer.mjs` does not exist.

### Task 2: Implement Renderer Helper

**Files:**
- Create: `assets/js/transcript-renderer.mjs`

**Step 1: Write minimal implementation**

Export `SPEAKER_RULES`, `resolveSpeakerName()`, `buildTranscriptHeader()`, `renderTranscriptSegments()`, and `initTranscriptRenderer()`.

**Step 2: Run focused test**

Run: `node --test scripts/transcript-renderer.test.mjs`

Expected: PASS.

### Task 3: Wire UI And Header Cleanup

**Files:**
- Modify: `index.html`
- Modify: `assets/css/main.min.css`
- Modify: `assets/js/main.min.js`

**Step 1: Update markup**

Add one transcript panel mount after the player and load `assets/js/transcript-renderer.mjs` with `type="module"`.

**Step 2: Remove visible player timestamps**

Remove `current` and `duration` from the MediaElement feature list, leaving the scrubber available.

**Step 3: Style the compact panel**

Add CSS for `.transcript`, `.transcript__header`, `.transcript__speakers`, `.transcript__body`, `.transcript__line`, and `.transcript__speaker`.

**Step 4: Run full tests**

Run: `npm test`

Expected: PASS.
