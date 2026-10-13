# Settings Variation Simulation - 2026-05-08

## Scope

This pass tested the current game after recent settings, card, and rules changes.

Command:

```sh
node_modules/.bin/vite-node scripts/simulate-settings-variations.ts 1500 20260508
```

Each settings profile was simulated twice:

- 1,500 competent-vs-competent games.
- 1,500 mixed-skill games using Beginner, Novice, Expert, and Master.

Total games: 42,000.

## Readout

No scenario stalled. True ties remained low across the matrix, ranging from 0 to 6 per 1,500 games.

The default profile is still healthy:

- Competent: 7.72 average rounds, 23.32 average turns, 1 true tie.
- Mixed: 7.53 average rounds, 21.75 average turns, 0 true ties.
- Mixed skill wins: Beginner 159, Novice 247, Expert 547, Master 547.

Damage still outweighs healing/prevention by a useful margin. The default pressure-to-survival ratio was 2.50 in competent games and 2.73 in mixed games.

## Key Results

| Scenario | Strategy | Avg Rounds | Avg Turns | True Ties | Pressure / Survival | Skill Signal |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Default | Competent | 7.72 | 23.32 | 1 | 2.50 | Stable |
| Default | Mixed | 7.53 | 21.75 | 0 | 2.73 | Expert 547, Master 547 |
| Round robin | Competent | 7.68 | 23.28 | 6 | 2.50 | Stable, more ties |
| Round robin | Mixed | 7.69 | 22.22 | 0 | 2.65 | Expert 542, Master 510 |
| Secondary defense | Competent | 7.74 | 23.07 | 3 | 2.02 | Stable |
| Secondary defense | Mixed | 7.57 | 21.81 | 2 | 2.13 | Expert 589, Master 525 |
| Elimination reward 2 | Competent | 8.01 | 23.91 | 3 | 2.56 | Slightly longer |
| Elimination reward 2 | Mixed | 7.89 | 22.68 | 1 | 2.70 | Expert 556, Master 532 |
| Elimination reward 4 | Competent | 8.28 | 24.48 | 1 | 2.56 | Longer |
| Elimination reward 4 | Mixed | 7.99 | 22.89 | 1 | 2.80 | Expert 536, Master 536 |
| Black Market discount | Competent | 7.66 | 23.03 | 2 | 2.53 | Stable |
| Black Market discount | Mixed | 7.60 | 21.84 | 0 | 2.66 | Expert 551, Master 521 |
| Black Market no-action | Competent | 7.49 | 22.54 | 3 | 2.48 | Slightly faster |
| Black Market no-action | Mixed | 7.37 | 21.18 | 0 | 2.69 | Expert 531, Master 533 |
| Black Market bigger | Competent | 7.48 | 22.55 | 4 | 2.54 | Slightly faster |
| Black Market bigger | Mixed | 7.41 | 21.32 | 1 | 2.72 | Expert 574, Master 534 |
| Black Market health-pay | Competent | 7.07 | 21.50 | 2 | 2.22 | Fastest market |
| Black Market health-pay | Mixed | 7.37 | 21.37 | 4 | 2.45 | Expert 536, Master 529 |
| Variety standard | Competent | 7.96 | 23.73 | 2 | 2.10 | Stable |
| Variety standard | Mixed | 7.95 | 22.75 | 4 | 2.13 | Expert 613, Master 537 |
| 25 HP large hand | Competent | 7.36 | 21.55 | 2 | 2.23 | Faster, more actions |
| 25 HP large hand | Mixed | 7.27 | 20.20 | 1 | 2.44 | Master 565, Expert 534 |
| 25 HP large hand + variety | Competent | 7.64 | 22.16 | 4 | 1.89 | Slower pressure |
| 25 HP large hand + variety | Mixed | 7.60 | 21.01 | 1 | 1.91 | Expert 610, Master 561 |
| 6 players default | Competent | 8.54 | 35.08 | 4 | 2.47 | Longer but stable |
| 6 players default | Mixed | 8.64 | 33.39 | 2 | 2.54 | Master-heavy lineup wins most |
| 6 players variety | Competent | 9.10 | 36.71 | 5 | 2.06 | Longest tested |
| 6 players variety | Mixed | 9.16 | 34.76 | 3 | 2.01 | Master-heavy lineup wins most |

## Findings

The new settings are mechanically stable. There were no stalls, and unresolved true ties stayed below 0.5% in all tested scenarios.

Secondary defense is playable but noticeably softens player-caused damage. The pressure-to-survival ratio drops from 2.50 to 2.02 in competent games. That is still damage-favored, but it reduces the sharpness of Grenade, Minigun, Ricochet, Counterattack, and Backfire.

Elimination health reward is safe at 2. It adds about 0.3 rounds and 0.6 turns over default. A reward of 4 is still stable, but it starts stretching games and should remain optional rather than default.

Black Market variants are all stable. Discount, no-action, and bigger markets do not break pacing. Health-pay market is the fastest, because the health cost acts like self-pressure.

The 25 HP / 7 starting / 10 max / 3 actions profile remains viable, especially without the extra variety toggles. It is faster in these runs than default because extra cards and actions increase attack access. When combined with secondary defense and elimination reward, the pressure-to-survival ratio drops below 2.0, which is probably too soft for the main default.

Six-player games are stable but materially longer. Default six-player games averaged about 35 turns. Six-player variety games averaged about 37 turns and had lower pressure. This is acceptable for optional larger tables, but not something to use as the baseline balance target.

## Recommendations

Keep the current default settings for now:

- Standard turn order.
- No secondary defense by default.
- 0 elimination health reward.
- Standard Black Market.
- 20 health, 5 starting cards, 7 max cards, 2 actions.

Good optional presets:

- Black Market discount: improves market usability without disrupting balance.
- Black Market bigger: gives a more exciting market with stable pacing.
- Elimination reward 2: safe as an optional snowball/recovery setting.
- 25 HP / 7 / 10 / 3: viable as an alternate larger-hand preset.

Avoid as defaults for now:

- Secondary defense combined with elimination reward, because it softens damage too much.
- Six-player variety settings, because they make games noticeably longer.
- Elimination reward 4, because the longer pacing is not buying much strategic value.

Follow-up:

- If the goal is for Master to consistently beat Expert in four-player mixed games, tune bot heuristics rather than card balance. The current balance itself is stable, but Expert and Master are still close in several profiles.
