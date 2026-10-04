const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('site entry point references files included in the Pages artifact', () => {
  const dist = path.resolve(__dirname, '../dist');
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const references = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((reference) => !/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(reference));

  assert.ok(references.length > 0, 'index.html should reference local assets');
  for (const reference of references) {
    const asset = path.resolve(dist, reference.split(/[?#]/, 1)[0]);
    assert.ok(asset.startsWith(`${dist}${path.sep}`), `${reference} must stay inside dist`);
    assert.ok(fs.statSync(asset).isFile(), `${reference} must be a file in dist`);
  }
});
