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

test('transcript panel is a clear disclosure control', () => {
  assert.match(indexHtml, /<details class="transcript"[^>]*data-transcript-details[^>]*open>/);
  assert.match(indexHtml, /<summary class="transcript__header"/);
  assert.match(indexHtml, /Hide transcript/);
  assert.match(indexHtml, /Show transcript/);
  assert.match(stylesCss, /\.transcript\[open\]/);
  assert.match(stylesCss, /\.transcript:not\(\[open\]\)/);
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

test('image layers use the original top-left composition', () => {
  const backgroundBlock = stylesCss.match(/\.background\s*{(?<body>[^}]*)}/)?.groups.body;
  const foregroundBlock = stylesCss.match(/\.foreground\s*{(?<body>[^}]*)}/)?.groups.body;

  assert.ok(backgroundBlock, 'expected a .background style block');
  assert.match(backgroundBlock, /left top \/ cover no-repeat/);
  assert.ok(foregroundBlock, 'expected a .foreground style block');
  assert.match(foregroundBlock, /left top \/ cover no-repeat/);
});
