import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from './game.mjs';

const g = loadGame();
const isPlate = k => k === 'serial' || k === 'plate';

// Everything the game builds for a seed, as plain data.
function world(seed, vw = 1360, count = 6, difficulty = 'medium') {
  const r = g.rng(seed), bomb = g.makeBomb(r, 300000), L = g.layoutFor(vw);
  const defs = g.pickModules(r, Math.min(count, L.cols * L.rows), difficulty);
  g.ensureNeeds(bomb, defs, r);
  const plan = g.planCase(r, bomb, L, defs.length);
  const states = defs.map(d => d.create(bomb, r));
  return { r, bomb, L, defs, plan, states };
}
const snapshot = seed => { const w = world(seed); return JSON.stringify({ b: w.bomb, d: w.defs.map(d => d.id), p: w.plan, s: w.states }); };

test('there are fifteen modules, at least half with a rear plate, and each explains itself', () => {
  assert.equal(g.Modules.list.length, 15);
  assert.ok(g.Modules.list.filter(m => m.mountBack).length * 2 >= g.Modules.list.length, 'at least half have a rear plate');
  for (const m of g.Modules.list) {
    assert.ok(m.id && m.title, 'id and title');
    assert.match(m.manual(), /\S/, `${m.id} manual`);
    if (m.mountBack) assert.match(m.manualBack(), /\S/, `${m.id} rear plate text`);
  }
});

test('every module has a difficulty: easy, medium or hard', () => {
  const want = { wires: 'easy', button: 'easy', glyphs: 'easy', knob: 'easy', simon: 'medium', password: 'medium', switches: 'medium',
    morse: 'medium', breaker: 'medium', combination: 'medium', memory: 'hard' };
  for (const m of g.Modules.list) {
    assert.ok(g.DIFFICULTIES.includes(m.difficulty), `${m.id}: ${m.difficulty}`);
    if (want[m.id]) assert.equal(m.difficulty, want[m.id], m.id);
  }
});

test('the chosen difficulty deals more modules of that difficulty, without excluding the others', () => {
  const share = {};
  for (const choice of g.DIFFICULTIES) {
    const n = { easy: 0, medium: 0, hard: 0 };
    for (let seed = 1; seed <= 2000; seed++) for (const d of g.pickModules(g.rng(seed), 6, choice)) n[d.difficulty]++;
    share[choice] = n;
  }
  for (const d of g.DIFFICULTIES) {
    for (const other of g.DIFFICULTIES) if (other !== d) assert.ok(share[d][d] > share[other][d], `${d} deals more ${d} modules than ${other} does`);
    for (const any of g.DIFFICULTIES) assert.ok(share[d][any] > 0, `${d} still deals ${any} modules`);
  }
});

test('dealing respects max and is the same for the same seed and difficulty', () => {
  for (let seed = 1; seed <= 500; seed++) {
    for (const choice of g.DIFFICULTIES) {
      const ids = g.pickModules(g.rng(seed), 6, choice).map(d => d.id);
      assert.deepEqual(g.pickModules(g.rng(seed), 6, choice).map(d => d.id), ids);
      for (const m of g.Modules.list) if (m.max) assert.ok(ids.filter(i => i === m.id).length <= m.max, `${m.id} at most ${m.max}`);
    }
  }
});

