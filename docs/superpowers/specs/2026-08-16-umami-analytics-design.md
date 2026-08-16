# Umami Analytics Design

## Goal

Replace the obsolete Google Universal Analytics integration with the supplied self-hosted Umami tracker and record a focused set of player, playlist, transcript, and outbound-link interactions. Analytics must remain optional from the application's point of view: a blocked, delayed, or failing tracker must never interfere with playback or navigation.

## Tracker Integration

Add this deferred script to the document head:

```html
<script defer src="https://analytics.oblak.host/script.js" data-website-id="79e1902f-873a-4d0b-b4d2-0a0a891ab333"></script>
```

Remove the complete Google Analytics block, including the `googletagmanager.com` script, `dataLayer`, `gtag` function, and `UA-140789866-1` configuration. Umami's automatic pageview tracking remains enabled.

## Analytics Boundary

Create `src/analytics.js` as the single integration boundary. It will:

- expose a safe function for `globalThis.umami.track(eventName, data)`;
- silently do nothing when the tracker has not loaded or has been blocked;
- contain tracker failures so analytics cannot break the player;
- build consistent, low-cardinality track metadata; and
- bind and manage playback lifecycle analytics independently from rendering.

Track metadata uses `track_number` as the manifest position plus one and `track_title` as the existing display title. No visitor identifiers, transcript text, URLs, timestamps, playback positions, or other free-form data are attached.

## Event Contract

| Event | Trigger | Data |
| --- | --- | --- |
| `player-play` | The current audio source starts or resumes playback. | `track_number`, `track_title` |
| `player-pause` | A source that has started playback is paused by the media element. | `track_number`, `track_title` |
| `player-ended` | The current source reaches its natural end. | `track_number`, `track_title` |
| `track-select` | A visitor activates a playlist item. | `track_number`, `track_title` |
| `transcript-toggle` | A visitor activates the transcript summary. | `state`, containing `open` or `closed` |
| `transcript-seek` | A visitor activates a transcript segment. | `track_number`, `track_title`, `segment_number` |
| `steam-click` | A visitor activates the outbound Steam-store link. | `destination`, containing `steam-store` |

`segment_number` is the transcript segment index plus one so Umami reports human-readable, one-based values.

## Playback Semantics

Playback analytics maintain a small per-source state. `player-play` marks the current source as started. `player-pause` is ignored until that source has started, suppressing initialization noise. Before every source replacement, the state is reset so pauses caused by loading another track are ignored. `player-ended` is recorded before the existing automatic transition to the next track and resets the state so an end-related pause cannot be double-counted.

Manual playlist activation records `track-select` before selecting the requested track. Automatic advancement does not record `track-select`; it is represented by `player-ended` for the completed track and `player-play` for the next track.

## Transcript and Link Semantics

Only visitor activation of the transcript summary records `transcript-toggle`. Restoring the disclosure state from `localStorage` does not create an analytics event. The reported state is the state the disclosure will enter after the activation.

Transcript-segment activation records `transcript-seek` before seeking and playing. A resulting playback start or resume may also record `player-play`; these represent separate intents.

The existing Steam link records `steam-click` without delaying or preventing navigation.

## Failure Handling

Analytics are best-effort. Calls made before Umami is available, calls blocked by browser extensions, and synchronous tracker exceptions are ignored. No retries, queues, local persistence, identity assignment, or consent state are introduced by this feature.

Playlist and transcript loading retain their current error behavior and do not emit analytics for failed initialization.

## Testing

Implementation follows test-driven development:

1. Add failing markup assertions for the exact Umami loader and removal of every legacy Google Analytics artifact.
2. Add failing unit tests for successful event forwarding, missing-tracker behavior, thrown tracker errors, stable track metadata, playback lifecycle suppression, and lifecycle event payloads.
3. Add failing integration-oriented source assertions for the selected playlist, transcript, and Steam event wiring where the current dependency-free test setup cannot run a browser DOM.
4. Add the minimum production code needed to pass each test.
5. Run the complete Node test suite and the Vite production build.

## Out of Scope

This change will not add identity tracking, session properties, consent UI, custom pageview behavior, playback progress milestones, seek-bar events, volume or mute events, caption events, automatic-next selection events, or analytics dashboards.
