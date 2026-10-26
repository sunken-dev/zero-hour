# Twenty modules, needy modules, the module explorer

## Intent

Zero Hour grows to 20 modules leaning harder, gains needy modules (as in Keep Talking and Nobody Explodes: a recurring
distraction, never annoying), turns the debug module viewer into a module explorer where players read about and
configure modules, and adds a few quality-of-life touches: difficulty colours everywhere, a difficulty plate on the
case, and an optional warning beep.

## Decided by the user

- Five new modules, one of them a maze. Totals roughly 7 easy, 7 medium, 6 hard (±1).
- Needy modules feel like Keep Talking's: a distraction, not an annoyance. Existing modules become needy rather than new
  ones; 1 to 2 needy modules per difficulty.
- Dealing never puts more than 2 needy modules on a bomb, and at most 1 on Easy.
- Needy modules are needy always (no "sometimes needy").
- The module viewer stops being a debug tool: it becomes a module explorer for players, without technical debug
  information, with a description of every module, and with per-module configuration.
- Configuration: enable or disable a module; for modules whose rear plate is optional, rear plate always, sometimes or
  never.
- Explorer list ordered by difficulty, then name; selecting an item never changes the layout.
- The difficulty choice on the main screen is colour-coded; the bomb case shows the difficulty.
- A warning beep setting: off, every 60 s, every 30 s, or dynamic (every 60 s, every 30 s in the last 3 minutes, every
  10 s in the last minute).

## Goals

- 20 modules: 6 easy, 8 medium, 6 hard. 12 with a rear plate. 3 needy: Knob (easy), Breaker (medium), Coolant (hard).
- Rules stay data-driven: one table drives the solver and the manual.
- Same seed + same settings (time, count, difficulty, module configuration, screen size) = same bomb.

## Anti-goals

- A needy module that strikes so often it dominates the game.
- A module solvable by trial and error without talking.
- A rule that needs something the defuser cannot see.

## Needy modules

- A module definition may set `needy: true`. Needy modules are never solved; the bomb is defused when every
  non-needy module is solved.
