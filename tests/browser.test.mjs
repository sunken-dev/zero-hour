// Drives the real page in headless Chrome. Needs Chrome: set CHROME_PATH (see tools/chrome.mjs).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from '../tools/chrome.mjs';
import { indexFile, BOOT } from './game.mjs';

let browser, testCopy;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const home = () => pathToFileURL(indexFile).href;

before(async () => {
  browser = await launch();
  // A copy of the page that exposes the game's internals and skips the interface, for driving modules directly.
  const html = fs.readFileSync(indexFile, 'utf8')
    .replace(BOOT, 'window.__t={Modules,makeBomb,rng,sfx,TOGGLE_RULES,MEM_TABLE,KNOB_TABLE,KNOB_DIRS,breakerWantUp,wireAnswer,ensureNeeds,COMBO_RULES};\n' + BOOT)
    .replace('buildDrawer();\n  showStart();', '');
  testCopy = path.join(os.tmpdir(), 'zero-hour-test.html');
  fs.writeFileSync(testCopy, html);
});
after(async () => { await browser?.close(); if (testCopy) fs.rmSync(testCopy, { force: true }); });

async function withPage(url, fn) {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 1500, height: 900 });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await fn(page);
  } finally { await page.close(); }
  assert.deepEqual(errors, [], 'the page threw errors');
}
const fresh = async page => {                               // empty storage, main screen ready
  await page.evaluate(() => localStorage.clear());
  await page.goto(home(), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.arm'); await sleep(300);
};
const clickText = (page, sel, text) => page.evaluate((sel, text) => [...document.querySelectorAll(sel)].find(b => b.textContent.trim() === text).click(), sel, text);
const T = { timeout: 90000 };

test('main screen: tagline, intro, and Settings and Manual side by side', T, () => withPage(home(), async page => {
  await page.waitForSelector('.arm');
  const r = await page.evaluate(() => ({
    tag: document.querySelector('.tagline').textContent,
    intro: [...document.querySelectorAll('.start p')].map(p => p.textContent).join(' '),
    row: [...document.querySelectorAll('.startrow button')].map(b => b.textContent),
    link: !!document.querySelector('.startrow a')
  }));
  assert.equal(r.tag, 'One team. One bomb. One manual.');
  assert.match(r.intro, /Inspect the case\./);
  assert.ok(!/three strikes/i.test(r.intro));
  assert.deepEqual(r.row, ['ARM THE BOMB', 'Settings', 'Manual']);
  assert.ok(!r.link);
}));

test('the embedded PDF is the one for the current manual, and the buttons open and download it', T, () => withPage(home(), async page => {
  await page.waitForSelector('.arm');
  const same = await page.evaluate(() => { const n = document.getElementById('manual-pdf'); return { match: n.dataset.hash === window.__zh.manualFingerprint(), head: atob(n.textContent.trim().slice(0, 8)).slice(0, 4) }; });
  assert.equal(same.match, true, 'the PDF is out of date: run npm run pdf');
  assert.equal(same.head, '%PDF');
  await clickText(page, '.startrow button', 'Manual'); await sleep(600);
  await page.evaluate(() => { window.__opened = null; window.open = u => { window.__opened = u; return null; }; });
  await page.click('.drawer [data-act=pdf-open]'); await sleep(300);
  const got = await page.evaluate(async () => { const b = new Uint8Array(await (await fetch(window.__opened)).arrayBuffer()); return { url: window.__opened.slice(0, 5), head: String.fromCharCode(...b.slice(0, 5)), n: b.length }; });
  assert.deepEqual([got.url, got.head], ['blob:', '%PDF-']);
  assert.ok(got.n > 50000);
}));

test('a stale PDF is never offered: the buttons print a fresh copy of the live manual instead', T, () => withPage(home(), async page => {
  await page.waitForSelector('.arm');
  await page.evaluate(() => { document.getElementById('manual-pdf').dataset.hash = 'stale'; document.querySelector('.drawer').classList.add('open'); });
  await sleep(700);
  const [popup] = await Promise.all([new Promise(res => page.once('popup', res)), page.click('.drawer [data-act=pdf-open]')]);
  await sleep(1200);
  const shown = await popup.evaluate(() => ({ h1: document.querySelector('.manual h1')?.textContent, n: document.querySelectorAll('.manual section').length }));
  assert.equal(shown.h1, 'Defusal manual');
  assert.equal(shown.n, 12);
}));

test('settings, time, module count and seed survive a reload; the same seed gives the same bomb', T, () => withPage(home(), async page => {
  await fresh(page);
  await page.click('.seedin'); await page.keyboard.type('hello world');
  await clickText(page, '.opt:nth-child(1) button', '8 min');
  await page.click('.setbtn'); await sleep(200);
  await page.evaluate(() => { const i = document.querySelectorAll('.sp input[type=range]')[1]; i.value = .3; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.keyboard.press('Escape'); await sleep(200);
  await page.goto(home(), { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.arm'); await sleep(300);
  const back = await page.evaluate(() => ({ seed: document.querySelector('.seedin').value, min: document.querySelector('.opt:nth-child(1) button[aria-pressed=true]').textContent }));
  assert.deepEqual(back, { seed: 'hello world', min: '8 min' });
  await page.click('.setbtn'); await sleep(200);
  assert.equal(await page.evaluate(() => document.querySelectorAll('.sp input[type=range]')[1].value), '0.3');
  await page.keyboard.press('Escape');
  const bomb = () => page.evaluate(() => ({ serial: document.querySelector('.w-serial b')?.textContent, mods: [...document.querySelectorAll('.f-front .mod h3')].map(h => h.textContent).join(','), chip: document.querySelector('.seedchip')?.textContent }));
  await page.click('.arm'); await sleep(2200);
  const a = await bomb();
  assert.equal(a.chip, 'Seed hello world');
  await clickText(page, '.tbtn', 'Abort'); await sleep(300); await clickText(page, '.confirm button', 'Abort'); await sleep(500);
  const last = await page.evaluate(() => { const r = document.querySelector('.seedlast'); return { text: r.innerText.replace(/\s+/g, ' '), cls: r.querySelector('button').className }; });
  assert.match(last.text, /Last bomb: hello world Use it/);
  assert.equal(last.cls, 'tbtn');
  await page.click('.arm'); await sleep(2200);
  assert.deepEqual(await bomb(), a);
}));

test('the difficulty chosen on the main screen survives a reload', T, () => withPage(home(), async page => {
  await fresh(page);
  await clickText(page, '.opt button', 'Hard'); await sleep(200);
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('.arm'); await sleep(300);
  const pressed = await page.evaluate(() => [...document.querySelectorAll('.opt button[aria-pressed=true]')].map(b => b.textContent));
  assert.ok(pressed.includes('Hard'), 'Hard is still chosen: ' + pressed.join(', '));
}));

test('Abort asks first, the clock keeps running behind the dialog, and a bomb that ends closes it', T, () => withPage(home(), async page => {
  await fresh(page);
  await page.click('.arm'); await sleep(2200);
  const clock = () => page.evaluate(() => document.querySelector('.hud .t').textContent);
  await clickText(page, '.tbtn', 'Abort'); await sleep(300);
  assert.ok(await page.evaluate(() => !!document.querySelector('.confirm')));
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Keep playing');
  const c1 = await clock(); await sleep(2200);
  assert.notEqual(await clock(), c1, 'the clock must keep running');
  await page.keyboard.press('Escape'); await sleep(200);
  assert.ok(await page.evaluate(() => !document.querySelector('.confirm') && !!document.querySelector('.game')));
  await clickText(page, '.tbtn', 'Abort'); await sleep(300);
  for (let i = 0; i < 12 && !(await page.evaluate(() => !!document.querySelector('.overlay'))); i++) {   // detonate it behind the dialog
    await page.evaluate(() => { const q = s => document.querySelector('.f-front ' + s); q('.go')?.click(); document.querySelectorAll('.f-front .key:not(.ok)').forEach((k, j) => { if (j === 1) k.click(); }); q('.wire:not(.cut)')?.click(); document.querySelector('.f-front .mk')?.click(); });
    await sleep(150);
  }
  await sleep(800);
  assert.ok(await page.evaluate(() => !!document.querySelector('.overlay')), 'the bomb should have gone off');
  assert.ok(await page.evaluate(() => !document.querySelector('.confirm')), 'the dialog should have closed itself');
  const btns = await page.evaluate(() => [...document.querySelectorAll('.overlay button')].map(b => b.textContent));
  assert.deepEqual(btns, ['Arm another bomb', 'Replay this seed', 'Change settings']);
}));

test('module viewer: every module shows its front and its rear plate (or the blank panel)', T, () => withPage(home(), async page => {
  await fresh(page);
  await page.click('.setbtn'); await sleep(200);
  await page.evaluate(() => [...document.querySelectorAll('.sp .srow')].find(r => r.textContent.startsWith('Module viewer')).querySelector('button').click());
  await sleep(1500);
  const items = await page.evaluate(() => [...document.querySelectorAll('.bench-item')].map(b => ({ title: b.firstChild.textContent, note: b.querySelector('small').textContent, rear: b.querySelector('small').textContent.includes('rear') })));
  for (const it of items) assert.match(it.note, /^(easy|medium|hard) · (front only|front and rear plate)$/, it.title);
  assert.equal(items.length, 11);
  for (let i = 0; i < items.length; i++) {
    await page.evaluate(i => document.querySelectorAll('.bench-item')[i].click(), i); await sleep(400);
    const r = await page.evaluate(() => ({ front: document.querySelector('.bench-stages .stage:nth-child(1) .mod h3')?.textContent, rear: !!document.querySelector('.bench-stages .stage:nth-child(2) .rear'), blank: !!document.querySelector('.bench-stages .stage:nth-child(2) .blank') }));
    assert.equal(r.front, items[i].title);
    assert.equal(items[i].rear ? r.rear : r.blank, true, items[i].title);
  }
  // linking the two views turns them together
  const yaws = () => page.evaluate(() => [...document.querySelectorAll('.bench-stage .bomb3d')].map(b => +/rotateY\((-?[\d.]+)deg/.exec(b.style.transform)[1]));
  await clickText(page, '.bench-tools .tbtn', 'Link views: off'); await sleep(900);
  const stage = await page.evaluate(() => { const r = document.querySelector('.bench-stage').getBoundingClientRect(); return { x: r.x + 60, y: r.y + r.height - 40 }; });
  await page.mouse.move(stage.x, stage.y); await page.mouse.down(); await page.mouse.move(stage.x + 140, stage.y - 30, { steps: 10 }); await page.mouse.up(); await sleep(1800);
  const [a, b] = await yaws();
  assert.ok(Math.abs(a - b) < 2, `linked views should match (${a} vs ${b})`);
  await page.keyboard.press('Escape'); await sleep(200);
  assert.ok(await page.evaluate(() => !document.querySelector('.bench')));
}));

test('rear plates show what their module needs', T, () => withPage(pathToFileURL(testCopy).href, async page => {
  const problems = await page.evaluate(() => {
    const T = window.__t, out = [];
    const rear = (id, bomb) => {
      const def = T.Modules.list.find(m => m.id === id), root = document.createElement('div');
      document.body.append(root); def.mountBack(root, def.create(bomb, T.rng(1)), { bomb, sfx: T.sfx }); return root;
    };
    const bombs = Array.from({ length: 40 }, (_, k) => T.makeBomb(T.rng(k + 1), 300000));
    const zero = T.makeBomb(T.rng(99), 300000); zero.serial = 'AB1CD0'; zero.serialOdd = false; zero.serialVowel = true;
    for (const bomb of [...bombs, zero]) {
      const last = Number(bomb.serial.slice(-1)), vowels = [...bomb.serial].filter(c => 'AEIOU'.includes(c)).join('');
      const w = rear('wires', bomb), si = rear('simon', bomb), sw = rear('switches', bomb), br = rear('breaker', bomb);
      if (w.querySelectorAll('.plug .pin').length !== last) out.push(`${bomb.serial}: wires plug has ${w.querySelectorAll('.plug .pin').length} pins`);
      if (si.querySelector('.cone-lbl')?.textContent !== (vowels || '—')) out.push(`${bomb.serial}: simon label ${si.querySelector('.cone-lbl')?.textContent}`);
      if (sw.querySelector('.backup')?.textContent !== (bomb.coins.length ? 'BACKUP FITTED' : 'BACKUP EMPTY')) out.push(`${bomb.serial}: switches backup ${sw.querySelector('.backup')?.textContent}`);
      if (br.querySelector('.trip')?.textContent !== String(last)) out.push(`${bomb.serial}: breaker trip ${br.querySelector('.trip')?.textContent}`);
      [w, si, sw, br].forEach(e => e.remove());
    }
    return out;
  });
  assert.deepEqual(problems, []);
}));

test('every module can be solved through its real controls, and a wrong answer is a strike', T, () => withPage(pathToFileURL(testCopy).href, async page => {
  const problems = await page.evaluate(async () => {
    const T = window.__t, out = [], sleep = ms => new Promise(r => setTimeout(r, ms));
    for (let seed = 1; seed <= 40; seed++) {
      const r = T.rng(seed), bomb = T.makeBomb(r, 300000);
      for (const def of T.Modules.list) {
        T.ensureNeeds(bomb, [def], r);
        const s = def.create(bomb, r), root = document.createElement('div'); document.body.append(root);
        let solved = false, strikes = 0;
        const ctl = { bomb, sfx: T.sfx, isSolved: () => solved, timeText: () => '04:12', solve() { solved = true; }, strike() { strikes++; } };
        const cleanup = def.mount(root, s, ctl) || null;
        const click = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const fail = m => out.push(`seed ${seed} ${def.id}: ${m}`);
        try {
          if (def.id === 'switches') {
            const want = s.lamps.map((on, k) => on !== T.TOGGLE_RULES[k][1](bomb));
            [...root.querySelectorAll('.tg')].forEach((tg, k) => { if (tg.classList.contains('up') !== want[k]) click(tg); });
            click(root.querySelector('.go')); if (!solved) fail('not solved');
          } else if (def.id === 'memory') {
            const hist = [];
            for (let st = 0; st < 5; st++) {
              const disp = +root.querySelector('.mini-lcd').textContent, labels = [...root.querySelectorAll('.mk .cap2>.t')].map(e => +e.textContent);
              const u = T.MEM_TABLE[st][disp - 1];
              const want = u.k === 'pos' ? u.n : u.k === 'label' ? labels.indexOf(u.n) + 1 : u.k === 'samePos' ? hist[u.s - 1].pos : labels.indexOf(hist[u.s - 1].label) + 1;
              hist.push({ pos: want, label: labels[want - 1] }); click(root.querySelectorAll('.mk')[want - 1]);
            }
            if (!solved || strikes) fail(`memory solved=${solved} strikes=${strikes}`);
          } else if (def.id === 'knob') {
            const lit = [...root.querySelectorAll('.pat .led')].map(l => l.classList.contains('off') ? '0' : '1').join('');
            const e = T.KNOB_TABLE.find(x => x[0] === lit); if (!e) { fail('pattern not in table ' + lit); }
            else {
              const dir = T.KNOB_DIRS.indexOf(e[1]); let turns = Math.round(parseFloat(root.querySelector('.kn').style.getPropertyValue('--ang')) / 90);
              while (turns % 4 !== dir) { click(root.querySelector('.kwrap')); turns++; }
              click(root.querySelector('.go')); if (!solved) fail('knob not solved');
            }
          } else if (def.id === 'breaker') {
            const n = +root.querySelector('.mini-lcd').textContent, lamp = root.querySelector('.led').style.getPropertyValue('--lc').includes('ff3b5c') ? 'red' : 'green';
            const want = T.breakerWantUp({ n, lamp }, bomb);
            bomb.lever.up = !want; click(root.querySelector('.go')); if (solved || strikes !== 1) fail('wrong lever did not strike');
            bomb.lever.up = want; click(root.querySelector('.go')); if (!solved) fail('breaker not solved');
          } else if (def.id === 'morse') {
            const lcd = root.querySelector('.mini-lcd'), arrows = [...root.querySelectorAll('.sk')]; let guard = 0;
            while (lcd.textContent !== s.word[1] + ' MHz' && guard++ < 20) click(arrows[1]);
            click(root.querySelector('.go')); if (!solved) fail('morse not solved');
          } else if (def.id === 'combination') {
            const cells = [...root.querySelectorAll('.mini-lcd')].map(e => +e.textContent);
            cells.forEach((d, i) => { bomb.encoders[i].value = (d + T.COMBO_RULES[i][1](bomb)) % 10; });
            click(root.querySelector('.go')); if (!solved) fail('combination not solved');
          } else if (def.id === 'wires') {
            const w = [...root.querySelectorAll('.wire')], ans = T.wireAnswer(s.wires, bomb);
            click(w[(ans + 1) % w.length]); if (strikes !== 1) fail('wrong wire did not strike');
            click(w[ans]); if (!solved) fail('wires not solved');
          }
        } catch (e) { fail('threw ' + e.message); }
        cleanup && cleanup(); root.remove(); await sleep(0);
      }
    }
    return out;
  });
  assert.deepEqual(problems, []);
}));
