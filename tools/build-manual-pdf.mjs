// Builds the published PDF of the manual, zero-hour-manual.pdf next to the page.
//
//   node tools/build-manual-pdf.mjs site/index.html
//
// The PDF comes from the page itself: the same pdfmake code its Download button uses (manualPdf), for the full manual.
// The page's folder is served over HTTP, because the page fetches its fonts from fonts/ (and pdfmake from jsDelivr), and
// opened in headless Chrome. The file is the same for the same manual, and carries the manual's fingerprint as its
// revision (in the PDF's subject), which the tests compare with the live manual.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './chrome.mjs';

export async function buildManualPdf(file) {
  file = path.resolve(file);
  const dir = path.dirname(file);
  const server = http.createServer((req, res) => {
    const f = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200); fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, r));
  const browser = await launch();
  let hash, pdf;
  try {
    const page = await browser.newPage();
    await page.goto(`http://localhost:${server.address().port}/${path.basename(file)}?manual`, { waitUntil: 'load' });
    hash = await page.evaluate(() => window.__zh.manualFingerprint());
    pdf = Buffer.from(await page.evaluate(async () => {
      const b = new Uint8Array(await (await fetch(await window.__zh.manualPdf({}))).arrayBuffer());
      let s = '';
      for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
      return btoa(s);
    }), 'base64');
  } finally { await browser.close(); server.close(); }
  const pdfFile = path.join(dir, 'zero-hour-manual.pdf');
  fs.writeFileSync(pdfFile, pdf);
  return { hash, bytes: pdf.length, pdfFile };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await buildManualPdf(process.argv[2] || 'site/index.html');
  console.log(`manual fingerprint ${r.hash}, ${(r.bytes / 1024).toFixed(0)} KB -> ${r.pdfFile}`);
}
