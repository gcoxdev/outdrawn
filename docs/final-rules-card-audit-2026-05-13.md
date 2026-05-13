# Outdrawn Final Rules And Card Audit - 2026-05-13

## Summary

The current rules and card language are close to art-ready. This pass found and fixed several source-of-truth issues before card art generation:

- Card metadata drift on defense/event targets.
- Search creating an impossible "keep 1" choice when no cards were available.
- Simulator step cap being too low for 100-player games.
- Bot Ricochet choices in team games not matching team-targeting rules.

After those fixes, free-for-all simulations completed through 100 players, and team simulations completed for 2v2, 2v2v2, 3v3, and 10v10.

## Card Audit Status

### Weapons

| Card | Status | Notes |
| --- | --- | --- |
| Pistol | Ready | Text and behavior match. |
| Shotgun | Ready | Text and behavior match; single-use discard is standard. |
| Sniper Rifle | Ready | Text and behavior match. |
| Knife | Ready | Text and behavior match. Loot comes from global elimination rules, not card text. |
| Grenade | Ready | Seating-order splash and attacker immunity are clear. |
| Assault Rifle | Ready | Text and behavior match. |
| Crossbow | Ready | Armor penetration text matches Armor Vest. |
| SMG | Ready | Separate-hit language matches reaction flow. |
| Minigun | Ready | Now uses 6 total allocatable damage, max 3 per opponent. Ambush adds to the pool, not each target. |

### Defense

| Card | Status | Notes |
| --- | --- | --- |
| Armor Vest | Ready | Metadata corrected to self-targeted. |
| Shield Plate | Ready | Metadata corrected to self-targeted. |
| Dodge | Ready | Metadata corrected to self-targeted. |
| Counterattack | Ready | Retaliation language matches behavior. |
| Smoke Bomb | Ready | Targeting restriction is clear. |
| Ricochet | Ready | Team-mode bot logic fixed so redirects use valid opponent targets. |
| Backfire | Ready | Mirrors attempted damage onto attacker. |
| Brace | Ready | Half damage, rounded down. |
| Revive | Ready | Attack-only lethal defense remains the recommended rule. |

### Abilities

| Card | Status | Notes |
| --- | --- | --- |
| Ambush | Ready | For Minigun, bonus adds to total pool. |
| Disarm | Ready | Highest-damage weapon from hand. |
| Steal | Ready | Player chooses a card from target hand. |
| Search | Ready | Now resolves cleanly if no cards are found. |
| Reload | Ready | Physical rules should use a visible marker until next weapon or end turn. |
| Sabotage | Ready | "Up to 2" handles one-card/zero-card hands. |
| Mark Target | Ready | Any attack against marked player gets +1 this round. |
| Intimidate | Ready | Discard-to-attack marker needed for physical play. |
| Adrenaline | Ready | Gain 1 net action, lose 2 health. |

### Healing

| Card | Status | Notes |
| --- | --- | --- |
| Bandage | Ready | Text and behavior match. |
| Medkit | Ready | Costs 2 actions, not "both actions." |
| Painkillers | Ready | Healing plus draw, including event resolution. |
| Field Dressing | Ready | Text and behavior match. |

### Events

| Card | Status | Notes |
| --- | --- | --- |
| Pressure Zone | Ready | Metadata corrected to table-wide. |
| Supply Drop | Ready | Personal draw 3. |
| Bounty | Ready | Highest-health player or tied highest-health players take damage. |
| Scavenge | Ready | Former High Ground. Table-wide draw 1. High Ground preserved as future concept in backlog. |
| Low Ammo | Ready | Metadata corrected to table-wide. |
| No Cover | Ready | Table-wide defense discard or damage. |
| Critical Condition | Ready | Low-health damage is clear. |
| Black Market | Ready | Metadata corrected to personal. Exchange details remain settings-driven. |

## Free-For-All Simulation Matrix

Competent bot baseline.

| Players | Games | Completed | Stalled | Avg Rounds | Avg Turns | None Winners |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 4 | 1000 | 1000 | 0 | 7.19 | 20.87 | 21 |
| 6 | 1000 | 1000 | 0 | 7.45 | 28.84 | 33 |
| 12 | 600 | 600 | 0 | 9.07 | 52.43 | 2 |
| 25 | 300 | 300 | 0 | 10.83 | 108.38 | 5 |
| 50 | 150 | 150 | 0 | 11.96 | 224.57 | 4 |
| 100 | 75 | 75 | 0 | 12.88 | 426.35 | 4 |

Observations:

- No stalls remain after scaling the simulator step cap.
- Large games finish in reasonable round counts, but naturally require many turns.
- True no-winner ties still occur rarely. This is a design decision, not a crash.
- Bot no-op decisions increase at large counts. This affects simulation cleanliness more than gameplay rules.

## Team Simulation Matrix

Computer-only team baseline.

| Mode | Games | Completed | Stalled | Avg Rounds | Avg Turns | Winner Spread |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 2v2 | 500 | 500 | 0 | 6.14 | 18.57 | Team 1: 244, Team 2: 245, none: 11 |
| 2v2v2 | 500 | 500 | 0 | 6.99 | 27.06 | Team 1: 180, Team 2: 124, Team 3: 183, none: 13 |
| 3v3 | 500 | 500 | 0 | 5.92 | 24.38 | Team 1: 262, Team 2: 229, none: 9 |
| 10v10 | 100 | 100 | 0 | 6.76 | 72.96 | Team 1: 57, Team 2: 42, none: 1 |

Observations:

- Team win detection and no-friendly-fire area damage remain stable.
- 2v2 is highly balanced.
- 2v2v2 has a noticeable Team 2 underperformance in this seed set; run a larger rotated team-seat simulation before making team-balance claims.
- 10v10 completed cleanly, but larger team modes still need UI and online-play planning before they become core product modes.

## Remaining Decisions Before Art

### True Ties

Simulations still produce rare `none` winners when simultaneous non-attack damage eliminates all remaining players and current tiebreakers cannot distinguish them.

Recommendation:

- Before card-front art, this does not block printing card text.
- Before final rules publication, decide whether "no winner" is acceptable or add a final deterministic tiebreaker such as seating order from current turn marker.

### Bot No-Ops

No-op decisions are not currently gameplay-breaking, but they make simulation output noisier.

Recommendation:

- Clean up bot strategy before relying on simulation results for fine balance tuning.
- Do not block art on this unless simulations become the only balance authority.

### Physical Markers

Some cards need physical marker guidance:

- Reload: marker until next weapon or end turn.
- Mark Target: marker until end of round.
- Intimidate: marker until source player's next turn.
- Smoke Bomb: marker until protected player's next turn.

Recommendation:

- Include these in the rulebook/reference sheet, not on card fronts.

## Art Readiness

The current `src/data/cards.ts` card names, counts, short text, and rules text can be treated as the art-generation source after deciding whether to alter the true-tie rule. No card currently needs a text rewrite for art-readiness.
