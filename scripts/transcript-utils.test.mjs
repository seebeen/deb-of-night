import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildManifest,
  buildSegments,
  estimateCredits,
  formatVtt,
  normalizeTranscript,
  validateNormalizedTranscript,
} from './transcript-utils.mjs';

test('estimateCredits applies the keyterms surcharge to total audio minutes', () => {
  const estimate = estimateCredits([60, 120.5], { keyterms: true });

  assert.equal(estimate.minutes, 3.0083);
  assert.equal(estimate.baseCredits, 993);
  assert.equal(estimate.estimatedCredits, 1192);
});

test('buildSegments groups words by punctuation and long pauses', () => {
  const words = [
    { text: 'Good', start: 0, end: 0.3, type: 'word' },
    { text: 'evening.', start: 0.35, end: 0.8, type: 'word' },
    { text: 'You', start: 2.4, end: 2.65, type: 'word' },
    { text: 'night', start: 2.7, end: 3.0, type: 'word' },
    { text: 'owls', start: 3.05, end: 3.4, type: 'word' },
  ];

  assert.deepEqual(buildSegments(words), [
    {
      index: 0,
      start: 0,
      end: 0.8,
      text: 'Good evening.',
      wordStart: 0,
      wordEnd: 1,
    },
    {
      index: 1,
      start: 2.4,
      end: 3.4,
      text: 'You night owls',
      wordStart: 2,
      wordEnd: 4,
    },
  ]);
});

test('normalizeTranscript preserves raw word timing and derives caption segments', () => {
  const raw = {
    text: 'Good evening. You night owls',
    language_code: 'en',
    words: [
      { text: 'Good', start: 0, end: 0.3, type: 'word', logprob: -0.1 },
      { text: 'evening.', start: 0.35, end: 0.8, type: 'word' },
      { text: 'You', start: 2.4, end: 2.65, type: 'word', speaker_id: 'speaker_0' },
      { text: 'night', start: 2.7, end: 3.0, type: 'word', speaker_id: 'speaker_0' },
      { text: 'owls', start: 3.05, end: 3.4, type: 'word', speaker_id: 'speaker_0' },
    ],
  };

  const normalized = normalizeTranscript(raw, {
    id: 'radio_loop_1',
    title: 'The Deb of Night #1',
    audioSrc: 'audio/radio_loop_1.mp3',
    duration: 426.370667,
    sha256: 'abc123',
  });

  assert.equal(normalized.id, 'radio_loop_1');
  assert.equal(normalized.language, 'en');
  assert.equal(normalized.words[0].index, 0);
  assert.equal(normalized.words[0].logprob, -0.1);
  assert.equal(normalized.words[2].speakerId, 'speaker_0');
  assert.equal(normalized.segments.length, 2);
  assert.doesNotThrow(() => validateNormalizedTranscript(normalized));
});

test('normalizeTranscript maps diarized speakers onto transcript metadata and segments', () => {
  const raw = {
    text: 'Hello, LA. Hi, Deb.',
    language_code: 'en',
    words: [
      { text: 'Hello,', start: 0, end: 0.3, type: 'word', speaker_id: 'speaker_0' },
      { text: ' ', start: 0.3, end: 0.35, type: 'spacing' },
      { text: 'LA.', start: 0.35, end: 0.8, type: 'word', speaker_id: 'speaker_0' },
      { text: ' ', start: 0.8, end: 0.9, type: 'spacing' },
      { text: 'Hi,', start: 0.9, end: 1.2, type: 'word', speakerId: 'speaker_1' },
      { text: ' ', start: 1.2, end: 1.25, type: 'spacing' },
      { text: 'Deb.', start: 1.25, end: 1.6, type: 'word', speakerId: 'speaker_1' },
    ],
  };

  const normalized = normalizeTranscript(raw, {
    id: 'radio_loop_1',
    title: 'The Deb of Night #1',
    audioSrc: 'audio/radio_loop_1.mp3',
    duration: 10,
    sha256: 'abc123',
  });

  assert.deepEqual(normalized.speakers, [
    { id: 'speaker_0', label: 'Speaker 1' },
    { id: 'speaker_1', label: 'Speaker 2' },
  ]);
  assert.equal(normalized.words[0].speakerId, 'speaker_0');
  assert.equal(normalized.words[4].speakerId, 'speaker_1');
  assert.deepEqual(
    normalized.segments.map(({ text, speakerId, speakerLabel, wordStart, wordEnd }) => ({
      text,
      speakerId,
      speakerLabel,
      wordStart,
      wordEnd,
    })),
    [
      {
        text: 'Hello, LA.',
        speakerId: 'speaker_0',
        speakerLabel: 'Speaker 1',
        wordStart: 0,
        wordEnd: 2,
      },
      {
        text: 'Hi, Deb.',
        speakerId: 'speaker_1',
        speakerLabel: 'Speaker 2',
        wordStart: 4,
        wordEnd: 6,
      },
    ],
  );
});

