# Fifteen modules, rear plates that belong, difficulty ratings

## Intent

Zero Hour grows from 11 to 15 modules. The new modules should feel inventive, and the back of the bomb should matter
more: at least half of all modules get a rear plate, and every rear plate belongs to its module both in theme (it looks
like a part of that machine) and in the riddle (it is a clue the rules need, or a working part of the puzzle that only
exists on the back). Every module gets a difficulty rating, shown in the module viewer. The social preview images are
re-rendered afterwards.

## Decided by the user

- 15 modules in total: four new ones. Their difficulties: one easy, two medium, one hard.
- A rear plate may be a hint or an interactive hidden part of the puzzle.
- The existing generic rear plates (a selector knob showing serial parity, vowel, or coin cells) are redesigned so each
  fits its own module.
- Each module has a difficulty: easy, medium or hard, shown in the module browser (Settings, Debug, Module viewer).
- Update the social preview, 1x (1200 x 630) and 2x (2400 x 1260).

## Goals

- 9 of 15 modules (60%) have a rear plate.
- Every rear plate is (a) drawn as part of its module's machine and (b) needed by, or useful to, that module's rules.
- Rules stay data-driven: the same table drives the solver and the manual, as for the existing modules.
- The manual, the PDF and the appendix stay generated from the module definitions.

## Non-goals and anti-goals

- No change to how many modules a bomb carries, the timer, strikes or the case layout.
- Rear plates that are optional shortcuts must stay optional: the same fact must still be on the bomb's sides.
- Anti-goal: a module that can be solved by trial and error without talking. Every wrong action is a strike.
- Anti-goal: rules that need information the defuser cannot see or describe.

## New modules

Rear plates are seen from behind, so their left and right are swapped relative to the front (the manual's appendix
already explains this). Modules that need the back say so in their manual section.

### Fuses (easy), rear plate required

- Front: five cartridge fuses side by side in clips, each with an amp rating stamped on it (1, 2, 3, 5, 10 A, shuffled).
  Clicking a fuse pulls it. Pulling the right one solves the module; any other is a strike (the pulled fuse stays out).
- Rear: the fuse block's wiring plate. Five terminals, each labelled with the circuit it feeds: CLOCK, IGNITER, LAMPS,
  RADIO, SPARE, shuffled. Because the plate is seen from behind, its rightmost label belongs to the leftmost fuse.
- Rules, first that applies: if the serial number contains a vowel, pull the RADIO fuse; otherwise if there are two or
  more batteries, pull IGNITER; otherwise if any indicator is lit, pull LAMPS; otherwise pull CLOCK.
- Manual explains the mirrored count: "On the back, count the labels from the right: the first label from the right is
  the first fuse from the left."

### Gears (medium), rear plate required

- Front: a crank with two buttons, "turn clockwise" and "turn anticlockwise" (each press is one full turn of the crank,
  counted on a small turn counter), a load arrow reading LIFT or DROP, and a Release button.
- Rear: the gear train behind the crank: a chain of 3 to 6 meshed gears from the crank gear to a winch drum. Between one
  and three of the gears carry a red dot. The drawing is static: the gears do not turn on screen, so the direction has to
  be reasoned out, not watched.
- Rules: neighbouring gears turn opposite ways, so the drum turns the same way as the crank when the number of gears
  (including the crank gear and the drum gear) is odd, and the opposite way when it is even. LIFT needs the drum to turn
  clockwise, DROP anticlockwise, both as seen from the front. The number of turns is the number of gears with a red dot.
  The defuser turns the crank the right way the right number of times, then presses Release.
- A turn in the wrong direction is a strike and resets the counter. Release with the wrong count is a strike and resets
  the counter.

### Relay logic (medium), rear plate required

- Front: three jumpers A, B and C, each set to 0 or 1 by the defuser, an output lamp, and a Test button. The lamp only
  lights when Test is pressed with the right setting (and then stays lit); it never shows the result live.
- Rear: the relay board's schematic: gate 1 takes A and B, gate 2 takes gate 1's output and C, and its output drives the
  lamp. The gates are drawn as standard symbols without names: AND, OR, XOR, NAND, NOR.
- Rules: the manual draws the five symbols with their names and truth rules. The defuser describes the two shapes; the
  expert finds the one jumper setting that gives the target. Test with any other setting is a strike.
