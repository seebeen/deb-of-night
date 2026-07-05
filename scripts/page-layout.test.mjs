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
