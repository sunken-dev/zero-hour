# Five more modules: Key Lock, Multimeter, Semaphore, Safe, Tiles

## Intent

Five modules inspired by what the Keep Talking community likes most in mods (real-world skills turned into talking
puzzles: semaphore, probing with a multimeter, safe dials, sliding tiles), adapted to Zero Hour's industrial look. None
is needy. Every one has an optional rear plate that repeats a clue found elsewhere on the case.

## Decided by the user

- 1 easy, 2 medium, 2 hard. No needy modules. Proper 3D models and smooth animations.
- As many as possible with optional rear plates (all five have one).
- The lineup: Key Lock (easy), Multimeter (medium), Semaphore (medium), Safe (hard), Tiles (hard).

## Rules

### Key Lock (easy)

- Front: a key ring with four keys (brass, steel, red tag, blue tag, in a shuffled order) and a cylinder lock. Clicking
  a key moves it into the lock and turns it. The right key solves the module; a wrong one is a strike and comes back.
- Key, first rule that applies: no batteries: steel; any lit indicator: red; more than two batteries: blue; otherwise
  brass.
- Optional rear plate: a service tag stamped with the number of batteries and the number of lit indicators.

### Multimeter (medium)

- Front: four terminal pairs A to D, a needle meter from 0 to 12 V, and a Bridge button. Clicking a pair touches the
  probes to it and the needle swings to its voltage. Bridge bridges the pair the probes are on.
- Each pair has a different voltage from 1.5, 3, 4.5, 6, 9 and 12 V.
- Target voltage: the coin cells' total voltage; with no coin cells, 1.5 V times the number of batteries. Bridge the pair
  at the target voltage; if no pair has it (or the target is 0), bridge the pair with the highest voltage. Any other
  pair is a strike.
- Optional rear plate: a power label with the number of batteries and the coin cells' total voltage.

### Semaphore (medium)

- Front: a small signaller with two flags and arrows to step through a sequence of four signals; the arms move
  smoothly from one position to the next. An ACK button.
- Letters follow the structure of real flag semaphore: arm angles in steps of 45 degrees from straight down; A to G one
  arm down; H, I, K, L, M, N one arm at 45; O to S one arm at 90; T, U, Y one arm at 135; J, V at 180; W, X at 225;
  Z at 270 (the other arm as in standard semaphore). The manual's chart is drawn from the same table as the module.
- Three of the four signals are letters in the serial number; one is not. ACK while that one shows. Anything else is a
  strike.
- Optional rear plate: a call-sign plate repeating the serial number's letters.

### Safe (hard)

- Front: a safe door with a combination dial numbered 0 to 39 (turned by dragging, or one step per click on its left
  or right half), three tumbler lamps and a handle.
- The combination: first = (sum of the serial number's digits x 2) mod 40; second = (first + 13 x batteries) mod 40;
  third = (second + 7 x (lit indicators + 1)) mod 40.
- Entering it: turn clockwise to the first number, then anticlockwise to the second, then clockwise to the third, then
  pull the handle. A number is entered when the dial changes direction there; the third is where the dial stands when
  the handle is pulled. The lamps count the numbers entered (no hint whether they are right). A wrong combination is a
  strike and clears the entries.
- Optional rear plate: the maker's plate with the sum of the serial number's digits.

### Tiles (hard)

- Front: a 3x3 tray of eight numbered tiles and a gap. Clicking a tile next to the gap slides it in. A Check button.
- Ten target arrangements, one per last digit of the serial number, in the manual. The tiles start a scramble that can
  be solved (made by moving backwards from the target), at least 12 moves away. Check with the target: solved; Check
  with anything else: a strike.
- Optional rear plate: a pattern plate with the serial number's last digit.

## Build order and tests

One commit per module. Each: rules as data with exported helpers; logic tests (rules give exactly one answer for many
seeds; generators stay in range); a page-side browser test that solves and strikes through the real controls (also
after-solve clicks); the rear plate in the rear plate test; manual section; rebuilt PDF; counts in the tests updated in
the same commit (25 modules: 7 easy, 10 medium, 8 hard; 17 rear plates; 3 needy).
