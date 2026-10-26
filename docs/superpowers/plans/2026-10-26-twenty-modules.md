# Twenty Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 20 modules (6 easy, 8 medium, 6 hard), three needy modules, a player-facing module explorer with
configuration, difficulty colours and a case plate, and a warning beep.

**Architecture:** All game code stays in `site/index.html` (modules are `Modules.register` blocks, rule tables drive
solver and manual). Needy behaviour is one shared helper used by the three needy modules; the game loop ignores needy
modules when deciding defusal. Module configuration lives in `settings` and feeds dealing.

**Tech Stack:** vanilla JS, node:test, puppeteer-core (CI), Typst 0.15.1.

**Spec:** `docs/superpowers/specs/2026-10-26-twenty-modules-design.md`

## Global Constraints

- Difficulty: easy Wires, Button, Glyphs, Knob, Fuses, Throttle; medium Simon, Password, Switches, Morse, Breaker,
  Combination, Gears, Relay logic; hard Memory, Coolant, Maze, Cipher, Resistors, Signal.
- Needy: Knob, Breaker, Coolant (`needy: true`). Optional rear (`rearOptional: true`): Wires, Glyphs, Simon, Switches, Breaker.
- Needy limits per bomb: count 2 → 0; 3–5 → ≤1; 6 → ≤2; Easy → ≤1; each needy module at most once.
- Needy timing (real seconds): first wake 30–60 after arming, sleep 40–80, countdown Knob 25, Breaker 35, Coolant 45.
- Colours: easy `var(--mint)`, medium `var(--amber)`, hard `var(--red)`.
- Warning beep: `off` (default), `60`, `30`, `dynamic` (60 s; 30 s under 3 min; 10 s under 1 min), keyed to the shown clock.
- Every commit that changes manual text carries the rebuilt PDF; every commit passes the suite on its own (module
  counts in tests change in the commit that adds the module).
- Local check: `.superpowers/sdd/<plan>/check.sh` (non-browser tests), `brun.py "<test name>"` for page-side browser
  tests, `pdf.sh` for the PDF; UI-driving browser tests run in CI on a temporary branch.
- Ask the user before each commit whether to run a review loop (their CLAUDE.md); their answer for this plan: see ledger.

## Review Focus

- A needy module waking while the explorer preview is open, then the explorer closes: no timer keeps running. Pinned in
  Task 4 (cleanup stops the cycle; no strike after cleanup).
- A bomb where every enabled module is needy, or only one module enabled: dealing still gives a playable bomb. Pinned in
  Task 2/4 logic tests (config with all but one disabled; needy-only config impossible because the last non-needy
  cannot be disabled).
- Strikes speeding the clock while the warning beep is on: beeps follow the shown time, never two in one interval.
  Pinned in Task 3 (`beepInterval` table + crossing test).
- Selecting items in the explorer on a narrow window: no size change. Pinned in Task 1 (item rects equal before/after).
- A maze rotation of 90°/270° with arrow presses: moves follow the front. Pinned in Task 8 (solver walks rotated mazes
  through `mazeCanMove` for all 9 × 4).

---

### Task 1: Module explorer, descriptions, difficulty colours

**Files:** `site/index.html` (rename viewer UI to explorer, main screen "Modules" button, remove Debug section entry,
`description` on all modules, sort, badges, CSS), `tests/logic.test.mjs`, `tests/browser.test.mjs`

**Interfaces:** Produces `def.description: string` (1–3 plain sentences); `openExplorer()` (was `openBench`); list order
`sortModules(list) -> list` by `DIFFICULTIES` index then title; badges `.badge.diff-<d>`, `.badge.rear`, `.badge.needy`,
`.badge.off`.

- [ ] Step 1: tests. Logic: `test('every module describes itself for players')` — `description` is a string of 40–400
  chars without HTML. Browser (explorer test, renamed from module viewer): opened via `.startrow` "Modules" button; item
  titles equal `sortModules` order; selecting each item leaves every `.bench-item` `getBoundingClientRect()` height
  unchanged; no `pre`, seed input or log in the explorer; main screen difficulty buttons carry `diff-easy|medium|hard`.
- [ ] Step 2: run, expect FAIL.
- [ ] Step 3: implement; selected style changes colours only (no font-weight change); remove Debug heading if empty.
- [ ] Step 4: local check + brun; screenshot explorer and main screen.
- [ ] Step 5: commit "Turn the module viewer into a module explorer for players".

### Task 2: Module configuration

**Files:** `site/index.html` (`settings.modules`, explorer controls, `pickModules`, `rearFor`, play/demo callers, seed
hint, plateCard blank panel when no rear), tests

**Interfaces:** `settings.modules: { [id]: { off?: true, rear?: 'always' | 'sometimes' | 'never' } }`;
`pickModules(r, count, difficulty = 'medium', config = {})` leaves out `off` modules; `rearFor(r, def, config) -> boolean`
(true for required rears; `rearOptional` per mode, `sometimes` = `r() < .5`), called once per dealt module in dealing
order after `pickModules`.

- [ ] Step 1: tests. Logic: disabled ids never dealt (500 seeds, each difficulty); `rearFor` never/always/sometimes
  (both outcomes occur, same seed same outcome); required rears ignore config. Browser: explorer toggles persist across
  reload; the last enabled non-needy module's toggle is disabled.
