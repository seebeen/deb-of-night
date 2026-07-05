import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const mainJs = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const stylesCss = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

test('transcript renders through one text surface', () => {
  assert.match(indexHtml, /data-transcript-list/);
  assert.doesNotMatch(indexHtml, /data-lyrics/);
  assert.doesNotMatch(mainJs, /\blyrics\b/);
  assert.doesNotMatch(mainJs, /\brenderLyrics\b/);
});

test('show title is styled to stay on one line', () => {
  const h1Block = stylesCss.match(/h1\s*{(?<body>[^}]*)}/)?.groups.body;

  assert.ok(h1Block, 'expected a top-level h1 style block');
  assert.match(h1Block, /white-space:\s*nowrap/);
  assert.doesNotMatch(h1Block, /max-width/);
});
