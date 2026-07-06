import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const mainJs = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const stylesCss = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
const faviconSvg = await readTextIfExists('../public/favicon.svg');
const robotsTxt = await readTextIfExists('../public/robots.txt');
const sitemapXml = await readTextIfExists('../public/sitemap.xml');
const originalDescription =
  "The Deb of Night is a minor character in Vampire: The Masquerade - Bloodlines. She is a sassy late-night broadcast hostess on KTRK, and can be heard on the radio in the fledgling's haven and at various other locations throughout the city.";

async function readTextIfExists(path) {
  try {
    return await readFile(new URL(path, import.meta.url), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return '';
    }

    throw error;
  }
}

test('transcript renders through one text surface', () => {
  assert.match(indexHtml, /data-transcript-list/);
  assert.doesNotMatch(indexHtml, /data-lyrics/);
  assert.doesNotMatch(mainJs, /\blyrics\b/);
  assert.doesNotMatch(mainJs, /\brenderLyrics\b/);
});

test('page omits the show header', () => {
  assert.doesNotMatch(indexHtml, /show__header/);
  assert.doesNotMatch(indexHtml, /show-title/);
  assert.doesNotMatch(indexHtml, /<h1\b/);
});

test('content stack is anchored bottom right', () => {
  const contentBlock = stylesCss.match(/\.content\s*{(?<body>[^}]*)}/)?.groups.body;
  const showBlock = stylesCss.match(/\.show\s*{(?<body>[^}]*)}/)?.groups.body;
  const creditBlock = stylesCss.match(/\.credit\s*{(?<body>[^}]*)}/)?.groups.body;

  assert.ok(contentBlock, 'expected a .content style block');
  assert.match(contentBlock, /align-content:\s*end/);
  assert.match(contentBlock, /justify-items:\s*end/);
  assert.ok(showBlock, 'expected a .show style block');
  assert.match(showBlock, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.ok(creditBlock, 'expected a .credit style block');
  assert.match(creditBlock, /text-align:\s*right/);
});

test('player shell renders title, player, then playlist without skip controls', () => {
  const playerShell = indexHtml.match(/<div class="player-shell">(?<body>[\s\S]*?)<\/div>\s*<details class="transcript"/)?.groups.body;

  assert.ok(playerShell, 'expected player shell markup');
  assert.match(playerShell, /<div class="track-status" data-track-status>Loading\.\.\.<\/div>\s*<audio id="player"/);
  assert.match(playerShell, /<\/audio>\s*<div class="playlist" data-playlist aria-label="Tracks"><\/div>/);
  assert.doesNotMatch(indexHtml, /data-previous/);
  assert.doesNotMatch(indexHtml, /data-next/);
  assert.doesNotMatch(indexHtml, /track-controls/);
  assert.doesNotMatch(mainJs, /previous:\s*document\.querySelector/);
  assert.doesNotMatch(mainJs, /next:\s*document\.querySelector/);
  assert.doesNotMatch(mainJs, /getPreviousTrackIndex/);
});

test('player omits visible time and playlist durations', () => {
  assert.doesNotMatch(mainJs, /current-time/);
  assert.doesNotMatch(mainJs, /duration/);
  assert.doesNotMatch(mainJs, /formatDuration/);
  assert.doesNotMatch(mainJs, /<small>\$\{formatDuration\(track\.duration\)\}<\/small>/);
});

test('player panel is slightly larger', () => {
  const showBlock = getStyleBlock('.show');
  const playerShellBlock = getStyleBlock('.player-shell');
  const plyrBlock = getStyleBlock('.plyr');

  assert.ok(showBlock, 'expected a .show style block');
  assert.match(showBlock, /width:\s*min\(46rem,\s*100%\)/);
  assert.ok(playerShellBlock, 'expected a .player-shell style block');
  assert.match(playerShellBlock, /padding:\s*1\.25rem/);
  assert.match(playerShellBlock, /gap:\s*1rem/);
  assert.ok(plyrBlock, 'expected a .plyr style block');
  assert.match(plyrBlock, /font-size:\s*1\.05rem/);
});

test('transcript panel is a clear disclosure control', () => {
  assert.match(indexHtml, /<details class="transcript"[^>]*data-transcript-details>/);
  assert.doesNotMatch(indexHtml, /<details class="transcript"[^>]*data-transcript-details[^>]*open>/);
  assert.match(indexHtml, /<summary class="transcript__header"/);
  assert.match(indexHtml, /Hide transcript/);
  assert.match(indexHtml, /Show transcript/);
  assert.match(stylesCss, /\.transcript\[open\]/);
  assert.match(stylesCss, /\.transcript:not\(\[open\]\)/);
});

