const DEFAULT_CREDITS_PER_MINUTE = 330;
const KEYTERMS_SURCHARGE = 1.2;
const DEFAULT_MAX_SEGMENT_SECONDS = 6;
const DEFAULT_MAX_SEGMENT_WORDS = 14;
const DEFAULT_LONG_PAUSE_SECONDS = 1.2;

export function roundTo(value, places = 4) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

export function estimateCredits(durationsSeconds, { keyterms = false } = {}) {
  const totalSeconds = durationsSeconds.reduce((sum, duration) => sum + Number(duration || 0), 0);
  const minutes = roundTo(totalSeconds / 60, 4);
  const baseCredits = Math.round(minutes * DEFAULT_CREDITS_PER_MINUTE);
  const estimatedCredits = Math.round(baseCredits * (keyterms ? KEYTERMS_SURCHARGE : 1));

  return {
    minutes,
    baseCredits,
    estimatedCredits,
  };
}

export function normalizeTranscript(raw, track) {
  const words = (raw.words || []).map((word, index) => {
    const normalized = {
      index,
      text: String(word.text || ''),
      start: Number(word.start),
      end: Number(word.end),
      type: word.type || 'word',
    };

    if (word.speaker_id != null || word.speakerId != null) {
      normalized.speakerId = word.speaker_id ?? word.speakerId;
    }

    if (word.logprob != null) {
      normalized.logprob = word.logprob;
    }

    return normalized;
  });
  const speakers = buildSpeakers(words);

  const normalized = {
    id: track.id,
    title: track.title,
    audioSrc: track.audioSrc,
    duration: roundTo(Number(track.duration), 6),
    sha256: track.sha256,
    language: raw.language_code || raw.language || track.language || 'en',
    text: raw.text || joinWords(words),
    speakers,
    words,
    segments: buildSegments(words),
  };

  validateNormalizedTranscript(normalized);

  return normalized;
}

export function buildSegments(
  words,
  {
    maxSegmentSeconds = DEFAULT_MAX_SEGMENT_SECONDS,
    maxSegmentWords = DEFAULT_MAX_SEGMENT_WORDS,
    longPauseSeconds = DEFAULT_LONG_PAUSE_SECONDS,
  } = {},
) {
  const segments = [];
  let current = [];
  const speakerLabels = buildSpeakerLabelMap(words);
  const indexedWords = words.map((word, index) => ({
    ...word,
    index: word.index ?? index,
  }));

  function flush() {
    if (current.length === 0) {
      return;
    }

    const first = current[0];
    const last = current[current.length - 1];
    const speakerId = current.find((word) => word.speakerId != null)?.speakerId;
    const segment = {
      index: segments.length,
      start: first.start,
      end: last.end,
      text: joinWords(current),
      wordStart: first.index,
      wordEnd: last.index,
    };

    if (speakerId != null) {
      segment.speakerId = speakerId;
      segment.speakerLabel = speakerLabels.get(speakerId);
    }

    segments.push(segment);

    current = [];
  }

  for (const word of indexedWords) {
    if (!Number.isFinite(word.start) || !Number.isFinite(word.end) || !word.text) {
      continue;
    }

    if (isSpacingToken(word)) {
      continue;
    }

    if (current.length > 0) {
      const previous = current[current.length - 1];
      const pause = word.start - previous.end;
      const speakerChanged =
        word.speakerId != null && previous.speakerId != null && word.speakerId !== previous.speakerId;

      if (pause >= longPauseSeconds || speakerChanged) {
        flush();
      }
    }

    current.push(word);

    const first = current[0];
    const duration = word.end - first.start;
    const endsSentence = /[.!?]$/.test(word.text);

    if (endsSentence || duration >= maxSegmentSeconds || current.length >= maxSegmentWords) {
      flush();
    }
  }

  flush();

  return segments;
}

