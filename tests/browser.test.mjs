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
    .replace(BOOT, 'window.__t={Modules,makeBomb,rng,sfx,TOGGLE_RULES,MEM_TABLE,KNOB_TABLE,KNOB_DIRS,breakerWantUp,wireAnswer,ensureNeeds,COMBO_RULES,throttleWant,mazeCanMove,resTotal,signalWant,fuseCircuit,gearsWant,relayAnswer,coolantTarget};\n' + BOOT)
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

test('main screen: tagline, intro, and Settings, Manual and Modules side by side', T, () => withPage(home(), async page => {
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
  assert.deepEqual(r.row, ['ARM THE BOMB', 'Settings', 'Manual', 'Modules']);
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
  assert.equal(shown.n, 21);
}));

test('settings, time, module count and seed survive a reload; the same seed gives the same bomb', T, () => withPage(home(), async page => {
  await fresh(page);
  await page.click('.seedin'); await page.keyboard.type('hello world');
  await clickText(page, '.opt:nth-child(1) button', '12 min');
  await page.click('.setbtn'); await sleep(200);
  await page.evaluate(() => { const i = document.querySelectorAll('.sp input[type=range]')[1]; i.value = .3; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.keyboard.press('Escape'); await sleep(200);
  await page.goto(home(), { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.arm'); await sleep(300);
  const back = await page.evaluate(() => ({ seed: document.querySelector('.seedin').value, min: document.querySelector('.opt:nth-child(1) button[aria-pressed=true]').textContent }));
  assert.deepEqual(back, { seed: 'hello world', min: '12 min' });
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

test('the case shows the chosen difficulty', T, () => withPage(home(), async page => {
  await fresh(page);
  await clickText(page, '.opt button', 'Hard'); await page.click('.arm'); await sleep(2200);
  const plate = await page.evaluate(() => { const p = document.querySelector('.f-front .diff-plate'); return p && { text: p.textContent.trim(), cls: p.className }; });
  assert.equal(plate.text, 'HARD');
  assert.match(plate.cls, /diff-hard/);
}));

test('Abort asks first, the clock keeps running behind the dialog, and a bomb that ends closes it', T, () => withPage(home(), async page => {
  await fresh(page);
  // with 4 modules on Medium, seed 94 deals Throttle and Gears: their first press always strikes, so the bomb can be detonated on purpose
  await clickText(page, '.opt button', '4'); await clickText(page, '.opt button', 'Medium');
  await page.click('.seedin'); await page.keyboard.type('94');
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
  const modules = await page.evaluate(() => [...document.querySelectorAll('.f-front .mod h3')].map(e => e.textContent));
  assert.ok(modules.includes('Throttle') && modules.includes('Gears'), 'seed 94 deals ' + modules.join(', '));
  for (let i = 0; i < 6 && !(await page.evaluate(() => !!document.querySelector('.overlay'))); i++) {   // detonate it behind the dialog
    await page.evaluate(() => document.querySelectorAll('.f-front .go').forEach(b => b.click()));
    await sleep(150);
  }
  await sleep(800);
  assert.ok(await page.evaluate(() => !!document.querySelector('.overlay')), 'the bomb should have gone off');
  assert.ok(await page.evaluate(() => !document.querySelector('.confirm')), 'the dialog should have closed itself');
  const btns = await page.evaluate(() => [...document.querySelectorAll('.overlay button')].map(b => b.textContent));
  assert.deepEqual(btns, ['Arm another bomb', 'Replay this seed', 'Change settings']);
}));

test('module explorer: opened from the main screen, sorted, steady when selecting, front and rear for every module', T, () => withPage(home(), async page => {
  await fresh(page);
  const diffClasses = await page.evaluate(() => [...document.querySelectorAll('.opt button')].filter(b => /^(Easy|Medium|Hard)$/.test(b.textContent)).map(b => b.className));
  assert.deepEqual(diffClasses.map(c => c.match(/diff-\w+/)?.[0]), ['diff-easy', 'diff-medium', 'diff-hard']);
  await clickText(page, '.startrow button', 'Modules'); await sleep(1500);
  const items = await page.evaluate(() => [...document.querySelectorAll('.bench-item')].map(b => ({ title: b.querySelector('.ttl').textContent, badges: [...b.querySelectorAll('.badge')].map(x => x.textContent), rear: !!b.querySelector('.badge.rear') })));
  assert.equal(items.length, 20);
  const rank = { easy: 0, medium: 1, hard: 2 };
  const diffs = items.map(it => it.badges.find(t => rank[t] !== undefined));
  for (let i = 1; i < items.length; i++) {
    const a = [rank[diffs[i - 1]], items[i - 1].title], b = [rank[diffs[i]], items[i].title];
    assert.ok(a[0] < b[0] || (a[0] === b[0] && a[1].localeCompare(b[1]) < 0), `${a[1]} before ${b[1]}`);
  }
  assert.ok(!(await page.evaluate(() => !!document.querySelector('.bench pre, .bench .seedin, .bench-log'))), 'no debug details in the explorer');
  const sizes = () => page.evaluate(() => [...document.querySelectorAll('.bench-item')].map(b => Math.round(b.getBoundingClientRect().height)));
  const before = await sizes();
  for (let i = 0; i < items.length; i++) {
    await page.evaluate(i => document.querySelectorAll('.bench-item')[i].click(), i); await sleep(400);
    assert.deepEqual(await sizes(), before, 'selecting an item must not change any item size');
    const r = await page.evaluate(() => ({ front: document.querySelector('.bench-stages .stage:nth-child(1) .mod h3')?.textContent, rear: !!document.querySelector('.bench-stages .stage:nth-child(2) .rear'), blank: !!document.querySelector('.bench-stages .stage:nth-child(2) .blank'), desc: document.querySelector('.bench-desc')?.textContent || '' }));
    assert.equal(r.front, items[i].title);
    assert.equal(items[i].rear ? r.rear : r.blank, true, items[i].title);
    assert.ok(r.desc.length >= 40, 'a description for ' + items[i].title);
  }
  // switching a module off and choosing its rear plate setting survive a reload
  await page.evaluate(() => [...document.querySelectorAll('.bench-item')].find(b => b.querySelector('.ttl').textContent === 'Wires').click()); await sleep(400);
  await page.click('.bench-side .cfg-enabled'); await clickText(page, '.bench-side .cfg-rear button', 'Never'); await sleep(200);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('zero-hour-settings-v1')).modules.wires);
  assert.deepEqual(saved, { off: true, rear: 'never' });
  assert.ok(await page.evaluate(() => !![...document.querySelectorAll('.bench-item')].find(b => b.querySelector('.ttl').textContent === 'Wires').querySelector('.badge.off')));
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

test('needy modules wake with a countdown, sleep once handled, strike when it runs out, and stop on cleanup', T, () => withPage(pathToFileURL(testCopy).href, async page => {
  const problems = await page.evaluate(async () => {
    const T = window.__t, out = [], sleep = ms => new Promise(r => setTimeout(r, ms));
    const awake = root => root.querySelector('.needy-lcd').classList.contains('awake');
    const until = async (cond, ms) => { const t0 = performance.now(); while (!cond() && performance.now() - t0 < ms) await sleep(20); return cond(); };
    const handle = {
      async coolant(root, s, back, bomb) {
        if (!root.querySelector('.idle-lamp .led.off')) return 'the IDLE lamp is still lit while awake';
        if (+root.querySelector('.demand').textContent !== s.demand) return 'the demand display does not show the demand';
        const target = T.coolantTarget(s, bomb), to = v => { while (s.valve < v) back.querySelector('.v-up').click(); while (s.valve > v) back.querySelector('.v-dn').click(); };
        to(target); const p0 = s.pressure; await sleep(300);
        if (s.valve !== p0 && s.pressure === p0) return 'the gauge on the front does not follow the valve turned on the back';
        s.pressure = s.valve; root.querySelector('.go').click();
      },
      breaker(root, s, back, bomb) {
        const n = +root.querySelector('.mini-lcd').textContent, lamp = root.querySelector('.led').style.getPropertyValue('--lc').includes('ff3b5c') ? 'red' : 'green';
        bomb.lever.up = T.breakerWantUp({ n, lamp }, bomb); root.querySelector('.go').click();
      },
      knob(root, s) {
        const lit = [...root.querySelectorAll('.pat .led')].map(l => l.classList.contains('off') ? '0' : '1').join('');
        const e = T.KNOB_TABLE.find(x => x[0] === lit); if (!e) return 'pattern not in table ' + lit;
        const dir = T.KNOB_DIRS.indexOf(e[1]); let turns = Math.round(parseFloat(root.querySelector('.kn').style.getPropertyValue('--ang')) / 90);
        while (turns % 4 !== dir) { root.querySelector('.kwrap').click(); turns++; }
        root.querySelector('.go').click();
      }
    };
    for (const def of T.Modules.list.filter(d => d.needy)) {
      for (let seed = 1; seed <= 3; seed++) {
        const r = T.rng(seed), bomb = T.makeBomb(r, 300000); T.ensureNeeds(bomb, [def], r);
        const s = def.create(bomb, r), root = document.createElement('div'), back = document.createElement('div'); document.body.append(root, back);
        let strikes = 0;
        const ctl = { bomb, sfx: T.sfx, timeScale: .02, isSolved: () => false, timeText: () => '04:12', solve() { out.push(def.id + ': a needy module called solve'); }, strike() { strikes++; } };
        const stop = def.mount(root, s, ctl), stopBack = def.mountBack ? def.mountBack(back, s, ctl) : null;
        const fail = m => out.push(`${def.id} seed ${seed}: ${m}`);
        if (awake(root)) fail('awake straight away');
        if (!await until(() => awake(root), 3000)) { fail('never woke'); continue; }
        const why = await handle[def.id](root, s, back, bomb); if (why) fail(why);
        if (awake(root) || strikes) fail(`handling it right did not put it to sleep without a strike (strikes ${strikes})`);
        if (!await until(() => awake(root), 4000)) fail('did not wake again');
        await until(() => strikes > 0, 3000);
        if (strikes !== 1) fail(`letting the countdown run out gave ${strikes} strikes`);
        if (awake(root)) fail('still awake after its countdown ran out');
        stop && stop(); stopBack && stopBack();
        await sleep(2500);
        if (strikes !== 1) fail('kept going after cleanup');
        root.remove(); back.remove();
      }
    }
    return out;
  });
  assert.deepEqual(problems, []);
}));

test('knobs turn by dragging round them, and a drag is not also a click', T, () => withPage(pathToFileURL(testCopy).href, async page => {
  const problems = await page.evaluate(() => {
    const T = window.__t, out = [], def = T.Modules.list.find(m => m.id === 'signal');
    const bomb = T.makeBomb(T.rng(1), 300000), s = def.create(bomb, T.rng(2)), root = document.createElement('div');
    root.style.cssText = 'position:fixed;left:40px;top:40px;width:240px'; document.body.append(root);
    def.mount(root, s, { bomb, sfx: T.sfx, isSolved: () => false, solve() {}, strike() {} });
    const knob = root.querySelector('.k-amp'), well = knob.querySelector('.sk-well'), value = () => +knob.querySelector('b').textContent;
    const drag = degrees => {
      const r = well.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, at = a => ({ clientX: cx + 30 * Math.sin(a * Math.PI / 180), clientY: cy - 30 * Math.cos(a * Math.PI / 180), pointerId: 1, bubbles: true });
      knob.dispatchEvent(new PointerEvent('pointerdown', at(0)));
      for (let a = 0; Math.abs(a) <= Math.abs(degrees); a += Math.sign(degrees) * 10) knob.dispatchEvent(new PointerEvent('pointermove', at(a)));
      knob.dispatchEvent(new PointerEvent('pointerup', at(degrees)));
      knob.dispatchEvent(new MouseEvent('click', { bubbles: true }));            // the browser clicks after a drag; it must not step again
    };
    const start = value(), up = start < 5 ? start + 1 : start - 1;
    drag(start < 5 ? 60 : -60);
    if (value() !== up) out.push(`dragging one step turned AMP from ${start} to ${value()}`);
    drag(start < 5 ? -60 : 60);
    if (value() !== start) out.push(`dragging back left AMP at ${value()}, not ${start}`);
    knob.click();
    if (value() === start) out.push('a plain click no longer steps the knob');
    return out;
  });
  assert.deepEqual(problems, []);
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
        if (def.needy) continue;                                   // needy modules have their own test
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
          } else if (def.id === 'morse') {
            const lcd = root.querySelector('.mini-lcd'), arrows = [...root.querySelectorAll('.sk')]; let guard = 0;
            while (lcd.textContent !== s.word[1] + ' MHz' && guard++ < 20) click(arrows[1]);
            click(root.querySelector('.go')); if (!solved) fail('morse not solved');
          } else if (def.id === 'combination') {
            const cells = [...root.querySelectorAll('.mini-lcd')].map(e => +e.textContent);
            cells.forEach((d, i) => { bomb.encoders[i].value = (d + T.COMBO_RULES[i][1](bomb)) % 10; });
            click(root.querySelector('.go')); if (!solved) fail('combination not solved');
          } else if (def.id === 'relay') {
            const jp = [...root.querySelectorAll('.jp')], set = want => jp.forEach((j, k) => { if (j.classList.contains('on') !== !!want[k]) click(j); });
            const ans = [...T.relayAnswer(s)];
            set(ans.map((v, k) => k === 2 ? 1 - v : v)); click(root.querySelector('.go'));
            if (strikes !== 1 || solved) fail('a wrong setting did not strike');
            if (root.querySelector('.out .led:not(.off)')) fail('the lamp lit after a wrong test');
            set(ans); click(root.querySelector('.go')); if (!solved) fail('relay not solved');
            click(jp[0]); click(root.querySelector('.go')); if (strikes !== 1) fail('a click after solving struck');
          } else if (def.id === 'signal') {
            const w = T.signalWant(s, bomb), knob = k => root.querySelector('.k-' + k), val = k => +knob(k).querySelector('b').textContent;
            const set = (k, v) => { let g = 0; while (val(k) !== v && g++ < 10) click(knob(k)); };
            set('freq', w.freq); set('amp', w.amp); set('phase', (w.phase + 90) % 360); click(root.querySelector('.go'));
            if (strikes !== 1 || solved) fail('a wrong phase did not strike');
            set('phase', w.phase); click(root.querySelector('.go')); if (!solved) fail('signal not solved');
            click(knob('amp')); click(root.querySelector('.go')); if (strikes !== 1) fail('a click after solving struck');
          } else if (def.id === 'resistors') {
            const digits = [...root.querySelectorAll('.digit')], val = () => +digits.map(d => d.querySelector('b').textContent).join('');
            const set = n => String(n).padStart(3, '0').split('').forEach((c, i) => { let g = 0; while (digits[i].querySelector('b').textContent !== c && g++ < 12) click(digits[i].querySelector('.up')); });
            const total = T.resTotal(s);
            set((total + 1) % 1000); click(root.querySelector('.go'));
            if (strikes !== 1 || solved) fail('a wrong total did not strike');
            set(total); if (val() !== total) fail('wheels show ' + val());
            click(root.querySelector('.go')); if (!solved) fail('resistors not solved');
            click(digits[0].querySelector('.up')); click(root.querySelector('.go')); if (strikes !== 1) fail('a click after solving struck');
            const back = document.createElement('div'); def.mountBack(back, s, ctl);
            if (back.querySelector('.wiring')?.dataset.kind !== s.wiring) fail('rear wiring ' + back.querySelector('.wiring')?.dataset.kind);
          } else if (def.id === 'cipher') {
            const wheels = [...root.querySelectorAll('.wheel')], letter = w => w.querySelector('.ltr').textContent;
            const setWord = word => wheels.forEach((w, i) => { let g = 0; while (letter(w) !== word[i] && g++ < 30) click(w.querySelector('.up')); });
            setWord(s.word === 'ALARM' ? 'BLAST' : 'ALARM'); click(root.querySelector('.go'));
            if (strikes !== 1 || solved) fail('a wrong word did not strike');
            setWord(s.word); click(root.querySelector('.go')); if (!solved) fail('cipher not solved');
            click(wheels[0].querySelector('.up')); click(root.querySelector('.go')); if (strikes !== 1) fail('a click after solving struck');
            const back = document.createElement('div'); def.mountBack(back, s, ctl);
            const digits = [...back.querySelectorAll('.rotor')].map(e => +e.textContent).reverse();
            if (digits.join() !== s.shifts.join()) fail('rear rotors ' + digits.join() + ' vs ' + s.shifts.join());
          } else if (def.id === 'maze') {
            const D = [[0, -1], [1, 0], [0, 1], [-1, 0]], btn = ['.mz-up', '.mz-right', '.mz-down', '.mz-left'];
            const me = () => { const e = root.querySelector('.mz-me'); return [+e.dataset.x, +e.dataset.y]; };
            const from = me(), wall = [0, 1, 2, 3].find(d => !T.mazeCanMove(s, from, d));
            click(root.querySelector(btn[wall]));
            if (strikes !== 1 || me().join() !== from.join()) fail('walking into a wall did not strike, or moved');
            const goal = [+root.querySelector('.mz-goal').dataset.x, +root.querySelector('.mz-goal').dataset.y];
            const seen = new Set([from.join()]), queue = [[from, []]]; let path = null;
            while (queue.length && !path) { const [p, steps] = queue.shift(); if (p.join() === goal.join()) { path = steps; break; }
              for (let d = 0; d < 4; d++) if (T.mazeCanMove(s, p, d)) { const q = [p[0] + D[d][0], p[1] + D[d][1]]; if (!seen.has(q.join())) { seen.add(q.join()); queue.push([q, [...steps, d]]); } } }
            if (!path) fail('no way to the goal');
            else { path.forEach(d => click(root.querySelector(btn[d]))); if (!solved || strikes !== 1) fail(`maze solved=${solved} strikes=${strikes}`); }
            click(root.querySelector(btn[0])); if (strikes !== 1) fail('a click after solving struck');
          } else if (def.id === 'throttle') {
            const notch = n => [...root.querySelectorAll('.notch')].find(e => e.textContent === String(n)), want = T.throttleWant(s, bomb);
            click(notch(want % 5 + 1)); click(root.querySelector('.go'));
            if (strikes !== 1 || solved) fail('engaging at the wrong position did not strike');
            click(notch(want)); click(root.querySelector('.go')); if (!solved) fail('throttle not solved');
            click(notch(1)); click(root.querySelector('.go')); if (strikes !== 1) fail('a click after solving struck');
          } else if (def.id === 'gears') {
            const want = T.gearsWant(s), turn = d => click(root.querySelector(d === 'cw' ? '.crank-cw' : '.crank-ccw'));
            turn(want.dir); turn(want.dir === 'cw' ? 'ccw' : 'cw');
            if (strikes !== 1 || root.querySelector('.turns').textContent !== '0') fail('a wrong turn did not strike and reset');
            for (let k = 0; k <= want.turns; k++) turn(want.dir);
            click(root.querySelector('.go')); if (strikes !== 2 || solved) fail('release after too many turns did not strike');
            for (let k = 0; k < want.turns; k++) turn(want.dir);
            click(root.querySelector('.go')); if (!solved) fail('gears not solved');
            turn(want.dir); click(root.querySelector('.go')); if (strikes !== 2) fail('a click after solving struck');
          } else if (def.id === 'fuses') {
            const f = [...root.querySelectorAll('.fuse')], ans = s.circuits.indexOf(T.fuseCircuit(bomb));
            click(f[(ans + 1) % 5]); if (strikes !== 1) fail('wrong fuse did not strike');
            click(f[ans]); if (!solved) fail('fuses not solved');
            click(f[(ans + 2) % 5]); if (strikes !== 1) fail('a click after solving struck');
            const back = document.createElement('div'); def.mountBack(back, s, ctl);
            const labels = [...back.querySelectorAll('.fuse-lbl')].map(e => e.textContent).reverse();
            if (labels.join() !== s.circuits.join()) fail('rear labels ' + labels.join() + ' vs ' + s.circuits.join());
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