test('every module can be made for many bombs, and the rules always give a real answer', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const r = g.rng(seed), bomb = g.makeBomb(r, 300000);
    for (const def of g.Modules.list) {
      g.ensureNeeds(bomb, [def], r);
      const s = def.create(bomb, r);
      if (def.id === 'wires') {
        const a = g.wireAnswer(s.wires, bomb);
        assert.ok(a >= 0 && a < s.wires.length, `wire answer ${a} of ${s.wires.length}`);
      }
      if (def.id === 'password') {
        const fits = g.WORDS.filter(w => [...w].every((c, i) => s.cols[i].includes(c)));
        assert.deepEqual([...fits], [s.ans], 'exactly one word fits');
      }
      if (def.id === 'glyphs') assert.equal(new Set(s.order).size, 4);
      if (def.id === 'gears') {
        assert.ok(s.gears >= 3 && s.gears <= 6, 'three to six gears');
        assert.ok(s.dots.length >= 1 && s.dots.length <= 3 && new Set(s.dots).size === s.dots.length, 'one to three distinct red dots');
        assert.ok(s.dots.every(k => k >= 0 && k < s.gears), 'dots on real gears');
        const drum = s.load === 'LIFT' ? 'cw' : 'ccw', flip = { cw: 'ccw', ccw: 'cw' };
        assert.deepEqual({ ...g.gearsWant(s) }, { dir: s.gears % 2 ? drum : flip[drum], turns: s.dots.length });
      }
      if (def.id === 'fuses') {
        assert.deepEqual([...s.circuits].sort(), [...g.FUSE_CIRCUITS].sort(), 'each circuit once');
        assert.deepEqual([...s.amps].sort((x, y) => x - y), [...g.FUSE_AMPS], 'each rating once');
        const k = s.circuits.indexOf(g.fuseCircuit(bomb));
        assert.ok(k >= 0 && k < 5, 'the fuse to pull is on the module');
      }
      if (def.id === 'breaker') assert.ok(bomb.lever, 'breaker brings its lever');
      if (def.id === 'combination') assert.ok(bomb.encoders.length >= 3, 'combination brings its encoders');
    }
  }
});

test('relay logic: every dealt puzzle has exactly one jumper setting, and every such puzzle gets dealt', () => {
  const names = Object.keys(g.GATES), possible = new Set(), seen = new Set();
  for (const g1 of names) for (const g2 of names) for (const want of [0, 1]) if (g.relaySolutions(g1, g2, want).length === 1) possible.add(`${g1} ${g2} ${want}`);
  const def = g.Modules.list.find(m => m.id === 'relay');
  for (let seed = 1; seed <= 500; seed++) {
    const r = g.rng(seed), s = def.create(g.makeBomb(r, 300000), r);
    const sols = g.relaySolutions(s.g1, s.g2, s.want);
    assert.equal(sols.length, 1, `${s.g1} ${s.g2} ${s.want}`);
    assert.deepEqual([...g.relayAnswer(s)], [...sols[0]]);
    assert.equal(g.GATES[s.g2](g.GATES[s.g1](sols[0][0], sols[0][1]), sols[0][2]), s.want);
    seen.add(`${s.g1} ${s.g2} ${s.want}`);
  }
  assert.deepEqual([...seen].sort(), [...possible].sort());
  assert.equal(possible.size, 8);
});

test('coolant: the target pressure is between 1 and 9 and never above the relief valve', () => {
  const def = g.Modules.list.find(m => m.id === 'coolant');
  for (let seed = 1; seed <= 500; seed++) {
    const r = g.rng(seed), bomb = g.makeBomb(r, 300000), s = def.create(bomb, r);
    assert.ok(s.relief >= 4 && s.relief <= 8, 'relief 4 to 8');
    const raw = Math.max(1, Math.min(9, Number(bomb.serial.slice(-1)) + bomb.indicators.filter(i => i.lit).length - bomb.batteries));
    const t = g.coolantTarget(s, bomb);
    assert.equal(t, raw > s.relief ? s.relief - 1 : raw);
    assert.ok(t >= 1 && t <= 8);
  }
  const zero = g.makeBomb(g.rng(7), 300000);
  Object.assign(zero, { serial: 'AB1CD0', indicators: [], batteries: 2 });
  assert.equal(g.coolantTarget({ relief: 6 }, zero), 1, 'a serial ending in 0 still gives a reachable target');
});

