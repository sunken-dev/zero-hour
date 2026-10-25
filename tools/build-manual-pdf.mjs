// Builds the PDF manual from the game's own manual source and stores it inside the game page.
//
//   node tools/build-manual-pdf.mjs site/index.html
//
// It opens the stand-alone manual page (index.html?manual) in headless Chrome, prints it to PDF with the manual's print
// stylesheet, writes zero-hour-manual.pdf next to the page, and embeds the same PDF in the page together with a
// fingerprint of the manual text. The game only offers the embedded PDF while that fingerprint still matches the manual;
// if the manual changes and this script has not been re-run, its buttons print a fresh copy from the live manual instead.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './chrome.mjs';

export async function buildManualPdf(file) {
  file = path.resolve(file);
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(file).href + '?manual', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const hash = await page.evaluate(() => window.__zh.manualFingerprint());
    await page.emulateMediaType('print');
    const pdf = await page.pdf({
      format: 'A4', printBackground: true, displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="font:8px Arial,sans-serif;color:#667;width:100%;text-align:center">Zero Hour defusal manual &mdash; page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
      margin: { top: '15mm', bottom: '18mm', left: '14mm', right: '14mm' }
    });
    const pdfFile = path.join(path.dirname(file), 'zero-hour-manual.pdf');
    fs.writeFileSync(pdfFile, pdf);
    const slot = /<!--MANUAL-PDF:BEGIN-->[\s\S]*?<!--MANUAL-PDF:END-->/;
    const html = fs.readFileSync(file, 'utf8');
    if (!slot.test(html)) throw new Error('PDF slot not found in ' + file);
    const block = `<!--MANUAL-PDF:BEGIN--><script id="manual-pdf" type="application/octet-stream" data-hash="${hash}">${Buffer.from(pdf).toString('base64')}</script><!--MANUAL-PDF:END-->`;
    fs.writeFileSync(file, html.replace(slot, () => block));
    return { hash, bytes: pdf.length, pdfFile };
  } finally { await browser.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await buildManualPdf(process.argv[2] || 'site/index.html');
  console.log(`manual fingerprint ${r.hash}, ${(r.bytes / 1024).toFixed(0)} KB -> ${r.pdfFile} (also embedded in the page)`);
}
