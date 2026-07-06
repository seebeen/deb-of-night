const LEGACY_RAIN_JITTER_PIXELS = 125;
const LEGACY_RAIN_INTERVAL_MS = 25;

export function createRainPosition(random = Math.random) {
  return `${LEGACY_RAIN_JITTER_PIXELS * random()}px ${LEGACY_RAIN_JITTER_PIXELS * random()}px`;
}

export function startRainJitter(element, { random = Math.random, intervalMs = LEGACY_RAIN_INTERVAL_MS } = {}) {
  if (!element || prefersReducedMotion()) {
    return null;
  }

  const update = () => {
    element.style.backgroundPosition = createRainPosition(random);
  };

  update();

  return window.setInterval(update, intervalMs);
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
