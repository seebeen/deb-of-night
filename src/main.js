import 'plyr/dist/plyr.css';
import Plyr from 'plyr';

import { getNextTrackIndex, getPreviousTrackIndex, normalizeTrackUrl } from './playlist.js';
import { startRainJitter } from './rain.js';
import { findActiveSegment, getDisplaySpeakerLabel } from './transcript.js';
import './styles.css';

const MANIFEST_URL = '/assets/data/transcripts/manifest.json';

const elements = {
  audio: document.querySelector('#player'),
  playlist: document.querySelector('[data-playlist]'),
  previous: document.querySelector('[data-previous]'),
  next: document.querySelector('[data-next]'),
  trackStatus: document.querySelector('[data-track-status]'),
  transcriptMeta: document.querySelector('[data-transcript-meta]'),
  lyrics: document.querySelector('[data-lyrics]'),
  transcriptList: document.querySelector('[data-transcript-list]'),
  rain: document.querySelector('.rain'),
};

const state = {
  tracks: [],
  currentIndex: 0,
  transcript: null,
  activeSegmentIndex: -1,
  segmentButtons: new Map(),
};

const player = new Plyr(elements.audio, {
  controls: ['play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'captions'],
  captions: {
    active: true,
    language: 'en',
    update: true,
  },
});

startRainJitter(elements.rain);
init();

async function init() {
  try {
    const manifest = await fetchJson(MANIFEST_URL);
    state.tracks = manifest.tracks.map((track) => ({
      ...track,
      audioSrc: normalizeTrackUrl(track.audioSrc),
      transcriptSrc: normalizeTrackUrl(track.transcriptSrc),
      captionsSrc: normalizeTrackUrl(track.captionsSrc),
    }));

    renderPlaylist();
    bindControls();
    await selectTrack(0);
  } catch (error) {
    elements.trackStatus.textContent = 'Unable to load playlist';
    elements.transcriptList.textContent = error.message;
  }
}

function bindControls() {
  elements.previous.addEventListener('click', () => {
    selectTrack(getPreviousTrackIndex(state.currentIndex, state.tracks.length), { autoplay: player.playing });
  });

  elements.next.addEventListener('click', () => {
    selectTrack(getNextTrackIndex(state.currentIndex, state.tracks.length), { autoplay: player.playing });
  });

  player.on('ended', () => {
    selectTrack(getNextTrackIndex(state.currentIndex, state.tracks.length), { autoplay: true });
  });

  player.on('timeupdate', () => {
    updateActiveSegment(player.currentTime);
  });
}

async function selectTrack(index, { autoplay = false } = {}) {
  const track = state.tracks[index];

  if (!track) {
    return;
  }

  state.currentIndex = index;
  state.transcript = null;
  state.activeSegmentIndex = -1;
  state.segmentButtons.clear();

  elements.trackStatus.textContent = track.title;
  elements.transcriptMeta.textContent = 'Loading...';
  elements.lyrics.textContent = '';
  elements.transcriptList.textContent = '';
  updatePlaylistSelection();

  player.source = {
    type: 'audio',
    title: track.title,
    sources: [
      {
        src: track.audioSrc,
        type: 'audio/mpeg',
      },
    ],
    tracks: [
      {
        kind: 'captions',
        label: 'English',
        srclang: 'en',
        src: track.captionsSrc,
        default: true,
      },
    ],
  };

  const transcript = await fetchJson(track.transcriptSrc);
  state.transcript = transcript;
  renderTranscript(transcript, track);
  updateActiveSegment(0);

  if (autoplay) {
    await player.play();
  }
}

function renderPlaylist() {
  elements.playlist.replaceChildren(
    ...state.tracks.map((track, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'playlist__item';
      button.dataset.trackIndex = String(index);
      button.innerHTML = `<span>${escapeHtml(track.title)}</span><small>${formatDuration(track.duration)}</small>`;
      button.addEventListener('click', () => {
        selectTrack(index, { autoplay: player.playing });
      });

      return button;
    }),
  );
}

function updatePlaylistSelection() {
  for (const button of elements.playlist.querySelectorAll('[data-track-index]')) {
    const isCurrent = Number(button.dataset.trackIndex) === state.currentIndex;
    button.classList.toggle('is-current', isCurrent);
    button.setAttribute('aria-current', isCurrent ? 'true' : 'false');
  }
}

function renderTranscript(transcript, track) {
  const segmentCount = track.segmentCount || transcript.segments.length;
  const wordCount = track.wordCount || transcript.words.length;
  elements.transcriptMeta.textContent = `${wordCount.toLocaleString()} words - ${segmentCount.toLocaleString()} segments`;

  const fragment = document.createDocumentFragment();

  for (const segment of transcript.segments) {
    const button = document.createElement('button');
    const speaker = getDisplaySpeakerLabel(segment.speakerLabel);

    button.type = 'button';
    button.className = 'transcript-segment';
    button.dataset.segmentIndex = String(segment.index);
    button.innerHTML = `
      <span class="transcript-segment__time">${formatClock(segment.start)}</span>
      <span class="transcript-segment__body">
        ${speaker ? `<strong>${escapeHtml(speaker)}</strong>` : ''}
        <span>${escapeHtml(segment.text)}</span>
      </span>
    `;
    button.addEventListener('click', () => {
      player.currentTime = segment.start;
      player.play();
    });

    state.segmentButtons.set(segment.index, button);
    fragment.append(button);
  }

  elements.transcriptList.replaceChildren(fragment);
}

function updateActiveSegment(currentTime) {
  const segment = findActiveSegment(state.transcript?.segments, currentTime);

  if (!segment || segment.index === state.activeSegmentIndex) {
    return;
  }

  const previous = state.segmentButtons.get(state.activeSegmentIndex);
  previous?.classList.remove('is-active');

  const current = state.segmentButtons.get(segment.index);
  current?.classList.add('is-active');
  current?.scrollIntoView({ block: 'nearest' });

  state.activeSegmentIndex = segment.index;
  renderLyrics(segment);
}

function renderLyrics(segment) {
  const segments = state.transcript?.segments || [];
  const visible = [segments[segment.index - 1], segment, segments[segment.index + 1]].filter(Boolean);

  elements.lyrics.replaceChildren(
    ...visible.map((item) => {
      const line = document.createElement('p');
      const speaker = getDisplaySpeakerLabel(item.speakerLabel);

      line.className = item.index === segment.index ? 'lyrics__line is-active' : 'lyrics__line';
      line.textContent = speaker ? `${speaker}: ${item.text}` : item.text;

      return line;
    }),
  );
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not load ${url}`);
  }

  return response.json();
}

function formatDuration(seconds) {
  const total = Math.round(Number(seconds) || 0);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;

  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function formatClock(seconds) {
  const total = Math.floor(Number(seconds) || 0);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;

  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
