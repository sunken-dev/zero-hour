// Assembles the site that gets published: copies site/ to dist/, then rebuilds the PDF manual inside dist/ so the
// published PDF always matches the published manual, whatever state the committed copy was in.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManualPdf } from './build-manual-pdf.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'site'), dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(src, dist, { recursive: true });
const r = await buildManualPdf(path.join(dist, 'index.html'));
for (const f of ['index.html', 'CNAME', '.nojekyll', 'zero-hour-preview.png', 'favicon.ico', 'site.webmanifest', 'manual.typ', 'fonts/DejaVuSansMono.ttf', 'fonts/ChakraPetch-Regular.ttf']) {
  if (!fs.existsSync(path.join(dist, f))) throw new Error('missing from the build: ' + f);
}
console.log(`built ${dist}: manual fingerprint ${r.hash}, PDF ${(r.bytes / 1024).toFixed(0)} KB`);