test('placement: modules in the front bays, bottom carries plates only, tall lever on a side panel, nothing overlaps', () => {
  for (const vw of [1360, 600]) {
    for (let seed = 1; seed <= 1500; seed++) {
      const { bomb, L, plan } = world(seed, vw);
      const used = new Set(), count = k => plan.widgets.filter(w => w.kind === k).length;
      for (const w of plan.widgets) {
        assert.ok(w.at, 'every widget has a place');
        if (w.at.face === 'bottom') assert.ok(isPlate(w.kind), `${w.kind} must not be on the bottom`);
        if (w.kind === 'plate') assert.equal(w.at.face, 'bottom');
        if (w.kind === 'lever') { assert.ok(['left', 'right'].includes(w.at.face)); assert.equal(w.at.span, 2); }
        const max = ['left', 'right'].includes(w.at.face) ? L.wr : L.wc;
        for (let k = 0; k < (w.at.span || 1); k++) {
          const key = w.at.face + ':' + (w.at.i + k);
          assert.ok(!used.has(key), 'cells overlap ' + key); used.add(key);
          assert.ok(w.at.i + k < max, 'inside the face');
        }
      }
      assert.equal(count('serial'), 1);
      assert.equal(plan.widgets.filter(w => w.kind === 'batt').reduce((a, w) => a + w.n, 0), bomb.batteries);
      assert.equal(count('ind'), bomb.indicators.length);
      assert.equal(count('coin'), bomb.coins.length);
      assert.equal(count('enc'), bomb.encoders.length);
      assert.equal(count('lever'), bomb.lever ? 1 : 0);
      assert.ok(plan.bays.length <= L.cols * L.rows);
    }
  }
});

test('the same seed gives the same bomb, and a different seed gives a different one', () => {
  for (const seed of [1, 42, 424242, 999999]) assert.equal(snapshot(seed), snapshot(seed));
  assert.notEqual(snapshot(1), snapshot(2));
});

test('seeds: numbers are used as they are, words are hashed, case and spaces do not matter', () => {
  assert.equal(g.seedFrom(''), null);
  assert.equal(g.seedFrom('   '), null);
  assert.equal(g.seedFrom('424242'), 424242);
  assert.equal(g.seedFrom(' 424242 '), 424242);
  assert.equal(g.seedFrom('Hello World'), g.seedFrom('hello world'));
  assert.notEqual(g.seedFrom('hello'), g.seedFrom('world'));
  const n = g.randomSeed();
  assert.ok(n >= 100000 && n <= 999999);
});

test('the manual: Bomb basics is the appendix, with its schematics, no duplicate entries and no leftovers of removed parts', () => {
  const html = g.manualHTML();
  const basics = html.slice(html.indexOf('id="man-basics"'), html.indexOf('</section>', html.indexOf('id="man-basics"')));
  const names = [...basics.matchAll(/<li><b>([^<]+)<\/b>/g)].map(m => m[1]);
  assert.equal(new Set(names).size, names.length, 'duplicate bullets: ' + names.join(', '));
  for (const want of ['Rotate the case.', 'Serial number.', 'Batteries.', 'Coin cells.', 'Indicators.', 'Rotary encoders.', 'Knife switch.', 'Rear plates.', 'Strikes.', 'Modules.']) assert.ok(names.includes(want), 'missing: ' + want);
  assert.ok(!/half-circle|colored knob/.test(html), 'the old lever is still described');
  for (const m of g.Modules.list) assert.ok(html.includes(`id="man-${m.id}"`), `section for ${m.id}`);
  assert.ok(html.lastIndexOf('<section') === html.indexOf('<section id="man-basics" class="appendix">'), 'Bomb basics is the last section');
  assert.equal((basics.match(/<figure class="schem"><svg /g) || []).length, 5, 'one schematic each for the case, side parts, encoder, knife switch and module');
  assert.equal(g.manualFingerprint(), g.manualFingerprint());
});

test('settings start from sane defaults', () => {
  const s = g.settings;
  assert.ok(s.master >= 0 && s.master <= 1 && s.music >= 0 && s.music <= 1 && s.fx >= 0 && s.fx <= 1);
  assert.ok([3, 5, 8, 12].includes(s.minutes));
  assert.ok(s.count >= 2 && s.count <= 6);
  assert.ok([1, .85, .7].includes(s.startZoom));
  assert.equal(typeof s.seed, 'string');
});

test('the clock formats as minutes and seconds, then seconds and hundredths', () => {
  assert.equal(g.fmt(300000), '05:00');
  assert.equal(g.fmt(61000), '01:01');
  assert.equal(g.fmt(7430), '07.43');
  assert.equal(g.fmt(-5), '00.00');
});
