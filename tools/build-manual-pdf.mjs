// Builds the published PDF of the manual, zero-hour-manual.pdf next to the page.
//
//   node tools/build-manual-pdf.mjs site/index.html
//
// It opens the stand-alone manual page (index.html?manual) in headless Chrome and reads manualTree(): manualHTML(), the
// same source as the on-screen manual, as a tree of elements. Typst typesets that tree with site/manual.typ and only the
// fonts in site/fonts, with the manual's fingerprint as its revision.
//
// Needs the typst CLI on the PATH, or TYPST_PATH set to it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from './chrome.mjs';

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'site');

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
    tree = await page.evaluate(() => window.__zh.manualTree());
  } finally { await browser.close(); }
  const pdf = typeset(tree, hash);
  const pdfFile = path.join(path.dirname(file), 'zero-hour-manual.pdf');
  fs.writeFileSync(pdfFile, pdf);
  return { hash, bytes: pdf.length, pdfFile };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await buildManualPdf(process.argv[2] || 'site/index.html');
  console.log(`manual fingerprint ${r.hash}, ${(r.bytes / 1024).toFixed(0)} KB -> ${r.pdfFile}`);
}
