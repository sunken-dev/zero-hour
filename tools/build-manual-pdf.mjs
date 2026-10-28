// Builds the PDF manual from the game's own manual source and stores it inside the game page.
//
//   node tools/build-manual-pdf.mjs site/index.html
//
// It opens the stand-alone manual page (index.html?manual) in headless Chrome and reads manualHTML(), the same source
// as the on-screen manual, as a tree of elements. Typst typesets that tree with site/manual.typ and only the fonts in
// site/fonts (the page uses the same two to typeset a manual in the browser), with the manual's fingerprint as its revision. The result is written to zero-hour-manual.pdf next to the
// page and embedded in the page together with the fingerprint. The game only offers the embedded PDF while that
// fingerprint still matches the manual; if the manual changes and this script has not been re-run, its buttons print a
// fresh copy from the live manual instead.
//
// Needs the typst CLI on the PATH, or TYPST_PATH set to it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from './chrome.mjs';

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'site');

// Runs in the page. Turns the manual's HTML into plain data for the Typst template:
// text becomes a string, an element becomes { t: tag, c: class, k: children }, and an SVG keeps its markup in `svg`.
// Whitespace between block elements is dropped, as the browser does when it lays them out.
function manualTree() {
  const blocks = new Set(['div', 'section', 'nav', 'ul', 'ol', 'table', 'tbody', 'thead', 'tr']);
  const walk = n => {
    if (n.nodeType === Node.TEXT_NODE) return n.data.replace(/\s+/g, ' ');
    if (n.nodeType !== Node.ELEMENT_NODE) return null;
    const t = n.localName;
    if (t === 'svg') return { t, svg: new XMLSerializer().serializeToString(n) };
    let k = [...n.childNodes].map(walk).filter(x => x !== null);
    if (blocks.has(t)) k = k.filter(x => typeof x !== 'string' || x.trim());
    return { t, c: n.getAttribute('class') || '', k };
  };
  const root = document.createElement('div');
  root.innerHTML = window.__zh.manualHTML();
  return walk(root.firstElementChild);
}

export function typeset(tree, revision) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zero-hour-manual-'));
  try {
    fs.copyFileSync(path.join(siteDir, 'manual.typ'), path.join(dir, 'manual.typ'));
    fs.writeFileSync(path.join(dir, 'manual.json'), JSON.stringify(tree));
    const out = path.join(dir, 'manual.pdf');
    try {
      execFileSync(process.env.TYPST_PATH || 'typst', [
        'compile', '--root', dir, '--font-path', path.join(siteDir, 'fonts'), '--ignore-system-fonts', '--ignore-embedded-fonts',
        ...(revision ? ['--input', 'revision=' + revision] : []),
        path.join(dir, 'manual.typ'), out
      ], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
    } catch (e) {
      if (e.code === 'ENOENT') throw new Error('typst not found. Install it (https://typst.app) or set TYPST_PATH to the typst binary.');
      throw new Error('typst could not typeset the manual:\n' + (e.stderr || e.message));
    }
    return fs.readFileSync(out);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

export async function buildManualPdf(file) {
  file = path.resolve(file);
  const browser = await launch();
  let hash, tree;
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(file).href + '?manual', { waitUntil: 'load' });
    hash = await page.evaluate(() => window.__zh.manualFingerprint());
    tree = await page.evaluate(manualTree);
  } finally { await browser.close(); }
  const pdf = typeset(tree, hash);
  const pdfFile = path.join(path.dirname(file), 'zero-hour-manual.pdf');
  fs.writeFileSync(pdfFile, pdf);
  const slot = /<!--MANUAL-PDF:BEGIN-->[\s\S]*?<!--MANUAL-PDF:END-->/;
  const html = fs.readFileSync(file, 'utf8');
  if (!slot.test(html)) throw new Error('PDF slot not found in ' + file);
  const block = `<!--MANUAL-PDF:BEGIN--><script id="manual-pdf" type="application/octet-stream" data-hash="${hash}">${pdf.toString('base64')}</script><!--MANUAL-PDF:END-->`;
  fs.writeFileSync(file, html.replace(slot, () => block));
  return { hash, bytes: pdf.length, pdfFile };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await buildManualPdf(process.argv[2] || 'site/index.html');
  console.log(`manual fingerprint ${r.hash}, ${(r.bytes / 1024).toFixed(0)} KB -> ${r.pdfFile} (also embedded in the page)`);
}
