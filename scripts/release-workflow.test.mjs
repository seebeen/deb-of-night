import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('semantic-release is configured for GitHub releases on master', async () => {
  const config = await import('../release.config.mjs');

  assert.deepEqual(config.default.branches, ['master']);
  assert.equal(config.default.tagFormat, 'v${version}');
  assert.deepEqual(config.default.plugins, [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/github',
      {
        successComment: false,
        failComment: false,
        failTitle: false,
      },
    ],
  ]);
});

test('release workflow builds, releases, and deploys pages from master', async () => {
  const workflow = await readFile(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');

  assert.match(workflow, /name: Release and Deploy/);
  assert.match(workflow, /branches:\s*\n\s+- master/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /pages: write/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /RELEASE_TOKEN: \$\{\{ secrets\.OBLAKBOT_PAT \|\| github\.token \}\}/);
  assert.match(
    workflow,
    /RELEASE_GPG_PRIVATE_KEY: \$\{\{ secrets\.OBLAKBOT_GPG_KEY \|\| secrets\.GPG_PRIVATE_KEY \}\}/,
  );
  assert.match(workflow, /uses: crazy-max\/ghaction-import-gpg@v7/);
  assert.match(workflow, /if: \$\{\{ env\.RELEASE_GPG_PRIVATE_KEY != '' \}\}/);
  assert.match(workflow, /token: \$\{\{ env\.RELEASE_TOKEN \}\}/);
  assert.match(workflow, /gpg_private_key: \$\{\{ env\.RELEASE_GPG_PRIVATE_KEY \}\}/);
  assert.match(workflow, /passphrase: \$\{\{ env\.RELEASE_GPG_PASSPHRASE \}\}/);
  assert.match(workflow, /git_commit_gpgsign: true/);
  assert.match(workflow, /git_tag_gpgsign: true/);
  assert.match(workflow, /node-version: 24/);
  assert.match(workflow, /run: npm audit signatures/);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /run: npm run build/);
  assert.match(workflow, /uses: cycjimmy\/semantic-release-action@v4/);
  assert.match(workflow, /GITHUB_TOKEN: \$\{\{ env\.RELEASE_TOKEN \}\}/);
  assert.match(workflow, /github-actions\[bot\]/);
  assert.match(workflow, /uses: actions\/upload-pages-artifact@v5/);
  assert.match(workflow, /uses: actions\/deploy-pages@v5/);
  assert.match(workflow, /path: dist/);
});