test('buildSegments splits speaker changes across spacing tokens and keeps text spacing clean', () => {
  const words = [
    { index: 0, text: 'Hello,', start: 0, end: 0.3, type: 'word', speakerId: 'speaker_0' },
    { index: 1, text: ' ', start: 0.3, end: 0.35, type: 'spacing' },
    { index: 2, text: 'LA.', start: 0.35, end: 0.8, type: 'word', speakerId: 'speaker_0' },
    { index: 3, text: ' ', start: 0.8, end: 0.9, type: 'spacing' },
    { index: 4, text: 'Hi,', start: 0.9, end: 1.2, type: 'word', speakerId: 'speaker_1' },
    { index: 5, text: ' ', start: 1.2, end: 1.25, type: 'spacing' },
    { index: 6, text: 'Deb.', start: 1.25, end: 1.6, type: 'word', speakerId: 'speaker_1' },
  ];

  assert.deepEqual(buildSegments(words), [
    {
      index: 0,
      start: 0,
      end: 0.8,
      text: 'Hello, LA.',
      wordStart: 0,
      wordEnd: 2,
      speakerId: 'speaker_0',
      speakerLabel: 'Speaker 1',
    },
    {
      index: 1,
      start: 0.9,
      end: 1.6,
      text: 'Hi, Deb.',
      wordStart: 4,
      wordEnd: 6,
      speakerId: 'speaker_1',
      speakerLabel: 'Speaker 2',
    },
  ]);
});

test('formatVtt emits deterministic WebVTT cues from segments', () => {
  const vtt = formatVtt([
    { index: 0, start: 0, end: 0.8, text: 'Good evening.' },
    { index: 1, start: 2.4, end: 3.4, text: 'You night owls' },
  ]);

  assert.equal(
    vtt,
    'WEBVTT\n\n' +
      '1\n00:00:00.000 --> 00:00:00.800\nGood evening.\n\n' +
      '2\n00:00:02.400 --> 00:00:03.400\nYou night owls\n',
  );
});

test('formatVtt prefixes cues with visible speaker labels', () => {
  const vtt = formatVtt([
    { index: 0, start: 0, end: 0.8, text: 'Hello, LA.', speakerLabel: 'Speaker 1' },
    { index: 1, start: 0.9, end: 1.6, text: 'Hi, Deb.', speakerLabel: 'Speaker 2' },
  ]);

  assert.equal(
    vtt,
    'WEBVTT\n\n' +
      '1\n00:00:00.000 --> 00:00:00.800\nSpeaker 1: Hello, LA.\n\n' +
      '2\n00:00:00.900 --> 00:00:01.600\nSpeaker 2: Hi, Deb.\n',
  );
});

test('validateNormalizedTranscript rejects unordered word timestamps', () => {
  assert.throws(
    () =>
      validateNormalizedTranscript({
        id: 'radio_loop_bad',
        title: 'Bad',
        audioSrc: 'audio/radio_loop_bad.mp3',
        duration: 10,
        sha256: 'abc',
        language: 'en',
        text: 'bad timing',
        words: [
          { index: 0, text: 'bad', start: 2, end: 3, type: 'word' },
          { index: 1, text: 'timing', start: 1, end: 1.5, type: 'word' },
        ],
        segments: [],
      }),
    /starts before previous word/,
  );
});

test('buildManifest summarizes transcript tracks', () => {
  const manifest = buildManifest([
    {
      id: 'radio_loop_1',
      title: 'The Deb of Night #1',
      audioSrc: 'audio/radio_loop_1.mp3',
      duration: 426.370667,
      sha256: 'abc123',
      language: 'en',
      text: 'Good evening.',
      words: [{ index: 0, text: 'Good', start: 0, end: 0.2, type: 'word' }],
      segments: [{ index: 0, start: 0, end: 0.8, text: 'Good evening.', wordStart: 0, wordEnd: 0 }],
    },
  ]);

  assert.deepEqual(manifest.tracks[0], {
    id: 'radio_loop_1',
    title: 'The Deb of Night #1',
    audioSrc: 'audio/radio_loop_1.mp3',
    transcriptSrc: 'assets/data/transcripts/radio_loop_1.json',
    captionsSrc: 'assets/data/transcripts/radio_loop_1.vtt',
    duration: 426.370667,
    sha256: 'abc123',
    language: 'en',
    wordCount: 1,
    segmentCount: 1,
  });
});
