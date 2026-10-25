// Draws every icon from the Zero Hour mark (a countdown ring with the last stretch burnt, around a slashed zero).
//   npm run icons
// Writes favicon.svg, favicon.ico, PNG icons, the Apple touch icon, Android and maskable icons, a Windows tile and the
// Safari pinned-tab mask into site/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './chrome.mjs';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'site');
const BG = '#060b10';

// The mark on a 64 x 64 grid. `scale` shrinks it towards the centre (for the safe zone of maskable icons).
const mark = (scale = 1) => `<g transform="translate(32 32) scale(${scale}) translate(-32 -32)">
  <g fill="none" transform="rotate(-90 32 32)">
    <circle cx="32" cy="32" r="22" stroke="#43dfff" stroke-width="6.5" stroke-dasharray="100 200"/>
    <circle cx="32" cy="32" r="22" stroke="#ff3b5c" stroke-width="6.5" stroke-dasharray="0 104 31 200"/>
  </g>
  <ellipse cx="32" cy="32.5" rx="7.2" ry="11" fill="none" stroke="#d6eef3" stroke-width="4.4"/>
  <path d="M25.5 40.5 L38.5 24.5" stroke="#ffb224" stroke-width="3.6" stroke-linecap="round"/>
  <path d="M28.5 5.5 H35.5 L32 12 Z" fill="#ffb224"/>
</g>`;
const svg = (inner, w = 64) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${w}" height="${w}">${inner}</svg>`;
const rounded = `<rect width="64" height="64" rx="14" fill="${BG}"/><rect x=".75" y=".75" width="62.5" height="62.5" rx="13.5" fill="none" stroke="#43dfff" stroke-opacity=".35" stroke-width="1.5"/>`;
const square = `<rect width="64" height="64" fill="${BG}"/>`;

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${rounded + mark()}</svg>`;
const pinned = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="none" stroke="#000" transform="rotate(-90 32 32)"><circle cx="32" cy="32" r="22" stroke-width="6.5" stroke-dasharray="100 200"/></g>
<ellipse cx="32" cy="32.5" rx="7.2" ry="11" fill="none" stroke="#000" stroke-width="4.4"/>
<path d="M25.5 40.5 L38.5 24.5" stroke="#000" stroke-width="3.6" stroke-linecap="round"/><path d="M28.5 5.5 H35.5 L32 12 Z" fill="#000"/></svg>`;
fs.writeFileSync(path.join(out, 'favicon.svg'), faviconSvg + '\n');
fs.writeFileSync(path.join(out, 'safari-pinned-tab.svg'), pinned + '\n');

const browser = await launch();
const render = async (inner, size, file, transparent) => {
  const page = await browser.newPage();
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg(inner, size)}`);
  const buf = await page.screenshot({ type: 'png', omitBackground: transparent });
  await page.close();
  if (file) fs.writeFileSync(path.join(out, file), buf);
  return buf;
};
try {
  const p16 = await render(rounded + mark(), 16, 'favicon-16x16.png', true);
  const p32 = await render(rounded + mark(), 32, 'favicon-32x32.png', true);
  const p48 = await render(rounded + mark(), 48, null, true);
  await render(square + mark(.9), 180, 'apple-touch-icon.png', false);
  await render(rounded + mark(), 192, 'android-chrome-192x192.png', true);
  await render(rounded + mark(), 512, 'android-chrome-512x512.png', true);
  await render(square + mark(.66), 512, 'maskable-512x512.png', false);   // content kept inside the maskable safe zone
  await render(square + mark(.8), 150, 'mstile-150x150.png', false);
  // favicon.ico with 16, 32 and 48 px PNG images inside
  const imgs = [[16, p16], [32, p32], [48, p48]];
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(imgs.length, 4);
  let offset = 6 + 16 * imgs.length;
  const entries = imgs.map(([s, b]) => { const e = Buffer.alloc(16); e[0] = s; e[1] = s; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(b.length, 8); e.writeUInt32LE(offset, 12); offset += b.length; return e; });
  fs.writeFileSync(path.join(out, 'favicon.ico'), Buffer.concat([head, ...entries, ...imgs.map(i => i[1])]));
  console.log('icons written to', out);
} finally { await browser.close(); }
