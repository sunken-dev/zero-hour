# Five more modules: DIP Switches, Multimeter, Semaphore, Safe, Tiles

## Intent

Five modules inspired by what the Keep Talking community likes most in mods (real-world skills turned into talking
puzzles: semaphore, probing with a multimeter, safe dials, sliding tiles), adapted to Zero Hour's industrial look. None
is needy. Every one has an optional rear plate that repeats a clue found elsewhere on the case.

## Decided by the user

- 1 easy, 2 medium, 2 hard. No needy modules. Proper 3D models and smooth animations.
- As many as possible with optional rear plates (all five have one).
- The lineup: DIP Switches (easy), Multimeter (medium), Semaphore (medium), Safe (hard), Tiles (hard).
- DIP Switches replaces the first easy module, Key Lock, which the user did not like.
- The Multimeter measures between any two of six jacks and patches a cable, so guessing rarely works; its meter has a
  3D needle.

## Rules

### DIP Switches (easy)

- Front: a red DIP block with four slide switches numbered 1 to 4 (up is ON) and an Apply button. The switches never
  start at the answer.
- Number: batteries + lit indicators + the serial number's last digit, minus 16 if it is 16 or more. The manual's table
  gives the pattern (the number in binary, switch 1 the highest bit). Apply with any other pattern is a strike.
- Optional rear plate: the code base, batteries + lit indicators.

### Multimeter (medium)

- Front: six banana jacks A to F, a red and a black probe, a panel meter from 0 to 12 V (a tick every half volt) and a
  Patch button. Clicking a jack puts a probe on it (red first, then black, then always the probe that has stood
  longest); the meter shows the voltage between the probes. Patch plugs a cable across the probed jacks.
- Target: the coin cells' total voltage; with no coin cells, 1.5 V per battery; with neither, 12 V.
- The jacks sit on a half-volt grid from 0 to 12 V. Exactly one pair reads the target; every other pair reads at least
  1 V away from it. Patching any other pair is a strike.
- Optional rear plate: a power label with the number of batteries and the coin cells' total voltage.

### Semaphore (medium)

- Front: a brass-rimmed signal dial with eight marks and two alike, flag-tipped hands on one pivot (the hands stand
  where a flag signaller's arms would be), arrows to step through a sequence of four signals, and an ACK button. Each
  change moves whichever hand is nearer to each new position, the short way round.
- Letters follow the structure of real flag semaphore: arm angles in steps of 45 degrees from straight down; A to G one
  arm down; H, I, K, L, M, N one arm at 45; O to S one arm at 90; T, U, Y one arm at 135; J, V at 180; W, X at 225;
  Z at 270 (the other arm as in standard semaphore). The manual's chart is drawn from the same table as the module.
- Three of the four signals are letters in the serial number; one is not. ACK while that one shows. Anything else is a
  strike. The four signals are all different (a bomb with Semaphore always has three different serial letters), so how
  often a signal repeats never gives the answer away.
- Optional rear plate: a call-sign plate repeating the serial number's letters.

### Safe (hard)

- Front: a safe door with a combination dial numbered 0 to 39 (turned by dragging, or one step per click on its left
  or right half), three tumbler lamps and a handle.
- The combination: first = (sum of the serial number's digits x 2) mod 40; second = (first + 13 x (batteries + 1)) mod
  40; third = (second + 7 x (lit indicators + 1)) mod 40. Neighbouring numbers always differ, so no number needs a full
  turn of the dial.
- Turning clockwise raises the number at the mark. Entering it: turn clockwise to the first number, then anticlockwise
  to the second, then clockwise to the third, then pull the handle. A number is entered where the dial changes
  direction; turning anticlockwise before the first number is only positioning. The third is where the dial stands
  when the handle is pulled. The first two lamps light as the first two numbers are entered, the third when the safe opens (no hint whether a number is right). A full turn in one
  direction clears the entries. A wrong combination is a strike and clears the entries.
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