export function formatVtt(segments) {
  const cues = segments.map(
    (segment) => {
      const text = segment.speakerLabel ? `${segment.speakerLabel}: ${segment.text}` : segment.text;

      return `${segment.index + 1}\n${formatTimestamp(segment.start)} --> ${formatTimestamp(segment.end)}\n${text}\n`;
    },
  );

  return `WEBVTT\n\n${cues.join('\n')}`;
}

export function validateNormalizedTranscript(transcript) {
  const requiredStringFields = ['id', 'title', 'audioSrc', 'sha256', 'language', 'text'];

  for (const field of requiredStringFields) {
    if (typeof transcript[field] !== 'string' || transcript[field].length === 0) {
      throw new Error(`${transcript.id || 'transcript'} is missing ${field}`);
    }
  }

  if (!Number.isFinite(transcript.duration) || transcript.duration <= 0) {
    throw new Error(`${transcript.id} has invalid duration`);
  }

  if (!Array.isArray(transcript.words)) {
    throw new Error(`${transcript.id} words must be an array`);
  }

  let previousEnd = 0;

  transcript.words.forEach((word, index) => {
    if (word.index !== index) {
      throw new Error(`${transcript.id} word ${index} has mismatched index`);
    }

    if (!Number.isFinite(word.start) || !Number.isFinite(word.end)) {
      throw new Error(`${transcript.id} word ${index} has invalid timestamps`);
    }

    if (word.start < previousEnd) {
      throw new Error(`${transcript.id} word ${index} starts before previous word`);
    }

    if (word.end < word.start) {
      throw new Error(`${transcript.id} word ${index} ends before it starts`);
    }

    if (word.end > transcript.duration + 1) {
      throw new Error(`${transcript.id} word ${index} exceeds audio duration`);
    }

    previousEnd = word.end;
  });

  if (!Array.isArray(transcript.segments)) {
    throw new Error(`${transcript.id} segments must be an array`);
  }

  transcript.segments.forEach((segment, index) => {
    if (segment.index !== index) {
      throw new Error(`${transcript.id} segment ${index} has mismatched index`);
    }

    if (!Number.isFinite(segment.start) || !Number.isFinite(segment.end) || segment.end < segment.start) {
      throw new Error(`${transcript.id} segment ${index} has invalid timestamps`);
    }
  });
}

export function buildManifest(transcripts) {
  return {
    generatedAt: new Date().toISOString(),
    provider: 'elevenlabs',
    model: 'scribe_v2',
    tracks: transcripts.map((transcript) => ({
      id: transcript.id,
      title: transcript.title,
      audioSrc: transcript.audioSrc,
      transcriptSrc: `assets/data/transcripts/${transcript.id}.json`,
      captionsSrc: `assets/data/transcripts/${transcript.id}.vtt`,
      duration: transcript.duration,
      sha256: transcript.sha256,
      language: transcript.language,
      wordCount: transcript.words.length,
      segmentCount: transcript.segments.length,
    })),
  };
}

function joinWords(words) {
  return words
    .filter((word) => !isSpacingToken(word))
    .map((word) => word.text.trim())
    .join(' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
}

function buildSpeakers(words) {
  return [...buildSpeakerLabelMap(words)].map(([id, label]) => ({ id, label }));
}

function buildSpeakerLabelMap(words) {
  const speakers = new Map();

  for (const word of words) {
    if (word.speakerId == null || speakers.has(word.speakerId)) {
      continue;
    }

    speakers.set(word.speakerId, `Speaker ${speakers.size + 1}`);
  }

  return speakers;
}

function isSpacingToken(word) {
  return word.type === 'spacing' || String(word.text || '').trim().length === 0;
}

function formatTimestamp(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const wholeSeconds = Math.floor(safeSeconds % 60);
  const milliseconds = Math.round((safeSeconds - Math.floor(safeSeconds)) * 1000);

  return `${pad(hours)}:${pad(minutes)}:${pad(wholeSeconds)}.${String(milliseconds).padStart(3, '0')}`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}
