const fs = require('node:fs');
const path = require('node:path');

// Rewrites local .js/.css references in index.html to ?v=<version> so browsers
// fetch fresh assets after every deploy.
function versionAssets(html, version) {
  return html.replace(/\b(src|href)="((?![a-z][a-z\d+.-]*:|\/|#)[^"?#]+\.(?:js|css))(?:\?[^"#]*)?"/gi,
    (_, attribute, file) => `${attribute}="${file}?v=${version}"`);
}

if (require.main === module) {
  const [dist, version] = process.argv.slice(2);
  if (!dist || !version) throw new Error('Usage: node scripts/version-assets.js <dist> <version>');
  const file = path.join(dist, 'index.html');
  fs.writeFileSync(file, versionAssets(fs.readFileSync(file, 'utf8'), version));
}

module.exports = {versionAssets};
