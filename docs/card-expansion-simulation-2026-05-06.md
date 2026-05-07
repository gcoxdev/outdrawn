# Card Expansion Simulation - 2026-05-06

## Changes Checked

- Renamed Decoy to Ricochet in player-facing card text, rules, prompts, and logs. The internal id remains `defense_decoy` to avoid save/state churn.
- Added Backfire as a reaction defense: cancel incoming attack damage to yourself, then deal that much damage to the attacker.
- Added Minigun as a weapon: deal 1 damage to every other living player. Minigun has no reaction window.
- Changed Reload to keep the next weapon in hand after use instead of recovering the strongest discarded weapon.
- Replaced Second Wind with Field Dressing, a simple 4-health healing card.

## Simulation Runs

All runs completed without stalls.

| Scenario | Games | Avg Rounds | Avg Turns | Notable Outcome |
| --- | ---: | ---: | ---: | --- |
| Competent vs competent | 2,000 | 8.34 | 26.05 | Seats stayed broadly balanced: 519 / 480 / 480 / 509 wins, plus 12 true ties. |
| Mixed skill table | 5,000 | 8.23 | 24.66 | Master 1,794, Expert 1,755, Novice 979, Beginner 451, plus 21 true ties. |
| Master vs master | 2,000 | 8.05 | 25.38 | Seats stayed broadly balanced: 496 / 498 / 470 / 517 wins, plus 19 true ties. |

## Current Deck Balance

- Weapon cards: 31
- Defense and healing cards: 29
- Ability cards: 21
- Estimated weapon pressure: 138
- Estimated survival value: 91
- Pressure-to-survival ratio: 1.52

The ratio still favors damage, but Reload and Field Dressing add enough staying power to push games slightly longer. Average game length is now roughly 8.0-8.3 rounds and 24.7-26.1 turns.

## Gameplay Notes

- Backfire is intentionally stronger than Shield Plate against medium attacks because it fully cancels damage and mirrors that damage onto the attacker. The simulation logic values it mainly when incoming damage is 3+ or lethal.
- Minigun is low single-target damage, but high table pressure. In a 4-player game it usually represents 3 total damage, and it scales upward with player count later.
- Ricochet remains functionally the old Decoy behavior: the defender picks a different valid target, then the redirected attack resolves normally.
- Reload no longer depends on searching the discard pile. This avoids physical-game bookkeeping around discarded weapons and removes the late-game tendency to always recover Sniper Rifle.
- Field Dressing replaces Second Wind to avoid duplicating Revive's lethal-defense role in the healing category.
- True ties remain under 1.25% in these samples. They come from simultaneous or near-simultaneous elimination states, usually from table-wide pressure or final low-health exchanges. This is acceptable for now, but should stay on the watch list as more area cards are added.

## Recommendations

- Keep the new counts for now: 2 Miniguns and 2 Backfires.
- Keep Minigun at 1 damage until larger player-count modes are designed. It will become much stronger as player count increases.
- Keep Backfire at 2 copies while it mirrors incoming damage. More copies would likely make attacking feel too risky when several reaction defenses already exist.
- Continue monitoring true ties after future area-of-effect cards or team rules, since those mechanics can increase simultaneous elimination frequency.
