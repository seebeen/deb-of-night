# Transcript Header Design

## Goal

Show one compact transcript panel for the selected radio loop, using curated speaker names where the transcript data provides enough context, without duplicating transcript/play labels or visible timestamps.

## Approach

Add a small browser-loadable transcript rendering helper. It will expose pure functions for tests and a page initializer for the static site. Speaker names are selected with range-aware rules keyed by track id, speaker id, and segment/time bounds because ElevenLabs diarization speaker IDs are reused for unrelated roles across calls, ads, and songs.

The page will fetch `assets/data/transcripts/manifest.json`, then the active track transcript. It will render a header from the selected track title plus the distinct curated names present in the visible transcript. It will render segment text as `Name: text` lines and intentionally omit per-line timestamps. The MediaElement player feature list and CSS will also avoid visible current/duration timestamps.

## Testing

Add Node tests for the pure helper functions before implementation:

- same `speakerId` can receive different names in different ranges;
- transcript header includes the title and real speaker names once;
- rendered transcript lines include names and text but no timestamp strings.
