import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from './game.mjs';

const g = loadGame();
const isPlate = k => k === 'serial' || k === 'plate';

// Everything the game builds for a seed, as plain data.
function world(seed, vw = 1360, count = 6, difficulty = 'medium') {
  const r = g.rng(seed), bomb = g.makeBomb(r, 300000), L = g.layoutFor(vw, count);
  const defs = g.pickModules(r, Math.min(count, L.cols * L.rows), difficulty);
  g.ensureNeeds(bomb, defs, r);
  const plan = g.planCase(r, bomb, L, defs.length);
  const states = defs.map(d => d.create(bomb, r));
  return { r, bomb, L, defs, plan, states };
}
const snapshot = seed => { const w = world(seed); return JSON.stringify({ b: w.bomb, d: w.defs.map(d => d.id), p: w.plan, s: w.states }); };

test('25 modules: 7 easy, 10 medium, 8 hard, 17 with a rear plate, 3 needy, and each explains itself', () => {
  assert.equal(g.Modules.list.length, 25);
  const count = d => g.Modules.list.filter(m => m.difficulty === d).length;
  assert.deepEqual([count('easy'), count('medium'), count('hard')], [7, 10, 8]);
  assert.equal(g.Modules.list.filter(m => m.mountBack).length, 17);
  assert.deepEqual([...g.Modules.list.filter(m => m.needy).map(m => m.id)].sort(), ['breaker', 'coolant', 'knob']);
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
  assert.ok(share.hard.easy < share.medium.easy, 'hard deals fewer easy modules than medium does');
  assert.ok(share.easy.hard < share.medium.hard, 'easy deals fewer hard modules than medium does');
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

test('every module describes itself for players, and the explorer lists them by difficulty, then title', () => {
  for (const m of g.Modules.list) {
    assert.equal(typeof m.description, 'string', m.id);
    assert.ok(m.description.length >= 40 && m.description.length <= 400, `${m.id}: ${m.description.length} chars`);
    assert.ok(!/[<>]/.test(m.description), `${m.id}: plain text`);
  }
  const order = [...g.sortModules(g.Modules.list)].map(m => m.id);
  const want = [...g.Modules.list].sort((a, b) => g.DIFFICULTIES.indexOf(a.difficulty) - g.DIFFICULTIES.indexOf(b.difficulty) || a.title.localeCompare(b.title)).map(m => m.id);
  assert.deepEqual(order, want);
});

test('module configuration: switched-off modules are never dealt, and optional rear plates follow their setting', () => {
  const off = { wires: { off: true }, memory: { off: true }, gears: { off: true } };
  for (let seed = 1; seed <= 500; seed++) for (const d of g.DIFFICULTIES) {
    const ids = [...g.pickModules(g.rng(seed), 6, d, off)].map(m => m.id);
    for (const id of Object.keys(off)) assert.ok(!ids.includes(id), `${id} is switched off`);
  }
  const optional = [...g.Modules.list.filter(m => m.rearOptional).map(m => m.id)].sort();
  assert.deepEqual(optional, ['breaker', 'dip', 'glyphs', 'meter', 'safe', 'semaphore', 'simon', 'switches', 'tiles', 'wires']);
  const wires = g.Modules.list.find(m => m.id === 'wires'), fuses = g.Modules.list.find(m => m.id === 'fuses'), button = g.Modules.list.find(m => m.id === 'button');
  const outcomes = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    assert.equal(g.rearFor(g.rng(seed), wires, {}), true, 'always by default');
    assert.equal(g.rearFor(g.rng(seed), wires, { wires: { rear: 'never' } }), false);
    assert.equal(g.rearFor(g.rng(seed), fuses, { fuses: { rear: 'never' } }), true, 'a required rear plate ignores the setting');
    assert.equal(g.rearFor(g.rng(seed), button, {}), false, 'no rear plate, no rear');
    const a = g.rearFor(g.rng(seed), wires, { wires: { rear: 'sometimes' } });
    assert.equal(g.rearFor(g.rng(seed), wires, { wires: { rear: 'sometimes' } }), a, 'same seed, same outcome');
    outcomes.add(a);
  }
  assert.equal(outcomes.size, 2, 'sometimes means both happen');
});

test('needy modules: Knob, Breaker and Coolant at most; dealing keeps to the needy limits', () => {
  const needy = g.Modules.list.filter(m => m.needy).map(m => m.id);
  assert.ok(needy.every(id => ['knob', 'breaker', 'coolant'].includes(id)), needy.join());
  assert.ok(needy.includes('knob') && needy.includes('breaker'));
  for (const d of g.DIFFICULTIES) for (let count = 2; count <= 9; count++) {
    const limit = count <= 2 ? 0 : (d === 'easy' || count < 6) ? 1 : 2;
    let most = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const defs = [...g.pickModules(g.rng(seed), count, d)];
      const n = defs.filter(m => m.needy).length;
      assert.ok(n <= limit, `${d}, ${count} modules: ${n} needy`);
      assert.equal(defs.length, count, 'a full bomb');
      assert.ok(defs.some(m => !m.needy), 'something to defuse');
      const ids = defs.filter(m => m.needy).map(m => m.id);
      assert.equal(new Set(ids).size, ids.length, 'each needy module once');
      most = Math.max(most, n);
    }
    if (limit) assert.ok(most >= 1, `${d}, ${count}: needy modules do get dealt`);
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
      if (def.id === 'signal') {
        assert.ok(g.SIGNAL_WAVES.includes(s.wave) && s.peaks >= 1 && s.peaks <= 4);
        const w = g.signalWant(s, bomb), lit = bomb.indicators.filter(i => i.lit).length;
        assert.equal(w.freq, Math.min(5, s.peaks + lit));
        assert.equal(w.amp, { sine: 3, square: 5, saw: 2, triangle: 4 }[s.wave]);
        assert.equal(w.phase, [[0, 90], [180, 270]][bomb.serialOdd ? 1 : 0][bomb.coins.length ? 1 : 0]);
      }
      if (def.id === 'resistors') {
        assert.equal(s.r.length, 3); assert.ok(s.r.every(v => g.RES_VALUES.includes(v)), 'known values');
        assert.ok(['series', 'mixed'].includes(s.wiring));
        if (s.wiring === 'mixed') assert.equal(s.r[1], s.r[2], 'the parallel pair is equal');
        const total = s.wiring === 'series' ? s.r[0] + s.r[1] + s.r[2] : s.r[0] + s.r[1] / 2;
        assert.equal(g.resTotal(s), total);
        assert.ok(Number.isInteger(total) && total <= 999, 'a whole number of ohms up to 999');
        for (const v of s.r) {
          const [a, b, m] = g.resBands(v);
          assert.equal((g.BAND_COLORS.indexOf(a) * 10 + g.BAND_COLORS.indexOf(b)) * (m === 'brown' ? 10 : 1), v, 'bands spell the value');
        }
      }
      if (def.id === 'cipher') {
        assert.ok(g.CIPHER_WORDS.includes(s.word), 'a word from the list');
        assert.equal(s.shifts.length, 5); assert.ok(s.shifts.every(d => d >= 0 && d <= 9));
        assert.equal(s.enc, g.cipherEncode(s.word, s.shifts));
        const back = [...s.enc].map((c, i) => String.fromCharCode((c.charCodeAt(0) - 65 - s.shifts[i] + 26) % 26 + 65)).join('');
        assert.equal(back, s.word, 'moving each letter back by its rotor gives the word');
      }
      if (def.id === 'semaphore') {
        assert.equal(s.seq.length, 4);
        const letters = [...bomb.serial].filter(c => /[A-Z]/.test(c)), outside = s.seq.map((c, i) => [c, i]).filter(([c]) => !letters.includes(c));
        assert.equal(outside.length, 1, 'exactly one signal is not in the serial number');
        assert.equal(g.semaphoreOdd(s, bomb), outside[0][1]);
        assert.ok(s.seq.every(c => g.SEMAPHORE[c]), 'every signal is a letter');
        assert.equal(new Set(s.seq).size, 4, 'four different signals, so how often one repeats gives nothing away');
      }
      if (def.id === 'meter') {
        const v = [...s.volts], target = bomb.coinVolts || bomb.batteries * 1.5 || 12;
        assert.equal(g.meterTarget(bomb), target);
        assert.equal(v.length, 6); assert.equal(new Set(v).size, 6);
        assert.ok(v.every(x => x >= 0 && x <= 12 && Number.isInteger(x * 2)), 'every jack sits on the half-volt grid from 0 to 12 V');
        const pairs = [];
        for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) pairs.push([i, j, Math.abs(v[i] - v[j])]);
        const hits = pairs.filter(p => p[2] === target);
        assert.equal(hits.length, 1, 'exactly one pair reads the target');
        assert.deepEqual([...g.meterPair(s, bomb)], hits[0].slice(0, 2));
        assert.ok(pairs.every(p => p[2] === target || Math.abs(p[2] - target) >= 1), 'every other pair reads at least 1 V away');
      }
      if (def.id === 'safe') {
        const sum = [...bomb.serial].filter(c => /\d/.test(c)).reduce((a, c) => a + +c, 0), lit = bomb.indicators.filter(x => x.lit).length;
        const a = sum * 2 % 40, b = (a + 13 * (bomb.batteries + 1)) % 40, c = (b + 7 * (lit + 1)) % 40;
        assert.deepEqual([...g.safeCombo(bomb)], [a, b, c]);
        assert.ok(a !== b && b !== c, 'neighbouring numbers differ, so none needs a full turn');
        assert.ok(Number.isInteger(s.start) && s.start >= 0 && s.start < 40 && s.start !== a);
      }
      if (def.id === 'tiles') {
        const want = [...g.TILE_TARGETS[Number(bomb.serial.slice(-1))]], start = [...s.start];
        assert.deepEqual([...g.tilesTarget(bomb)], want);
        assert.deepEqual([...start].sort(), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
        const inv = a => { const t = a.filter(x => x); let n = 0; for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) n += t[i] > t[j]; return n % 2; };
        assert.equal(inv(start), inv(want), 'the scramble can be solved');
        const man = start.reduce((d, n, i) => n ? d + Math.abs(i % 3 - want.indexOf(n) % 3) + Math.abs((i / 3 | 0) - (want.indexOf(n) / 3 | 0)) : d, 0);
        assert.ok(man >= 12, `at least 12 moves from the target (Manhattan ${man})`);
      }
      if (def.id === 'dip') {
        const code = (bomb.batteries + bomb.indicators.filter(x => x.lit).length + Number(bomb.serial.slice(-1))) % 16;
        assert.equal(g.dipCode(bomb), code);
        assert.deepEqual([...g.dipPattern(code)], [8, 4, 2, 1].map(v => !!(code & v)));
        assert.notDeepEqual([...s.start], [...g.dipPattern(code)], 'the switches do not start at the answer');
      }
      if (def.id === 'throttle') {
        assert.ok(g.THROTTLE_GRIPS.includes(s.grip), 'a known grip');
        const want = g.throttleWant(s, bomb), base = g.THROTTLE_POS[s.grip];
        assert.equal(want, bomb.batteries > 2 ? Math.max(1, base - 1) : base);
        assert.ok(s.start >= 1 && s.start <= 5 && s.start !== want, 'starts away from the answer');
      }
      if (def.id === 'gears') {
        assert.ok(s.gears >= 3 && s.gears <= 6, 'three to six gears');
        assert.ok(s.dots.length >= 1 && s.dots.length <= 3 && new Set(s.dots).size === s.dots.length, 'one to three distinct red dots');
        assert.ok(s.dots.every(k => k >= 0 && k < s.gears), 'dots on real gears');
        const drum = s.load === 'LIFT' ? 'cw' : 'ccw', flip = { cw: 'ccw', ccw: 'cw' };
        assert.deepEqual({ ...g.gearsWant(s) }, { dir: s.gears % 2 ? drum : flip[drum], turns: s.dots.length });
        assert.equal(g.gearsCount(s), (g.gearsWant(s).dir === 'cw' ? 1 : -1) * s.dots.length, 'clockwise counts up, anticlockwise down');
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

test('relay logic: every dealt puzzle has exactly one jumper setting, both gates matter, and all eight answers occur', () => {
  const names = Object.keys(g.GATES), invs = [0, 1, 2, 3, 4, 5, 6, 7].map(n => [n >> 2 & 1, n >> 1 & 1, n & 1]), possible = new Set(), seen = new Set();
  for (const g1 of names) for (const g2 of names) for (const want of [0, 1]) for (const inv of invs)
    if (g.relaySolutions(g1, g2, want, inv).length === 1) possible.add(`${g1} ${g2} ${want} ${inv.join('')}`);
  const def = g.Modules.list.find(m => m.id === 'relay'), answers = new Set(), asG1 = new Set(), asG2 = new Set(), byG1 = {};
  for (let seed = 1; seed <= 3000; seed++) {
    const r = g.rng(seed), s = def.create(g.makeBomb(r, 300000), r);
    const sols = g.relaySolutions(s.g1, s.g2, s.want, s.inv);
    assert.equal(sols.length, 1, `${s.g1} ${s.g2} ${s.want} ${s.inv}`);
    const [a, b, c] = sols[0];
    assert.equal(g.GATES[s.g2](g.GATES[s.g1](a ^ s.inv[0], b ^ s.inv[1]), c ^ s.inv[2]), s.want);
    assert.deepEqual([...g.relayAnswer(s)], [...sols[0]]);
    seen.add(`${s.g1} ${s.g2} ${s.want} ${s.inv.join('')}`); answers.add(sols[0].join('')); asG1.add(s.g1); asG2.add(s.g2);
    (byG1[s.g1] ||= new Set()).add(sols[0].join(''));
  }
  assert.deepEqual([...seen].sort(), [...possible].sort(), 'every puzzle with one answer gets dealt');
  assert.equal(answers.size, 8, 'all eight jumper settings occur as answers');
  assert.deepEqual([...asG1].sort(), [...names].sort(), 'every gate appears as gate 1');
  assert.deepEqual([...asG2].sort(), [...names].sort(), 'every gate appears as gate 2');
  for (const n of names) assert.ok(byG1[n].size > 1, `gate 1 alone (${n}) does not give the answer away`);
});

test('coolant: the target starts from the demand, stays between 1 and 9 and never above the relief valve', () => {
  const def = g.Modules.list.find(m => m.id === 'coolant');
  assert.ok(def.needy, 'coolant is needy');
  for (let seed = 1; seed <= 500; seed++) {
    const r = g.rng(seed), bomb = g.makeBomb(r, 300000), s = def.create(bomb, r);
    assert.ok(s.relief >= 4 && s.relief <= 8, 'relief 4 to 8');
    for (let demand = 1; demand <= 9; demand++) {
      const raw = Math.max(1, Math.min(9, demand + bomb.indicators.filter(i => i.lit).length - bomb.batteries));
      const t = g.coolantTarget({ ...s, demand }, bomb);
      assert.equal(t, raw > s.relief ? s.relief - 1 : raw);
      assert.ok(t >= 1 && t <= 8);
    }
  }
  const quiet = g.makeBomb(g.rng(7), 300000);
  Object.assign(quiet, { indicators: [], batteries: 2 });
  assert.equal(g.coolantTarget({ relief: 6, demand: 1 }, quiet), 1, 'a low demand still gives a reachable target');
});

test('maze: nine perfect 6x6 mazes with unique markers, and every rotation can be walked from the front', () => {
  assert.equal(g.MAZES.length, 9);
  const key = m => m.markers.map(p => p.join(',')).sort().join(' ');
  assert.equal(new Set(g.MAZES.map(key)).size, 9, 'marker pairs tell the mazes apart');
  const D = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (const m of g.MAZES) {
    assert.equal(m.cells.length, 36);
    let passages = 0;
    m.cells.forEach((bits, i) => { for (let d = 0; d < 4; d++) if (bits & (1 << d)) {
      passages++;
      const x = i % 6 + D[d][0], y = Math.floor(i / 6) + D[d][1];
      assert.ok(x >= 0 && x < 6 && y >= 0 && y < 6, 'no passage out of the grid');
      assert.ok(m.cells[y * 6 + x] & (1 << ((d + 2) % 4)), 'passages go both ways');
    } });
    assert.equal(passages / 2, 35, 'a perfect maze: 35 passages for 36 cells');
    for (const p of m.markers) assert.ok(p.every(v => v >= 0 && v < 6));
  }
  const walk = (s, from, to) => {
    const seen = new Set([from.join()]), queue = [[from, []]];
    while (queue.length) {
      const [p, path] = queue.shift();
      if (p.join() === to.join()) return path;
      for (let d = 0; d < 4; d++) if (g.mazeCanMove(s, p, d)) {
        const q = [p[0] + D[d][0], p[1] + D[d][1]];
        if (!seen.has(q.join())) { seen.add(q.join()); queue.push([q, [...path, d]]); }
      }
    }
    return null;
  };
  for (let maze = 0; maze < 9; maze++) for (let rot = 0; rot < 4; rot++) {
    const s = { maze, rot };
    assert.ok(walk(s, [0, 0], [5, 5]), `maze ${maze} rotated ${rot * 90}: corner to corner`);
    for (let x = 0; x < 6; x++) for (let y = 0; y < 6; y++) for (let d = 0; d < 4; d++) {
      const nx = x + D[d][0], ny = y + D[d][1];
      if (nx < 0 || nx > 5 || ny < 0 || ny > 5) assert.equal(g.mazeCanMove(s, [x, y], d), false, 'the edge is a wall');
      else assert.equal(g.mazeCanMove(s, [x, y], d), g.mazeCanMove(s, [nx, ny], (d + 2) % 4), 'walls look the same from both sides');
    }
  }
  const def = g.Modules.list.find(m => m.id === 'maze');
  for (let seed = 1; seed <= 300; seed++) {
    const r = g.rng(seed), s = def.create(g.makeBomb(r, 300000), r);
    assert.ok(s.maze >= 0 && s.maze < 9 && s.rot >= 0 && s.rot < 4);
    assert.notEqual(s.start.join(), s.goal.join());
    assert.ok(walk(s, s.start, s.goal).length >= 4, 'the goal is a few moves away');
  }
});

test('safe: numbers are entered where the dial changes direction; a full turn clears them', () => {
  const dial = start => ({ pos: start, dir: 0, run: 0, entries: [] });
  const turn = (lock, d, n) => { for (let k = 0; k < n; k++) g.safeTurn(lock, d); return lock; };
  const enter = (lock, [a, b, c]) => {
    turn(lock, 1, (a - lock.pos + 40) % 40);       // clockwise up to the first number
    turn(lock, -1, (a - b + 40) % 40);             // anticlockwise down to the second
    return turn(lock, 1, (c - b + 40) % 40);       // clockwise up to the third
  };
  const combo = [12, 38, 5];
  assert.ok(g.safeOpens(enter(dial(20), combo), combo), 'the plain entry opens');
  let lock = dial(20); turn(lock, -1, 7);
  assert.ok(g.safeOpens(enter(lock, combo), combo), 'turning anticlockwise before the first number is only positioning');
  lock = dial(20); turn(lock, 1, 3); turn(lock, -1, 2);
  assert.equal(lock.entries.length, 1, 'turning back records where the dial stood');
  turn(lock, -1, 38);
  assert.equal(lock.entries.length, 0, 'a full turn in one direction clears the entries');
  assert.ok(g.safeOpens(enter(lock, combo), combo), 'and the combination can be entered afresh');
  assert.ok(!g.safeOpens(enter(dial(20), [12, 37, 5]), combo), 'a wrong second number does not open');
  lock = enter(dial(20), combo); turn(lock, -1, 1); turn(lock, 1, 1);
  assert.ok(!g.safeOpens(lock, combo), 'an extra direction change does not open');
  lock = dial(20); turn(lock, 1, (12 - 20 + 40) % 40); turn(lock, -1, (12 - 38 + 40) % 40);
  assert.ok(!g.safeOpens(lock, [12, 38, 38]), 'the third number is entered clockwise');
});

test('tiles: ten different targets, each eight tiles and a gap, and eight symbols for the tiles', () => {
  assert.equal(g.TILE_TARGETS.length, 10);
  assert.equal(new Set(g.TILE_TARGETS.map(t => t.join())).size, 10);
  for (const t of g.TILE_TARGETS) assert.deepEqual([...t].sort(), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(g.TILE_GLYPHS.length, 8, 'one symbol per tile');
  assert.equal(new Set(g.TILE_GLYPHS.map(x => x.name)).size, 8, 'eight different names to say out loud');
  assert.equal(new Set(g.TILE_GLYPHS.map(x => x.svg)).size, 8, 'eight different shapes');
});

test('a bomb with Semaphore has three different letters in its serial number; the digits stay', () => {
  const semaphore = g.Modules.list.find(m => m.id === 'semaphore');
  for (const serial of ['A1AA23', 'E5EB70', 'K2LK19']) {
    const bomb = g.makeBomb(g.rng(5), 300000);
    bomb.serial = serial;
    g.ensureNeeds(bomb, [semaphore], g.rng(9));
    const letters = [bomb.serial[0], bomb.serial[2], bomb.serial[3]];
    assert.equal(new Set(letters).size, 3, bomb.serial);
    assert.match(bomb.serial, /^[A-Z]\d[A-Z]{2}\d{2}$/);
    assert.equal(bomb.serial[1] + bomb.serial.slice(4), serial[1] + serial.slice(4), 'the digits are untouched');
    assert.equal(bomb.serialVowel, /[AEIOU]/.test(bomb.serial));
    assert.ok(!/[IO]/.test(bomb.serial), 'no I or O, as on every serial');
  }
});

test('up to nine modules: a third row of bays only for 7 to 9, and every module gets a bay', () => {
  for (let count = 2; count <= 9; count++) {
    const L = g.layoutFor(1360, count);
    assert.equal(L.rows, count > 6 ? 3 : 2, `${count} modules: ${L.rows} rows`);
    assert.ok(L.cols * L.rows >= count);
    const narrow = g.layoutFor(600, count);
    assert.ok(narrow.cols * narrow.rows >= count, `narrow, ${count} modules`);
    for (let seed = 1; seed <= 200; seed++) {
      const w = world(seed, 1360, count);
      assert.equal(w.defs.length, count, `seed ${seed}: ${w.defs.length} of ${count} modules dealt`);
      assert.equal(new Set(w.plan.bays.map(b => b.i)).size, count, 'each module in its own bay');
    }
  }
});

test('semaphore: 26 letters, each with its own pair of arm positions', () => {
  const keys = Object.keys(g.SEMAPHORE);
  assert.equal(keys.length, 26);
  assert.equal(new Set(keys.map(k => [...g.SEMAPHORE[k]].sort((a, b) => a - b).join())).size, 26, 'no two letters look the same');
  for (const k of keys) for (const a of g.SEMAPHORE[k]) assert.ok(a % 45 === 0 && a >= 0 && a < 360);
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

test('warning beep: intervals per mode, and one beep each time the shown clock passes a multiple', () => {
  assert.equal(g.beepInterval(200000, 'off'), null);
  assert.equal(g.beepInterval(200000, '60'), 60000);
  assert.equal(g.beepInterval(5000, '30'), 30000);
  assert.equal(g.beepInterval(200000, 'dynamic'), 60000);
  assert.equal(g.beepInterval(179999, 'dynamic'), 30000);
  assert.equal(g.beepInterval(59999, 'dynamic'), 10000);
  const beeps = mode => { const at = []; for (let t = 300000; t > 0; t -= 16) if (g.beepDue(t, t - 16, mode)) at.push(Math.ceil((t - 16) / 1000)); return at; };
  assert.deepEqual(beeps('off'), []);
  assert.deepEqual(beeps('60'), [240, 180, 120, 60]);
  assert.deepEqual(beeps('dynamic'), [240, 180, 150, 120, 90, 60, 50, 40, 30, 20, 10]);
  assert.equal(g.settings.beep, 'off');
});

test('settings start from sane defaults', () => {
  assert.deepEqual([g.DEFAULTS.minutes, g.DEFAULTS.count, g.DEFAULTS.difficulty], [8, 2, 'easy'], 'a first game: 8 minutes, 2 modules, easy');
  assert.equal(g.DEFAULTS.linkViews, true, 'the module explorer turns front and rear together unless switched off');
  const s = g.settings;
  assert.ok(s.master >= 0 && s.master <= 1 && s.music >= 0 && s.music <= 1 && s.fx >= 0 && s.fx <= 1);
  assert.ok([3, 5, 8, 12].includes(s.minutes));
  assert.ok(s.count >= 2 && s.count <= 9);
  assert.ok([1, .85, .7].includes(s.startZoom));
  assert.equal(typeof s.seed, 'string');
});

test('the clock formats as minutes and seconds, then seconds and hundredths', () => {
  assert.equal(g.fmt(300000), '05:00');
  assert.equal(g.fmt(61000), '01:01');
  assert.equal(g.fmt(7430), '07.43');
  assert.equal(g.fmt(-5), '00.00');
});