- Needy modules take a bay out of the module count. Limits: 2 modules, no needy; 3 to 5 modules, at most 1; 6 modules,
  at most 2; on Easy at most 1 whatever the count. Each needy module at most once per bomb. (Builder's call.)
- A needy module sleeps, then wakes with its own countdown shown on the module (a small needy timer and a NEEDY mark on
  the plate). Handling it correctly before the countdown ends puts it back to sleep; a wrong action or the countdown
  running out is a strike and also puts it back to sleep. It wakes again after a pause.
- Timing (builder may tune within these bounds, all in seconds of real time): first wake 30–60 after arming; sleep
  40–80 between wakes; countdown 25 (Knob), 35 (Breaker), 45 (Coolant).
- Needy modules stop when the bomb is defused, explodes or is aborted, and when the module viewer unmounts them.
- The manual has a short "Needy modules" paragraph in the appendix and marks each needy module's section.

### Knob, needy

Each wake shows a new lamp pattern; the defuser sets the knob to the direction from the existing table and presses
Lock. Rules and table unchanged.

### Breaker, needy

Each wake shows a new number and lamp colour; the defuser sets the knife switch by the existing three rules and presses
Latch. The knife switch stays on the bomb's side as now.

### Coolant, needy

- Asleep: the gauge rests at 0 and an IDLE lamp is lit; the valve does nothing.
- Each wake lights a demand display on the front with a new number from 1 to 9 and makes the valve slip to a random
  position. The target rule's first step becomes "start with the number on the demand display" (instead of the
  serial's last digit); the other steps and the relief tag stay. The defuser sets the valve on the back, watches the
  needle on the front and presses Seal when it points at the target.
- So every wake needs the expert again (new demand) and the back again (the valve slipped). (Builder's call.)

## New modules

### Throttle (easy), front only

A lever with positions 1 to 5 and a coloured grip (red, blue, yellow, white, black), and an Engage button. The manual
gives the position for each grip colour, then: if there are more than two batteries, one position lower (never below
1). Engage at the wrong position is a strike.

### Maze (hard), rear plate required

- Front: a 6×6 grid of dots, two green marker rings, the defuser's white square, a red goal triangle, and four arrow
  buttons. Walls are not shown. Moving into a wall is a strike (the square stays put). Reaching the goal solves it.
- Nine mazes, generated from fixed seeds in the code (so the manual and the game share them); each is identified by
  its two marker positions, which are unique among the nine.
- Rear: the gyro plate, stamped "ROTATED 0°", "90° CW", "180°" or "270° CW", meaning the maze is mounted turned that far
  clockwise as seen from the front. The manual draws the mazes unrotated; the expert turns their map (markers
  included). Stamped text, so the mirrored back cannot mislead.
- Arrows on the front move as seen from the front.

### Cipher (hard), rear plate required

- Front: five letters on a display (the encrypted word), five letter wheels the defuser turns, and Submit.
- Rear: the rotor plate, five digits 0 to 9. Seen from behind the order is mirrored: the first digit from the right on
  the back belongs to the first letter on the front.
- Each plain letter is its encrypted letter moved back through the alphabet by its rotor digit (wrapping Z to A). The
  word comes from a fixed list of five-letter words; the manual has a numbered alphabet strip.
- Submit with the wrong word is a strike.

### Resistors (hard), rear plate required

- Front: three resistors R1, R2, R3 with colour bands (two digit bands and a multiplier band: black ×1, brown ×10) and
  three digit wheels with a Measure button.
- Rear: the wiring: all three in series, or R1 in series with R2 and R3 in parallel (generated so that R2 equals R3).
- The total resistance in ohms (always a whole number up to 999) is set on the wheels; Measure with a wrong total is a
  strike. Values come from 10, 15, 22, 33, 47, 68 (×1 or ×10).

### Signal (hard), front only

- Front: an oscilloscope showing a waveform (sine, square, sawtooth, triangle) with 1 to 4 peaks, three knobs (FREQ 1–5,
  AMP 1–5, PHASE 0, 90, 180, 270) and Lock.
- The manual's tables: AMP by waveform; FREQ = peaks + lit indicators, and if that is above 5, use 5 (the
  expert applies the cap); PHASE by the last digit of the serial
  and whether there is a coin cell. Lock with any knob wrong is a strike.

## Module explorer (was the module viewer)

- Opened from a "Modules" button on the main screen; no longer under Debug.
- List ordered by difficulty (easy, medium, hard), then title. Each item shows the title and small badges: difficulty
  (colour-coded), REAR or REAR OPTIONAL, NEEDY, OFF when disabled. Selecting an item changes only colours, never sizes.
- Main area: the module's description (new `description` field per module, written for players), the front and rear
  plate previews (interactive, as now, with plain-language feedback such as "Strike: wrong wire"), and configuration:
  - Enabled on/off (the last enabled non-needy module cannot be disabled).
  - For optional rear plates (Wires, Glyphs, Simon, Switches, Breaker): rear plate Always (default), Sometimes (each bomb
    decides from its seed), Never.
- Removed: seed input, state dump, log and other debug information.
- Configuration is saved with the other settings and is part of the bomb (the seed hint says so).

## Difficulty colours and the case plate

- Easy mint, medium amber, hard red: the main screen selector, the explorer badges, the case plate.
- The case front carries a stamped plate next to the strike lamps reading EASY, MEDIUM or HARD with a lamp in that colour.

## Warning beep

- Setting "Warning beep": Off (default), every 60 s, every 30 s, Dynamic (every 60 s; every 30 s in the last 3 minutes;
  every 10 s in the last minute). It follows the clock as shown, so strikes speed it up too. Synthesised like the other
  sounds; respects the effects volume.

## Dealing

- Weighted by difficulty as now; disabled modules are left out; at most 2 needy, at most 1 on Easy, at least one
  non-needy; rear plates per the configuration.

## Tests

- Logic: counts (20; 6/8/6; 12 with rear; 3 needy); dealing limits over many seeds and every difficulty; disabled
  modules never dealt; rear Sometimes varies by seed and Never removes it; each new module's rules give exactly one
  answer for many seeds; the nine mazes are perfect mazes with unique marker pairs; rotation maths.
- Browser: each new module solved and struck through its controls; a needy module wakes, strikes on expiry and goes back
  to sleep after a correct action (with shortened timings); explorer order, badges, no layout shift on selection,
  configuration persists; warning beep schedule.

## Calls made by the builder, for review

- Needy Coolant: a demand number per wake replaces the serial digit, and the valve slips on each wake.
- Needy modules use a bay; none on 2-module bombs, at most 1 up to 5 modules or on Easy, at most 2 on 6.
- Signal's FREQ cap is a manual instruction.
- Warning beep defaults to Off.

## Left to the builder

Visual design, exact manual wording, sound design, descriptions' wording, needy timings within the bounds above, the
maze generator, commit split.