- [ ] Step 2: FAIL. Step 3: implement. Step 4: check. Step 5: commit "Let players switch modules and optional rear plates on and off".

### Task 3: Case difficulty plate and warning beep

**Interfaces:** `beepInterval(msLeft, mode) -> number | null`; `settings.beep: 'off' | '60' | '30' | 'dynamic'`;
case front `.diff-plate` with text EASY/MEDIUM/HARD and class `diff-<d>`; `sfx.warn()`.

- [ ] Step 1: tests. Logic: `beepInterval` table (off → null; 60/30 fixed; dynamic 200000 → 60000, 179999 → 30000,
  59999 → 10000); crossing helper `beepDue(prevMs, nowMs, mode) -> boolean` true exactly when a multiple of the interval
  is crossed. Browser: armed bomb's `.diff-plate` text matches the chosen difficulty.
- [ ] Step 2–4 as usual. Step 5: commit "Show the difficulty on the case and add a warning beep".

### Task 4: Needy modules, with Knob

**Interfaces:** `needyCycle(root, ctl, { window, first = [30, 60], sleep = [40, 80], onWake, onSleep }) -> { handled(), stop() }`
appends `.needy-lcd`; `ctl.timeScale` (default 1; tests 0.01) scales all timings; expiry calls `ctl.strike('…ran out')`
then sleeps; `handled()` sleeps. Game: defuse when every non-needy module is solved; needy plates show NEEDY.
`pickModules` applies the needy limits. Appendix gets "Needy modules"; needy sections start with a needy note.

- [ ] Step 1: tests. Logic: needy limits over 2000 seeds × counts 2–6 × difficulties; Knob `needy`. Browser (brun):
  Knob mounted with `timeScale .01` wakes, a correct Lock sleeps it without strike, expiry strikes once, cleanup stops it.
- [ ] Steps 2–5; commit "Add needy modules and make Knob one".

### Task 5: Breaker needy — wake gives a new number and lamp; same rules. Tests as Task 4. Commit "Make Breaker needy".

### Task 6: Coolant needy — asleep: gauge 0, IDLE lamp; wake: demand 1–9, valve slips; `coolantTarget(s, b)` uses
`s.demand`. Tests: target uses demand; wake changes valve; Seal right sleeps, wrong strikes. Commit "Make Coolant needy".

### Task 7: Throttle (easy)

**Interfaces:** `THROTTLE_GRIPS = ['red', 'blue', 'yellow', 'white', 'black']`, `THROTTLE_POS` table, `throttleWant(s, b) -> 1..5`;
state `{ grip }`; DOM `.notch` ×5 (click sets position), `.go` Engage.
Tests: answer 1..5 for 500 seeds; wrong Engage strikes, right solves, clicks after solve ignored. Commit "Add the Throttle module".

### Task 8: Maze (hard)

**Interfaces:** `MAZES` (9 × `{ walls, markers: [[x, y], [x, y]] }`, built by `makeMaze(r)` from fixed seeds, 6×6, perfect),
`rotatePoint([x, y], rot)`, `mazeCanMove(s, [x, y], dir) -> boolean` in front coordinates, state
`{ maze, rot: 0..3, start, goal }`; DOM `.mz-up/.mz-down/.mz-left/.mz-right`, `.mz-me[data-x][data-y]`, rear `.gyro`.
Tests: perfect mazes (36 cells, 35 passages, connected); marker pairs unique; BFS through `mazeCanMove` reaches the goal
for all mazes × rotations; browser: wall bump strikes and doesn't move, path solves. Manual draws the 9 mazes as SVG
figures (template learns them). Commit "Add the Maze module".

### Task 9: Cipher (hard)

**Interfaces:** `CIPHER_WORDS` (five-letter words), `cipherEncode(word, shifts) -> string`, state `{ word, shifts[5], enc }`;
DOM `.wheel` ×5 with `.up/.dn`, `.go`; rear `.rotor` digits in rear order. Tests: decode(encode) round trip; browser solve
and strike. Commit "Add the Cipher module".

### Task 10: Resistors (hard)

**Interfaces:** `RES_VALUES = [10, 15, 22, 33, 47, 68, 100, 150, 220, 330, 470, 680]`, `BAND_COLORS` (digit → colour,
multiplier black ×1, brown ×10), `resTotal(s) -> integer ≤ 999`, state `{ r: [3], wiring: 'series' | 'mixed' }` (mixed:
R2 = R3); DOM `.res` ×3, `.digit` ×3 with `.up`, `.go`; rear `.wiring[data-kind]`. Tests: totals whole and ≤ 999 for
500 seeds; browser solve and strike. Commit "Add the Resistors module".

### Task 11: Signal (hard)

**Interfaces:** `SIGNAL_WAVES`, `signalWant(s, b) -> { freq, amp, phase }`, state `{ wave, peaks }`; DOM `.k-freq`,
`.k-amp`, `.k-phase` (click steps), `.go`. Tests: want within ranges; FREQ cap; browser solve and strike.
Commit "Add the Signal module".

### Task 12: Ship

- [ ] README counts and features; social preview re-render (case plate visible) via the one-off workflow; CI on a
  temporary branch (expect all green, PDF/index identical to artifact); final whole-branch review; fix pass; push main;
  verify deploy and live files.
