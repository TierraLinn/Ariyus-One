const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const html = readFileSync('public/index.html', 'utf8');
const css = readFileSync('public/styles.css', 'utf8');

test('home page contains core Ariyus One sections and CTAs', () => {
  for (const expected of ['Ariyus One', 'Build what matters next', 'Platform', 'Workflow', 'Outcomes', 'Request access']) {
    assert.match(html, new RegExp(expected));
  }
});

test('home page links to stylesheet and defines responsive styles', () => {
  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /\.hero/);
});
