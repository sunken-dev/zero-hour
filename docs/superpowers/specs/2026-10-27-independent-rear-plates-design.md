# Independent rear plates

## Intent

Ten optional rear plates only repeated something already on the case (the serial number, batteries, coin cells, lit
indicators) as a shortcut. Rear plates should add variety: each one carries a value found nowhere else on the bomb.

## Decided by the user

- Optional plates stay optional, and override when they are fitted: the plate has its own random value, and the
  manual says "if the rear plate is fitted, use its value instead of ...". Without the plate the module works as before.
- The explorer's rear plate setting (always, sometimes, never) stays. With "sometimes" the expert has to ask whether
  there is a plate on the back.
- The plates keep their look; only what is stamped on them changes.

## Mechanism

`create(bomb, r, fitted)` learns whether the rear plate is on this bomb (the game passes what it dealt; the explorer,
which always shows the rear, passes true) and keeps it in the state as `fitted`. The plate's value is always rolled,
fitted or not, so the random sequence does not depend on it.

## Per module

| Module | Rear plate | When fitted |
|---|---|---|
| Wires (easy) | harness plug stamped NORMAL or REVERSED | REVERSED: count the wires from the right |
| Glyphs (easy) | plate stamped TOP-DOWN or BOTTOM-UP | BOTTOM-UP: press in the column's reverse order |
| DIP Switches (easy) | code plate OFFSET n (0 to 9) | add n to the total |
| Simon (medium) | speaker label with a channel, A, B or C | the channel picks the colour table instead of the serial's vowels |
| Switches (medium) | backup window FITTED or EMPTY, at random | switch 4 follows the window instead of the coin cells |
| Breaker (medium, needy) | trip coil number 0 to 9, at random | rule 2 uses the coil number instead of the serial's last digit |
| Multimeter (medium) | supply label OFFSET +1.5 V, -1.5 V or 0 V | the offset is added to the target |
| Semaphore (medium) | call-sign plate with three random letters | find the signal not in the call sign instead of the serial |
| Safe (hard) | maker's plate DIAL R-L-R or DIAL L-R-L | L-R-L: every turning direction is reversed |
| Tiles (hard) | pattern plate PATTERN n (0 to 9) | n picks the target instead of the serial's last digit |

## Tests

For each module: the rules with and without the plate (logic tests over many seeds, both cases give exactly one
answer); the page-side solve test with the plate fitted; the rear plate test reads the plate's own value.

## Left to the builder

Exact manual wording, plate wording, value ranges where the table leaves room, keeping every generated puzzle
solvable (e.g. the Multimeter target stays within the meter's range).
