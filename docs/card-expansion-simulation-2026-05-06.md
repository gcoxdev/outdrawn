# Card Expansion Simulation - 2026-05-06

## Changes Checked

- Renamed Decoy to Ricochet in player-facing card text, rules, prompts, and logs. The internal id remains `defense_decoy` to avoid save/state churn.
- Added Backfire as a reaction defense: cancel incoming attack damage to yourself, then deal that much damage to the attacker.
- Added Minigun as a weapon: deal 2 damage to every other living player. Minigun has no reaction window.
- Changed Reload to keep the next weapon in hand after use instead of recovering the strongest discarded weapon.
- Replaced Second Wind with Field Dressing, a simple 4-health healing card.

## Simulation Runs

All runs completed without stalls.

| Scenario | Games | Avg Rounds | Avg Turns | Notable Outcome |
| --- | ---: | ---: | ---: | --- |
| Competent vs competent | 2,000 | 8.01 | 24.78 | Seats stayed broadly balanced: 489 / 521 / 487 / 498 wins, plus 5 true ties. |
| Mixed skill table | 5,000 | 7.92 | 23.37 | Expert 1,839, Master 1,724, Novice 971, Beginner 459, plus 7 true ties. |
| Master vs master | 2,000 | 7.82 | 24.10 | Seats stayed broadly balanced: 522 / 482 / 504 / 492 wins, no true ties. |

## Current Deck Balance

- Weapon cards: 31
- Defense and healing cards: 29
- Ability cards: 21
- Estimated weapon pressure: 144
- Estimated survival value: 91
- Pressure-to-survival ratio: 1.58

The ratio still favors damage. With damage caps removed, average game length is roughly 7.8-8.1 rounds and 23.5-24.8 turns.

## Gameplay Notes

- Backfire is intentionally stronger than Shield Plate against medium attacks because it fully cancels damage and mirrors that damage onto the attacker. The simulation logic values it mainly when incoming damage is 3+ or lethal.
- Minigun is low single-target damage, but high table pressure. In a 4-player game it usually represents 6 total damage, and it scales upward with player count later.
- Ricochet remains functionally the old Decoy behavior: the defender picks a different valid target, then the redirected attack resolves normally.
- Reload no longer depends on searching the discard pile. This avoids physical-game bookkeeping around discarded weapons and removes the late-game tendency to always recover Sniper Rifle.
- Field Dressing replaces Second Wind to avoid duplicating Revive's lethal-defense role in the healing category.
- True ties remain under 1.25% in these samples. They come from simultaneous or near-simultaneous elimination states, usually from table-wide pressure or final low-health exchanges. This is acceptable for now, but should stay on the watch list as more area cards are added.

## Recommendations

- Keep the new counts for now: 2 Miniguns and 2 Backfires.
- Keep Minigun at 2 damage for the current 3-6 player game, but revisit it before larger player-count modes because it scales with every opponent.
- Keep Backfire at 2 copies while it mirrors incoming damage. More copies would likely make attacking feel too risky when several reaction defenses already exist.
- Continue monitoring true ties after future area-of-effect cards or team rules, since those mechanics can increase simultaneous elimination frequency.
