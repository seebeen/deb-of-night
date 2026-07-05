export function normalizeTrackUrl(url) {
  if (!url) {
    return '';
  }

  if (/^(?:[a-z]+:)?\/\//i.test(url)) {
    return url;
  }

  return url.startsWith('/') ? url : `/${url}`;
}

export function getTrackDisplayTitle(track) {
  const title = track?.title || '';
  const callerNames = Array.isArray(track?.callerNames) ? track.callerNames.filter(Boolean) : [];

  return callerNames.length > 0 ? `${title} - ${callerNames.join(', ')}` : title;
}

export function getWrappedTrackIndex(currentIndex, offset, trackCount) {
  if (!Number.isInteger(trackCount) || trackCount <= 0) {
    return -1;
  }

  return ((currentIndex + offset) % trackCount + trackCount) % trackCount;
}

export function getNextTrackIndex(currentIndex, trackCount) {
  return getWrappedTrackIndex(currentIndex, 1, trackCount);
}

export function getPreviousTrackIndex(currentIndex, trackCount) {
  return getWrappedTrackIndex(currentIndex, -1, trackCount);
}
