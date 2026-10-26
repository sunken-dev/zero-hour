# Fifteen Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow Zero Hour to 15 modules (Fuses, Gears, Relay logic, Coolant), redesign four rear plates to belong to their
modules, rate every module's difficulty in the module viewer, and refresh the social preview.

**Architecture:** Everything game-side lives in `site/index.html`: each module is one `Modules.register({...})` block
whose rule table drives both the solver and `manual()`. Rear plates are `mountBack(root, s, ctl)` sharing the module's
state object `s` with the front, which is how an interactive rear part (Coolant's valve) talks to the front. The PDF is
rebuilt from `manualHTML()` through `tools/build-manual-pdf.mjs` and `tools/manual.typ`.

**Tech Stack:** vanilla JS in one HTML file, node:test, puppeteer-core (CI only), Typst 0.15.1.

**Spec:** `docs/superpowers/specs/2026-10-25-fifteen-modules-design.md`

## Global Constraints

- 15 modules in total; 9 with a rear plate (Wires, Glyphs, Simon, Switches, Breaker, Fuses, Gears, Relay logic, Coolant).
- `difficulty` is exactly one of `'easy' | 'medium' | 'hard'`. Easy: Wires, Button, Glyphs, Knob, Fuses. Medium: Simon,
  Password, Switches, Morse, Breaker, Combination, Gears, Relay logic. Hard: Memory, Coolant.
- Every wrong action is a strike; no rule may need information the defuser cannot see.
- Optional rear plates (Wires, Simon, Switches, Breaker, Glyphs) only repeat facts that are also on the bomb's sides.
- Rear plates are seen from behind: the plate's left is the module's right.
- Every commit that changes manual text also carries the rebuilt `site/zero-hour-manual.pdf` and the embedded copy in
  `site/index.html` (a browser test fails otherwise).
- Local check (npm is blocked on this machine): extract the tree and rebuild the PDF with the scratchpad harness
  (`harness.py` then `regen.mjs`, see the conversation), then run
  `nix shell nixpkgs#nodejs_22 -c node --test tests/manual-pdf.test.mjs tests/logic.test.mjs tests/site.test.mjs tests/audio.test.mjs`
  with the temporary `node_modules/puppeteer-core` stub, removed afterwards. Browser tests run in CI on a temporary
  branch before main is pushed.
- New rule tables and helpers are added to `EXPORTS` in `tests/game.mjs` and to the `window.__t` line in
  `tests/browser.test.mjs` when a test uses them.

## Review Focus

- A Coolant valve turned on the rear while the front is mounted in a different stage (module viewer, unlinked views):
  the front must read the live `s.valve`, never a copy. Pinned in Task 6's browser test by mounting front and rear on
  the same state and turning the rear.
- Coolant's needle loop after the module is solved, aborted or unmounted: the interval must stop. Pinned in Task 6 by
  checking `cleanup()` clears it (no further `s.pressure` change after cleanup).
- A serial number ending in 0 (Wires plug with zero pins, Coolant start value 0): must render and compute. Pinned in
  Task 2 and Task 6 logic tests with a crafted bomb whose serial ends in 0.
- Repeated clicks after a module is solved (pulling a second fuse, extra crank turns, Test again): must do nothing and
  never strike. Pinned in each module task's browser test by clicking once more after solving and asserting strikes
  unchanged.
- The module viewer with 15 modules on a small window: the list must scroll, not overflow. Pinned in Task 1 by
  asserting `.bench-list` has `overflow:auto` (existing CSS) and 15 items.

---

### Task 1: Difficulty ratings in the module viewer

**Files:**
- Modify: `site/index.html` (registry comment near `MODULE REGISTRY`; each existing `Modules.register`; the
  `bench-item` line in the module viewer; `.bench-item` CSS)
- Test: `tests/logic.test.mjs`, `tests/browser.test.mjs`

**Interfaces:**
- Produces: `def.difficulty: 'easy' | 'medium' | 'hard'` on every module; `const DIFFICULTIES = ['easy', 'medium', 'hard']`
  exported via `tests/game.mjs`.

- [ ] **Step 1: Write the failing tests.** In `logic.test.mjs` add
  `test('every module has a difficulty: easy, medium or hard')` asserting `g.DIFFICULTIES.includes(m.difficulty)` for all
  modules and the exact mapping for the 11 existing ids from Global Constraints. In the module viewer browser test,
  read each item's `small` text and assert it matches `/^(easy|medium|hard) · (front only|front and rear plate)$/`.
- [ ] **Step 2: Run the logic test; expect FAIL** (`DIFFICULTIES` undefined).
- [ ] **Step 3: Implement.** Add `difficulty` to the registry comment and every module; the viewer's `small` becomes
  `` `${d.difficulty} · ${d.mountBack ? 'front and rear plate' : 'front only'}` `` with a class `diff-${d.difficulty}`
  colouring the word (mint, amber, red from the CSS variables).
- [ ] **Step 4: Run the local check; expect PASS.** No manual text changes, so no PDF rebuild.
- [ ] **Step 5: Commit** "Rate every module's difficulty and show it in the module viewer".

### Task 1b: Difficulty choice on the main screen

**Files:**
- Modify: `site/index.html` (`DEFAULTS` gets `difficulty: 'medium'`; `pickModules(r, count, difficulty)`; every caller
  passes `settings.difficulty`; a `seg(...)` selector with Easy, Medium, Hard on the start screen next to the arm button)
- Test: `tests/logic.test.mjs` (`world()` passes a difficulty), `tests/browser.test.mjs`, `tools/make-preview.mjs`
  (passes nothing new: it sets `difficulty` in the stored settings it writes)

**Interfaces:**
- Produces: `pickModules(r, count, difficulty = 'medium')`: weighted draw without replacement from `Modules.list`,
  weight 3 for `def.difficulty === difficulty`, 1 otherwise; once the pool is exhausted, weighted draws with
  replacement as today; `max` still respected. Deterministic for a given `r`.

- [ ] **Step 1: Write the failing tests.** Logic: over 2000 seeds of 6 modules, the share of modules of difficulty d is
  higher with `pickModules(r, 6, d)` than with each other choice, for each d; `max: 1` modules never appear twice; same
  seed and difficulty give the same ids. Browser: choose Hard on the main screen, reload, Hard is still pressed.
- [ ] **Step 2: Run the logic test; expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the local check; expect PASS.**
- [ ] **Step 5: Commit** "Let players choose a difficulty that weights which modules are dealt".

### Task 2: Rear plates that belong to their modules

**Files:**
- Modify: `site/index.html` (`mountBack` and `manualBack` of Wires, Simon, Switches, Breaker; CSS for the new plates;
  the appendix bullet "Rear plates."; remove `rearSelector` if unused)
- Test: `tests/logic.test.mjs`, `tests/browser.test.mjs`

**Interfaces:**
- Consumes: `bomb.serial`, `bomb.coins`.
- Produces DOM hooks for tests: Wires rear `.plug .pin` (count = last serial digit); Simon rear `.cone-lbl` (text = the
  serial's vowels in order, joined without separator, or `—`); Switches rear `.backup` (text `BACKUP FITTED` or
  `BACKUP EMPTY`); Breaker rear `.trip` (text = last serial digit).

- [ ] **Step 1: Write the failing browser test** `test('rear plates show what their module needs')`: in the test copy,
  for seeds 1..40 and each of the four modules, `mountBack` into a div with `ctl.bomb` and assert the hook above against
  the bomb. Add a crafted bomb with serial `AB1CD0` to assert an empty Wires plug (0 pins) renders.
- [ ] **Step 2: Update the manual texts** (`manualBack`) to describe the new plates; the appendix "Rear plates." bullet
  says some rear plates repeat a clue from elsewhere and others are part of the puzzle. The logic test that lists the
  appendix bullets keeps passing.
- [ ] **Step 3: Implement** the four plates in the style of the existing rear plates (steel, header "rear").
- [ ] **Step 4: Rebuild the PDF and run the local check; expect PASS.** Look at the rear plates in the module viewer
  screenshot (headless Chrome) and at the PDF pages for the four modules.
- [ ] **Step 5: Commit** "Give Wires, Simon, Switches and Breaker rear plates that belong to them".

### Task 3: Fuses (easy)

**Files:**
- Modify: `site/index.html` (new `MODULE: Fuses` block after Combination, CSS), `tests/game.mjs`
- Test: `tests/logic.test.mjs`, `tests/browser.test.mjs`

**Interfaces:**
- Produces: `FUSE_CIRCUITS = ['CLOCK', 'IGNITER', 'LAMPS', 'RADIO', 'SPARE']`, `FUSE_AMPS = [1, 2, 3, 5, 10]`,
  `FUSE_RULES: [manualText, (bomb) => boolean, circuit][]` (rules from the spec, last one always true),
  `fuseCircuit(bomb) -> circuit`. State `{ amps: number[5], circuits: string[5] }`; `circuits[i]` feeds front fuse `i`
  counted from the left. DOM: front `.fuse` (5, clickable, class `out` once pulled); rear `.fuse-lbl` (5, in rear order,
  i.e. `circuits` reversed).

- [ ] **Step 1: Write the failing tests.** Logic: for 500 seeds, `s.circuits` is a permutation of `FUSE_CIRCUITS` and
  `s.circuits.indexOf(fuseCircuit(bomb))` is 0..4; module count 12. Browser (solving test): click a wrong fuse (strike 1),
  the right one (solved), then another (strikes still 1); rear labels read right-to-left equal `s.circuits`.
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement** with `difficulty: 'easy'`; `manual()` lists `FUSE_RULES` and the mirrored-count sentence
  from the spec; `manualBack()` describes the wiring plate.
- [ ] **Step 4: Rebuild the PDF, run the local check; expect PASS.** Visual check in the module viewer.
- [ ] **Step 5: Commit** "Add the Fuses module".

### Task 4: Gears (medium)

**Files:** as Task 3 (`MODULE: Gears`).

**Interfaces:**
- Produces: `gearsWant(s) -> { dir: 'cw' | 'ccw', turns: number }` (drum turns with the crank when `s.gears` is odd;
  LIFT needs drum `cw` as seen from the front; `turns = s.dots.length`). State `{ gears: 3..6, dots: number[] (1..3
  distinct gear indexes), load: 'LIFT' | 'DROP', count: 0 }`. DOM: front `.crank-cw`, `.crank-ccw`, `.go` (Release),
  `.turns` (shows `count`), `.load`; rear `.gear` (one per gear, `.dot` on dotted ones).

- [ ] **Step 1: Write the failing tests.** Logic: 500 seeds give `gears` 3..6, `dots` 1..3 distinct within range, and
  `gearsWant` agrees with an independent parity computation; module count 13. Browser: one turn the wrong way is a
  strike and resets `.turns` to 0; the right direction `turns` times then Release solves; Release with a wrong count
  strikes; clicks after solving change nothing.
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement** with `difficulty: 'medium'`; static rear drawing (SVG gears in a chain ending at a drum);
  manual explains parity, LIFT/DROP as seen from the front, and red-dot turns.
- [ ] **Step 4: Rebuild the PDF, run the local check; expect PASS.**
- [ ] **Step 5: Commit** "Add the Gears module".

### Task 5: Relay logic (medium)

**Files:** as Task 3 (`MODULE: Relay logic`), plus `tools/manual.typ` and `tests/manual-pdf.test.mjs`.

**Interfaces:**
- Produces: `GATES = { AND, OR, XOR, NAND, NOR }` mapping to `(a, b) => 0 | 1`; `relaySolutions(g1, g2, want) ->
  [a, b, c][]`; `relayAnswer(s) -> [a, b, c]`; `gateSVG(name) -> string` (shared by the rear plate and the manual).
  State `{ g1, g2, want: 0 | 1, set: [0, 0, 0] }`, generated by picking gate pairs and `want` until exactly one setting
  satisfies `GATES[g2](GATES[g1](a, b), c) === want`. Front shows `TARGET ON` or `TARGET OFF`, jumpers `.jp` (3, class
  `on` when 1), `.go` (Test), `.out` lamp lit only after a correct Test. Rear `.relay-board` with the two gate SVGs.
  Manual: `<div class="gates">` of `<div class="gate">${gateSVG(n)}<b>${n}</b> rule text</div>`.
- [ ] **Step 1: Write the failing tests.** Logic: every generated state has exactly one solution and `relayAnswer`
  returns it; every pair the generator can produce is reachable within 500 seeds; module count 14. Template test: a
  `div.gates` with one `div.gate` typesets; an svg outside `.gcol`, `.gate` or a figure still panics. Browser: a wrong
  setting then Test strikes; the answer then Test solves; Test again changes nothing.
- [ ] **Step 2: Run; expect FAIL.** (Note: the spec's "exactly one of eight settings" with a fixed lit target only
  allows four gate pairs; the `want` target doubles that to eight puzzles. Update the spec line in this commit.)
- [ ] **Step 3: Implement** with `difficulty: 'medium'`; teach `tools/manual.typ` the `gates`/`gate` divs (grid of five
  cards, svg via `svg-image`).
- [ ] **Step 4: Rebuild the PDF, run the local check; expect PASS.**
- [ ] **Step 5: Commit** "Add the Relay logic module".

### Task 6: Coolant (hard)

**Files:** as Task 3 (`MODULE: Coolant`).

**Interfaces:**
- Produces: `coolantTarget(s, bomb) -> 1..9` (last serial digit + lit indicators − batteries, clamped 1..9; above
  `s.relief` becomes `s.relief - 1`). State `{ valve: 0, pressure: 0, relief: 4..8 }`. Front `.gauge` needle at
  `s.pressure`, `.go` (Seal; solved when `|s.pressure - target| <= 0.5`), a 100 ms interval moving `s.pressure` toward
  `s.valve` by 0.1 per tick, stopped by the returned cleanup and once solved. Rear `.valve` (click left half −1, right
  half +1, wheel and right-click like the encoders, 0..9 clamped), `.relief` tag text `RELIEF ${n} BAR`.
- [ ] **Step 1: Write the failing tests.** Logic: 500 seeds give a target 1..9 and ≤ relief − 1 when the raw value
  exceeds relief; a crafted serial ending in 0 with no lit indicators gives 1; module count 15; at least half the modules
  have `mountBack`. Browser: mount front and rear on the same `s`; turn the rear to `target ± 2`, set
  `s.pressure = s.valve`, Seal strikes; turn to target, `s.pressure = s.valve`, Seal solves; after `cleanup()`
  `s.pressure` no longer changes.
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement** with `difficulty: 'hard'`; manual gives the target steps and says the valve is on the back.
- [ ] **Step 4: Rebuild the PDF, run the local check; expect PASS.** Update the module viewer browser test's count to 15
  and the "fifteen modules" logic test name.
- [ ] **Step 5: Commit** "Add the Coolant module".

### Task 7: CI verification of the module branch

- [ ] **Step 1:** Push `HEAD` to a temporary branch `ci-verify`; watch `ci.yml`. Expected: green (rerun once if only the
  known flaky clock test fails, and say so).
- [ ] **Step 2:** Download the `site` artifact; `cmp` its PDF and `index.html` with the committed ones. Expected: identical.

### Task 8: Social preview

**Files:** `site/zero-hour-preview.png`, `site/zero-hour-preview@2x.png`, `README.md` (alt text)

- [ ] **Step 1:** Find a seed with a node script using `loadGame()` and the same dealing as `tools/make-preview.mjs`
  (6 modules, its viewport, difficulty medium) whose front shows at least two of Fuses, Gears, Relay logic, Coolant.
- [ ] **Step 2:** On the temporary branch only, add a one-off workflow that runs `npm run preview -- --seed <seed>` and
  uploads both PNGs; run it; download them. Check both sizes (1200 x 630, 2400 x 1260) and look at them.
- [ ] **Step 3:** Update the README alt text to the modules visible; run the local check (site tests check the sizes).
- [ ] **Step 4: Commit** "Refresh the social preview with the new modules"; delete the temporary branch and workflow.

### Task 9: Ship

- [ ] Push main; watch `deploy.yml`; `cmp` the live PDF with the committed one. Expected: green and identical.
