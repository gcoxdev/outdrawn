# Card Expansion Simulation - 2026-05-06

## Changes Checked

- Renamed Decoy to Ricochet in player-facing card text, rules, prompts, and logs. The internal id remains `defense_decoy` to avoid save/state churn.
- Added Backfire as a reaction defense: cancel incoming attack damage to yourself, then deal that much damage to the attacker.
- Added Minigun as a weapon: deal 1 damage to every other living player. Minigun has no reaction window.

## Simulation Runs

All runs completed without stalls.

| Scenario | Games | Avg Rounds | Avg Turns | Notable Outcome |
| --- | ---: | ---: | ---: | --- |
| Competent vs competent | 2,000 | 7.91 | 24.60 | Seats stayed broadly balanced: 504 / 502 / 486 / 484 wins, plus 24 true ties. |
| Mixed skill table | 5,000 | 7.79 | 23.18 | Expert 1,771, Master 1,689, Novice 1,037, Beginner 466, plus 37 true ties. |
| Master vs master | 2,000 | 7.72 | 23.99 | Seats stayed broadly balanced: 512 / 479 / 514 / 467 wins, plus 28 true ties. |

## Current Deck Balance

- Weapon cards: 31
- Defense and healing cards: 29
- Ability cards: 21
- Estimated weapon pressure: 138
- Estimated survival value: 87
- Pressure-to-survival ratio: 1.59

The ratio still favors damage, but Minigun and Backfire both add swing without making games too short. Average game length remains near 8 rounds and 24-25 turns, which is close to the current target pacing.

## Gameplay Notes

- Backfire is intentionally stronger than Shield Plate against medium attacks because it fully cancels damage and mirrors that damage onto the attacker. The simulation logic values it mainly when incoming damage is 3+ or lethal.
- Minigun is low single-target damage, but high table pressure. In a 4-player game it usually represents 3 total damage, and it scales upward with player count later.
- Ricochet remains functionally the old Decoy behavior: the defender picks a different valid target, then the redirected attack resolves normally.
- True ties remain under 1.25% in these samples. They come from simultaneous or near-simultaneous elimination states, usually from table-wide pressure or final low-health exchanges. This is acceptable for now, but should stay on the watch list as more area cards are added.

## Recommendations

- Keep the new counts for now: 2 Miniguns and 2 Backfires.
- Keep Minigun at 1 damage until larger player-count modes are designed. It will become much stronger as player count increases.
- Keep Backfire at 2 copies while it mirrors incoming damage. More copies would likely make attacking feel too risky when several reaction defenses already exist.
- Continue monitoring true ties after future area-of-effect cards or team rules, since those mechanics can increase simultaneous elimination frequency.