- The front shows a target, TARGET ON or TARGET OFF. Generation picks the two gates and the target so that exactly one
  of the eight settings gives it (for example AND then AND with TARGET ON needs 1 1 1). A lit-only target allows just
  four gate pairs; the target doubles that to eight puzzles. (Builder's call, see below.)

### Coolant (hard), rear plate interactive

- Front: a pressure gauge, 0 to 9 bar, with a needle, and a Seal button.
- Rear: the coolant valve, a hand wheel with positions 0 to 9 that the defuser turns one step per click (left half
  closes, right half opens, like the encoders), and a stamped relief-valve tag "RELIEF n BAR" (n from 4 to 8).
- The needle moves towards the valve position at about one bar per second, so the defuser sets the valve on the back and
  then turns the bomb to watch the gauge.
- Rules for the target pressure: start with the last digit of the serial number; add the number of lit indicators;
  subtract the number of batteries; keep the result between 1 and 9. If it is above the relief value on the rear tag,
  use the relief value minus one instead. Seal when the gauge reads the target (the needle within half a bar of it):
  right is solved, wrong is a strike.

## Existing rear plates, redesigned

They stay optional shortcuts; the rules do not change.

- Wires: the harness plug the wires run into on the back, with as many pins as the serial number's last digit (0 pins is
  allowed: an empty plug). Counting the pins gives odd or even, which the wire rules ask for.
- Simon: the back of the toy: a round speaker grille with a stamped label on the cone listing the serial number's vowels,
  or a dash when there are none. That picks the colour table.
- Switches: the switch bank's memory backup: a small status window reading BACKUP FITTED when the bomb has any coin
  cells and BACKUP EMPTY when it has none. It is a printed flag, not a drawn coin cell, so nobody counts it as one.
- Breaker: the breaker's rating plate, with a trip-coil number equal to the serial number's last digit.
- Glyphs: unchanged; its raised column numeral already belongs to the module.

## Difficulty

- Each module definition gets `difficulty: 'easy' | 'medium' | 'hard'`, documented in the module registry comment.
- Existing modules: easy for Wires, Button, Glyphs and Knob; medium for Simon, Password, Switches, Morse, Breaker and
  Combination; hard for Memory. New: Fuses easy, Gears medium, Relay logic medium, Coolant hard.
- The module viewer's list shows the rating next to "front only" or "front and rear plate".
- A test asserts every module has a valid difficulty.

## Difficulty choice on the main screen

- The main screen has a selector with Easy, Medium and Hard, remembered with the other settings; the default is Medium.
- The bomb's modules are still dealt at random, weighted by how close each module's difficulty is to the chosen one:
  the same difficulty 3, one step away 1, two steps away 0.3. Nothing is excluded. (A flat 3 against 1 made Hard deal
  more easy modules than Medium, because there are only two hard modules.)
- The difficulty is part of the bomb: the same seed with the same settings gives the same bomb.

## Manual and PDF

- Each new module's section follows the existing style. Relay logic's section includes the five gate symbols as SVG; the
  PDF template learns this new markup (it refuses unknown markup by design).
- Rear plate texts in the manual describe the new plates.
- The appendix's module figure and texts stay valid; "Rear plates" in the appendix no longer says rear plates only repeat
  information from elsewhere, since some are now part of the puzzle.

## Tests

- Logic tests: 15 modules; each new module's rules always give exactly one answer for many seeded bombs; Relay logic has
  exactly one working C; Coolant's target is always reachable (1 to 9 and not above relief).
- Browser tests: each new module can be solved and struck through its real controls, including the rear valve.
- Existing tests that count modules or rear plates are updated.

## Social preview

`npm run preview` renders both images from the real game. npm is blocked on the developer machine, so it runs in a
GitHub Actions job on a temporary branch, and the images it produces are downloaded and committed. The seed is chosen so
the front shows at least two of the new modules; the README's alt text names the modules shown.

## Verification

Locally: Node via `nix shell nixpkgs#nodejs_22`, the non-browser tests with a stub for the blocked `puppeteer-core`, and
the PDF rebuilt with headless Chrome plus Typst (same pipeline as `tools/build-manual-pdf.mjs`). The browser tests run in
CI on a temporary branch before anything is pushed to main. Every commit that changes manual text carries its rebuilt PDF.

## Calls made by the builder, for review

- Relay logic uses three jumpers and guarantees one working setting, so guessing costs strikes.
- Relay logic's lamp only lights on a correct Test, and the front shows TARGET ON or TARGET OFF.
- Difficulty weighting: 3 for the chosen difficulty, 1 one step away, 0.3 two steps away; default Medium.
- The Gears rear drawing is static.
- The Switches backup plate is a printed status flag, not a coin cell.
- The preview seed is picked to show new modules.

## Left to the builder

- Visual design and CSS of the new fronts and rear plates, in the style of the existing modules.
- Exact wording of manual sections, within the rules above.
- Sound effects, reusing the existing sfx.
- Splitting the work into focused commits.
