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
