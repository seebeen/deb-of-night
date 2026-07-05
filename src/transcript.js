const GENERIC_SPEAKER_LABEL = /^speaker\s+\d+$/i;

export function findActiveSegment(segments, currentTime) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return null;
  }

  const time = Number(currentTime);

  if (!Number.isFinite(time)) {
    return segments[0] ?? null;
  }

  let active = segments[0];

  for (const segment of segments) {
    if (time < segment.start) {
      break;
    }

    active = segment;
  }

  return active;
}

export function getDisplaySpeakerLabel(label) {
  const normalized = String(label || '').trim();

  if (!normalized || GENERIC_SPEAKER_LABEL.test(normalized)) {
    return '';
  }

  return normalized;
}
