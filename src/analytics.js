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
