const assert = require('node:assert/strict');
const test = require('node:test');
const {versionAssets} = require('../scripts/version-assets.js');

test('local scripts and styles get the deploy version, replacing old ones', () => {
  const html = '<link rel="stylesheet" href="styles.css?v=old"><script src="charts/utils.js"></script><script src="app.js?v=x"></script>';
  assert.equal(versionAssets(html, 'abc123'),
    '<link rel="stylesheet" href="styles.css?v=abc123"><script src="charts/utils.js?v=abc123"></script><script src="app.js?v=abc123"></script>');
});

test('external URLs, images, and anchors are left alone', () => {
  const html = '<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet"><img src="assets/a.png"><a href="#x">x</a>';
  assert.equal(versionAssets(html, 'abc123'), html);
});