test('transcript visibility persists in localStorage', () => {
  assert.match(mainJs, /const TRANSCRIPT_OPEN_STORAGE_KEY = 'debofnight:transcript-open'/);
  assert.match(mainJs, /restoreTranscriptOpenState\(\)/);
  assert.match(mainJs, /persistTranscriptOpenState\(\)/);
  assert.match(mainJs, /localStorage\.getItem\(TRANSCRIPT_OPEN_STORAGE_KEY\)/);
  assert.match(mainJs, /localStorage\.setItem\(TRANSCRIPT_OPEN_STORAGE_KEY, String\(elements\.transcriptDetails\.open\)\)/);
});

test('transcript auto-follows only during playback', () => {
  assert.match(mainJs, /function shouldAutoFollowTranscript\(\)/);
  assert.match(mainJs, /elements\.transcriptDetails\.open && player\.playing/);
  assert.doesNotMatch(mainJs, /if \(elements\.transcriptDetails\.open\) \{\s*current\?\.scrollIntoView/s);
});

test('transcript heading stays visible above a manually scrollable list', () => {
  const transcriptBlock = getStyleBlock('.transcript');
  const headerBlock = getStyleBlock('.transcript__header');
  const listBlock = getStyleBlock('.transcript-list');
  const scrollbarBlock = getStyleBlock('.transcript-list::-webkit-scrollbar');
  const scrollbarThumbBlock = getStyleBlock('.transcript-list::-webkit-scrollbar-thumb');

  assert.ok(transcriptBlock, 'expected a .transcript style block');
  assert.match(transcriptBlock, /max-height:/);
  assert.ok(headerBlock, 'expected a .transcript__header style block');
  assert.match(headerBlock, /position:\s*sticky/);
  assert.match(headerBlock, /top:\s*0/);
  assert.ok(listBlock, 'expected a .transcript-list style block');
  assert.match(listBlock, /min-height:\s*0/);
  assert.match(listBlock, /overflow-y:\s*auto/);
  assert.match(listBlock, /overscroll-behavior:\s*contain/);
  assert.match(listBlock, /scrollbar-color:\s*var\(--accent\) transparent/);
  assert.match(listBlock, /scrollbar-width:\s*thin/);
  assert.ok(scrollbarBlock, 'expected a webkit scrollbar style block');
  assert.match(scrollbarBlock, /width:\s*0\.55rem/);
  assert.ok(scrollbarThumbBlock, 'expected a webkit scrollbar thumb style block');
  assert.match(scrollbarThumbBlock, /background:\s*linear-gradient/);
  assert.match(scrollbarThumbBlock, /border-radius:\s*999px/);
});

test('page exposes favicon and complete social metadata', () => {
  assert.match(indexHtml, new RegExp(`<meta name="description" content="${escapeRegExp(originalDescription)}">`));
  assert.match(indexHtml, new RegExp(`<meta property="og:description" content="${escapeRegExp(originalDescription)}">`));
  assert.match(indexHtml, new RegExp(`<meta name="twitter:description" content="${escapeRegExp(originalDescription)}">`));
  assert.match(indexHtml, /<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg">/);
  assert.match(indexHtml, /<link rel="canonical" href="https:\/\/debofnight\.com\/">/);
  assert.match(indexHtml, /<meta name="robots" content="index, follow">/);
  assert.match(indexHtml, /<meta property="og:type" content="website">/);
  assert.match(indexHtml, /<meta property="og:url" content="https:\/\/debofnight\.com\/">/);
  assert.match(indexHtml, /<meta property="og:image" content="https:\/\/debofnight\.com\/assets\/img\/fb\.jpg">/);
  assert.match(indexHtml, /<meta property="og:image:width" content="1280">/);
  assert.match(indexHtml, /<meta property="og:image:height" content="720">/);
  assert.match(indexHtml, /<meta property="og:image:alt" content="The Deb of Night radio archive">/);
  assert.match(indexHtml, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(indexHtml, /<meta name="twitter:image" content="https:\/\/debofnight\.com\/assets\/img\/fb\.jpg">/);

  assert.match(faviconSvg, /<svg\b/);
  assert.match(robotsTxt, /Allow: \//);
  assert.match(robotsTxt, /Sitemap: https:\/\/debofnight\.com\/sitemap\.xml/);
  assert.match(sitemapXml, /<loc>https:\/\/debofnight\.com\/<\/loc>/);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getStyleBlock(selector) {
  for (const match of stylesCss.matchAll(/(?<selector>[^{}]+)\s*{(?<body>[^}]*)}/g)) {
    if (match.groups.selector.trim() === selector) {
      return match.groups.body;
    }
  }

  return null;
}

test('image layers use the original top-left composition', () => {
  const backgroundBlock = stylesCss.match(/\.background\s*{(?<body>[^}]*)}/)?.groups.body;
  const foregroundBlock = stylesCss.match(/\.foreground\s*{(?<body>[^}]*)}/)?.groups.body;

  assert.ok(backgroundBlock, 'expected a .background style block');
  assert.match(backgroundBlock, /left top \/ cover no-repeat/);
  assert.doesNotMatch(stylesCss, /\.background::after/);
  assert.ok(foregroundBlock, 'expected a .foreground style block');
  assert.match(foregroundBlock, /left top \/ cover no-repeat/);
});
