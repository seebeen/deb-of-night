#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

import {
  buildManifest,
  estimateCredits,
  formatVtt,
  normalizeTranscript,
  validateNormalizedTranscript,
} from './transcript-utils.mjs';

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
const AUDIO_DIR = path.join(ROOT, 'audio');
const RAW_DIR = path.join(ROOT, 'data/elevenlabs/raw');
const TRANSCRIPT_DIR = path.join(ROOT, 'assets/data/transcripts');

const KEYTERMS = [
  'Deb of Night',
  'Deb',
  'KTRK',
  'Vigo',
  'Gomez',
  'Vampire',
  'Masquerade',
  'Bloodlines',
  'Kindred',
  'fledgling',
  'Camarilla',
  'Anarch',
  'Sabbat',
  'Tremere',
  'Nosferatu',
  'Malkavian',
  'Toreador',
  'Ventrue',
  'Brujah',
  'Gangrel',
  'LaCroix',
  'Santa Monica',
  'Los Angeles',
  'Hollywood',
  'Downtown',
  'Chinatown',
  'Therese',
  'Jeanette',
  'Nines Rodriguez',
  'Smiling Jack',
];

const TRANSCRIPTION_OPTIONS = {
  modelId: 'scribe_v2',
  languageCode: 'en',
  timestampsGranularity: 'word',
  tagAudioEvents: true,
  diarize: true,
  temperature: 0,
  seed: 2600,
  keyterms: KEYTERMS,
};

const flags = new Set(process.argv.slice(2));

async function main() {
  if (flags.has('--help')) {
    printHelp();
    return;
  }

  if (flags.has('--validate')) {
    await validateGeneratedFiles();
    return;
  }

  const tracks = await discoverTracks();
  const estimate = estimateCredits(
    tracks.map((track) => track.duration),
    { keyterms: true },
  );

  printInventory(tracks, estimate);

  if (flags.has('--dry-run')) {
    return;
  }

  const apiKey = process.env.ELEVENLABS_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_KEY must be set to transcribe audio');
  }

  await mkdir(RAW_DIR, { recursive: true });
  await mkdir(TRANSCRIPT_DIR, { recursive: true });

  const client = new ElevenLabsClient({ apiKey });
  const normalizedTranscripts = [];

  for (const track of tracks) {
    const rawPath = rawOutputPath(track.id);
    let raw;

    if (!flags.has('--force') && (await fileExists(rawPath))) {
      console.log(`Reusing ${path.relative(ROOT, rawPath)}`);
      raw = JSON.parse(await readFile(rawPath, 'utf8'));
    } else {
      console.log(`Transcribing ${track.audioSrc}`);
      raw = await client.speechToText.convert(createTranscriptionOptions(track.absolutePath));
      await writeJson(rawPath, raw);
    }

    const normalized = normalizeTranscript(raw, track);
    normalizedTranscripts.push(normalized);

    await writeJson(path.join(TRANSCRIPT_DIR, `${track.id}.json`), normalized);
    await writeFile(path.join(TRANSCRIPT_DIR, `${track.id}.vtt`), formatVtt(normalized.segments), 'utf8');
  }

  await writeJson(path.join(TRANSCRIPT_DIR, 'manifest.json'), buildManifest(normalizedTranscripts));
  await validateGeneratedFiles();
}

export async function discoverTracks() {
  const files = (await readdir(AUDIO_DIR)).filter((file) => /^radio_loop_\d+\.mp3$/.test(file)).sort();

  return Promise.all(
    files.map(async (file) => {
      const absolutePath = path.join(AUDIO_DIR, file);
      const id = path.basename(file, '.mp3');
      const duration = await getDuration(absolutePath);
      const sha256 = await hashFile(absolutePath);

      return {
        id,
        title: `The Deb of Night #${id.replace('radio_loop_', '')}`,
        audioSrc: `audio/${file}`,
        absolutePath,
        duration,
        sha256,
        language: 'en',
      };
    }),
  );
}

async function getDuration(filePath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);

  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Unable to determine duration for ${filePath}`);
  }

  return duration;
}

async function hashFile(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

async function validateGeneratedFiles() {
  const manifestPath = path.join(TRANSCRIPT_DIR, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  if (!Array.isArray(manifest.tracks) || manifest.tracks.length !== 5) {
    throw new Error('manifest must contain five tracks');
  }

  for (const track of manifest.tracks) {
    const transcriptPath = path.join(ROOT, track.transcriptSrc);
    const captionsPath = path.join(ROOT, track.captionsSrc);
    const rawPath = rawOutputPath(track.id);

    await stat(rawPath);

    const transcript = JSON.parse(await readFile(transcriptPath, 'utf8'));
    validateNormalizedTranscript(transcript);

    const captions = await readFile(captionsPath, 'utf8');
    if (!captions.startsWith('WEBVTT\n\n')) {
      throw new Error(`${track.captionsSrc} is not a WebVTT file`);
    }
  }

  console.log('Transcript data validation passed');
}

export function printInventory(tracks, estimate) {
  for (const track of tracks) {
    console.log(`${track.audioSrc} ${track.duration.toFixed(6)}s ${track.sha256}`);
  }

  console.log(`Total minutes: ${estimate.minutes}`);
  console.log(`Base STT credits: ${estimate.baseCredits}`);
  console.log(`Estimated credits with keyterms: ${estimate.estimatedCredits}`);
  console.log(`Keyterms: ${KEYTERMS.length}`);
}

export function createTranscriptionOptions(filePath) {
  return {
    file: {
      path: filePath,
      filename: path.basename(filePath),
      contentType: 'audio/mpeg',
    },
    ...TRANSCRIPTION_OPTIONS,
  };
}

function rawOutputPath(id) {
  return path.join(RAW_DIR, `${id}.json`);
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

function printHelp() {
  console.log(`Usage: node scripts/transcribe-elevenlabs.mjs [--dry-run] [--force] [--validate]

Options:
  --dry-run   Print audio inventory and estimated credits without API calls.
  --force     Re-run ElevenLabs even if raw transcript JSON already exists.
  --validate  Validate committed raw, JSON, VTT, and manifest files.
`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
