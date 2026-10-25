// Checks the published files: every icon and file the page links to exists, and the metadata points at the right address.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { siteDir, indexFile } from './game.mjs';

const HOST = 'zero-hour.sunken.dev', ORIGIN = `https://${HOST}/`;
const head = fs.readFileSync(indexFile, 'utf8').split('</head>')[0];
const meta = (attr, name) => (head.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`)) || [])[1];
const exists = f => fs.existsSync(path.join(siteDir, f));

test('CNAME holds the custom domain and nothing else', () => {
  assert.equal(fs.readFileSync(path.join(siteDir, 'CNAME'), 'utf8').trim(), HOST);
});

test('GitHub Pages files are present', () => {
  for (const f of ['index.html', '404.html', 'CNAME', '.nojekyll', 'robots.txt', 'sitemap.xml', 'site.webmanifest', 'browserconfig.xml', 'zero-hour-manual.pdf', 'zero-hour-preview.png', 'zero-hour-preview@2x.png']) assert.ok(exists(f), f);
});

test('every local file the page links to exists', () => {
  const hrefs = [...head.matchAll(/<link [^>]*href="([^"]+)"/g)].map(m => m[1]).filter(h => !/^(https?:)?\/\//.test(h));
  assert.ok(hrefs.length >= 8, 'icon and manifest links');
  for (const h of hrefs) assert.ok(exists(h), 'linked but missing: ' + h);
});

test('metadata: canonical address, link preview and structured data use the real domain', () => {
  assert.equal((head.match(/<link rel="canonical" href="([^"]+)"/) || [])[1], ORIGIN);
  assert.equal(meta('property', 'og:url'), ORIGIN);
  assert.equal(meta('property', 'og:image'), ORIGIN + 'zero-hour-preview.png');
  assert.equal(meta('name', 'twitter:image'), ORIGIN + 'zero-hour-preview.png');
  assert.equal(meta('name', 'twitter:card'), 'summary_large_image');
  assert.equal(meta('property', 'og:image:width'), '1200');
  assert.equal(meta('property', 'og:image:height'), '630');
  assert.ok(meta('name', 'description').length > 60);
  const ld = JSON.parse(head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld.url, ORIGIN);
  assert.ok(ld['@type'].includes('VideoGame'));
});

test('the preview image is 1200 x 630 and the 2x copy is 2400 x 1260', () => {
  const size = f => { const b = fs.readFileSync(path.join(siteDir, f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  assert.deepEqual(size('zero-hour-preview.png'), [1200, 630]);
  assert.deepEqual(size('zero-hour-preview@2x.png'), [2400, 1260]);
});

test('the web manifest is valid and its icons exist', () => {
  const m = JSON.parse(fs.readFileSync(path.join(siteDir, 'site.webmanifest'), 'utf8'));
  assert.equal(m.short_name, 'Zero Hour');
  assert.ok(m.icons.some(i => i.sizes === '512x512' && i.purpose === 'maskable'));
  for (const i of m.icons) assert.ok(exists(i.src), i.src);
});

test('robots.txt and the sitemap name the domain', () => {
  assert.match(fs.readFileSync(path.join(siteDir, 'robots.txt'), 'utf8'), new RegExp(`Sitemap: ${ORIGIN}sitemap.xml`));
  assert.ok(fs.readFileSync(path.join(siteDir, 'sitemap.xml'), 'utf8').includes(`<loc>${ORIGIN}</loc>`));
});

test('favicon.ico holds 16, 32 and 48 pixel images', () => {
  const b = fs.readFileSync(path.join(siteDir, 'favicon.ico'));
  assert.equal(b.readUInt16LE(2), 1);
  const n = b.readUInt16LE(4), sizes = [];
  for (let i = 0; i < n; i++) sizes.push(b[6 + 16 * i]);
  assert.deepEqual(sizes, [16, 32, 48]);
});
