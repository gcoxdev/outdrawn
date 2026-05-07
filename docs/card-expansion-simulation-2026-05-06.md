# Card Expansion Simulation - 2026-05-06

## Changes Checked

- Renamed Decoy to Ricochet in player-facing card text, rules, prompts, and logs. The internal id remains `defense_decoy` to avoid save/state churn.
- Added Backfire as a reaction defense: cancel incoming attack damage to yourself, then deal 2 damage to the attacker.
- Added Minigun as a weapon: deal 1 damage to every other living player. Minigun has no reaction window.

## Simulation Runs

All runs completed without stalls.

| Scenario | Games | Avg Rounds | Avg Turns | Notable Outcome |
| --- | ---: | ---: | ---: | --- |
| Competent vs competent | 2,000 | 8.04 | 25.10 | Seats stayed broadly balanced: 510 / 529 / 461 / 475 wins, plus 25 true ties. |
| Mixed skill table | 2,000 | 7.97 | 23.86 | Expert 728, Master 684, Novice 378, Beginner 191, plus 19 true ties. |
| Master vs master | 2,000 | 7.85 | 24.49 | Seats stayed broadly balanced: 503 / 488 / 485 / 503 wins, plus 21 true ties. |
| Mixed skill table | 5,000 | 7.94 | 23.78 | Master 1,788, Expert 1,706, Novice 993, Beginner 466, plus 47 true ties. |

## Current Deck Balance

- Weapon cards: 31
- Defense and healing cards: 29
- Ability cards: 21
- Estimated weapon pressure: 138
- Estimated survival value: 85
- Pressure-to-survival ratio: 1.62

The ratio still favors damage, but Minigun and Backfire both add swing without making games too short. Average game length remains near 8 rounds and 24-25 turns, which is close to the current target pacing.

## Gameplay Notes

- Backfire is intentionally stronger than Shield Plate against medium attacks because it fully cancels damage and punishes the attacker. The simulation logic values it mainly when incoming damage is 3+ or lethal.
- Minigun is low single-target damage, but high table pressure. In a 4-player game it usually represents 3 total damage, and it scales upward with player count later.
- Ricochet remains functionally the old Decoy behavior: the defender picks a different valid target, then the redirected attack resolves normally.
- True ties remain under 1.25% in these samples. They come from simultaneous or near-simultaneous elimination states, usually from table-wide pressure or final low-health exchanges. This is acceptable for now, but should stay on the watch list as more area cards are added.

## Recommendations

- Keep the new counts for now: 2 Miniguns and 2 Backfires.
- Keep Minigun at 1 damage until larger player-count modes are designed. It will become much stronger as player count increases.
- Keep Backfire at 2 counter-damage. Raising it would likely make attacking feel too risky when several reaction defenses already exist.
- Continue monitoring true ties after future area-of-effect cards or team rules, since those mechanics can increase simultaneous elimination frequency.
