// Renders the link-preview images from the game itself: site/zero-hour-preview.png (1200 x 630) and
// site/zero-hour-preview@2x.png (2400 x 1260).
//
//   npm run preview [-- --seed 202] [-- --out some/folder]
//
// It starts a bomb with the given seed, freezes it at a tense moment (07.43 on the clock, one strike), photographs the
// case, and lays it out next to the logo and tagline. Uses the real fonts from node_modules, so the result does not
// depend on what is installed on the machine.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from './chrome.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : dflt; };
const seed = arg('seed', '202'), outDir = path.resolve(arg('out', path.join(root, 'site')));
const page0 = pathToFileURL(path.join(root, 'site', 'index.html')).href;

const fontFile = (pkg, w) => path.join(root, 'node_modules', '@fontsource', pkg, 'files', `${pkg}-latin-${w}-normal.woff2`);
const face = (family, pkg, w) => `@font-face{font-family:'${family}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(fontFile(pkg, w)).toString('base64')}) format('woff2')}`;
const fontCss = [300, 400, 500, 600, 700].map(w => face('Chakra Petch', 'chakra-petch', w)).join('\n') + '\n' + face('Share Tech Mono', 'share-tech-mono', 400);

const browser = await launch();
try {
  // 1. photograph the bomb
  const game = await browser.newPage();
  await game.setViewport({ width: 1700, height: 1000, deviceScaleFactor: 2 });
  await game.goto(page0, { waitUntil: 'domcontentloaded' });
  await game.addStyleTag({ content: fontCss });
  await game.evaluate(s => localStorage.setItem('zero-hour-settings-v1', JSON.stringify({ minutes: 5, count: 6, difficulty: 'medium', seed: String(s), intro: false, startZoom: 1, musicOn: false, fxOn: false })), seed);
  await game.goto(page0, { waitUntil: 'domcontentloaded' });
  await game.addStyleTag({ content: fontCss });
  await game.evaluate(() => document.fonts.load("700 20px 'Chakra Petch'"));
  await game.waitForSelector('.arm'); await new Promise(r => setTimeout(r, 1500));
  const logo = (await game.evaluate(() => document.querySelector('.lockup .logo-mark').outerHTML)).replace(/ class="tk" style="animation-delay:\d+ms"/g, '').replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"');
  await game.click('.arm'); await new Promise(r => setTimeout(r, 2600));
  await game.evaluate(() => {
    window.requestAnimationFrame = () => 0;                       // freeze the game so the staged moment stays put
    document.querySelector('.dock').style.display = 'none';
    const clock = document.querySelector('.clock'); clock.classList.add('low');
    clock.querySelector('.live').textContent = '07.43'; clock.querySelector('.ghost').textContent = '88.88';
    const bar = document.querySelector('.f-front .bar'); bar.classList.add('low-bar'); bar.firstChild.style.width = '2.5%';
    document.querySelector('.f-front .strike').classList.add('on');
  });
  await new Promise(r => setTimeout(r, 500));
  const box = await game.evaluate(() => {
    const els = [...document.querySelectorAll('.f-front,.f-right,.f-top,.f-left,.w-batt,.w-enc,.w-coin,.w-jb')].filter(e => e.getBoundingClientRect().width > 0);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    els.forEach(e => { const r = e.getBoundingClientRect(); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); });
    return { x0, y0, x1, y1 };
  });
  const pad = 50;
  const hero = await game.screenshot({ clip: { x: Math.max(0, box.x0 - pad), y: Math.max(0, box.y0 - pad), width: box.x1 - box.x0 + 2 * pad, height: box.y1 - box.y0 + 2 * pad } });
  await game.close();

  // 2. lay out the poster
  const html = `<!doctype html><meta charset="utf-8"><style>
${fontCss}
*{box-sizing:border-box}html,body{margin:0}
body{position:relative;width:1200px;height:630px;overflow:hidden;background:#060b10;color:#d6eef3;font-family:'Chakra Petch',sans-serif}
.bg{position:absolute;inset:0;background:radial-gradient(780px 540px at 76% 40%,#14465c 0,#0000 64%),radial-gradient(660px 580px at -4% 104%,#2d1862 0,#0000 62%),radial-gradient(520px 320px at 100% 0,#0b2a38 0,#0000 70%)}
.floor{position:absolute;left:50%;bottom:-150px;width:2000px;height:420px;transform:translateX(-50%) perspective(560px) rotateX(70deg);
  background:linear-gradient(#43dfff26 1px,#0000 1px) 0 0/70px 70px,linear-gradient(90deg,#43dfff26 1px,#0000 1px) 0 0/70px 70px;
  -webkit-mask:radial-gradient(closest-side,#000 25%,#0000 85%);mask:radial-gradient(closest-side,#000 25%,#0000 85%)}
.glow{position:absolute;right:50px;top:50px;width:560px;height:560px;background:radial-gradient(circle,#43dfff33,#0000 66%)}
.hero{position:absolute;right:14px;top:46px;height:540px;
  -webkit-mask-image:linear-gradient(90deg,#0000 0,#000 17%,#000 100%),linear-gradient(180deg,#000 0,#000 84%,#0000 100%);-webkit-mask-composite:source-in;
  mask-image:linear-gradient(90deg,#0000 0,#000 17%,#000 100%),linear-gradient(180deg,#000 0,#000 84%,#0000 100%);mask-composite:intersect}
.vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 46%,#0000 58%,#000b 100%)}
.left{position:absolute;left:64px;top:92px;width:520px}
.lockup{display:flex;align-items:center;gap:26px}
.mark{width:150px;height:150px;flex:none}
.word{width:330px}
.word b,.word span{display:block;font-size:100px;line-height:.9;text-align:justify;text-align-last:justify;letter-spacing:.05em}
.word b{font-weight:700}.word span{font-weight:300}
.tag{margin:44px 0 0;font-size:31px;letter-spacing:.02em;color:#e4f4f8}
.sub{margin:12px 0 0;font-size:21px;color:#8fa9b3;letter-spacing:.02em}
.pills{position:absolute;left:64px;bottom:50px;display:flex;gap:12px}
.pills i{font-style:normal;padding:8px 18px;font-size:17px;letter-spacing:.04em;color:#cfe9ef;background:#43dfff12;border:1px solid #43dfff55;
  clip-path:polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)}
</style>
<div class="bg"></div><div class="floor"></div><div class="glow"></div>
<img class="hero" src="data:image/png;base64,${Buffer.from(hero).toString('base64')}">
<div class="vig"></div>
<div class="left">
  <div class="lockup"><div class="mark">${logo}</div><div class="word"><b>ZERO</b><span>HOUR</span></div></div>
  <p class="tag">One team. One bomb. One manual.</p>
  <p class="sub">Inspect the case. Keep your cool.</p>
</div>
<div class="pills"><i>15 modules</i><i>3D bomb case</i><i>Seeded bombs</i></div>`;
  fs.mkdirSync(outDir, { recursive: true });
  for (const [scale, name] of [[1, 'zero-hour-preview.png'], [2, 'zero-hour-preview@2x.png']]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: scale });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(outDir, name), type: 'png' });
    await page.close();
  }
  console.log('preview images written to', outDir);
} finally { await browser.close(); }
