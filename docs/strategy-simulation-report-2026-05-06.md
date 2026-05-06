# Last Hand Standing Strategy Simulation Report - 2026-05-06

## Implementation Changes

This pass added a basic five-level strategy engine to the automated simulator:

- Beginner: random card choices, inconsistent reactions, sometimes passes Supply Drop.
- Novice: mostly reasonable card choices with some noise and lower healing discipline.
- Competent: baseline deterministic policy.
- Expert: prioritizes pressure, uses setup abilities before attacks, reacts efficiently.
- Master: similar to expert with slightly tighter targeting and discard valuation.

It also implemented two rule fixes recommended by the previous report:

- Simultaneous non-attack elimination now breaks ties by pre-effect health, then hand size.
- Search, Black Market, and Supply Drop now create an immediate discard-down prompt when an off-turn card gain exceeds max hand size.

## Commands

Same-level batches:

```bash
node_modules/.bin/vite-node scripts/simulate-games.ts 5000 20260506 beginner
node_modules/.bin/vite-node scripts/simulate-games.ts 5000 20260506 novice
node_modules/.bin/vite-node scripts/simulate-games.ts 5000 20260506 competent
node_modules/.bin/vite-node scripts/simulate-games.ts 5000 20260506 expert
node_modules/.bin/vite-node scripts/simulate-games.ts 5000 20260506 master
```

Mixed batches:

```bash
node_modules/.bin/vite-node scripts/simulate-games.ts 5000 20260506 beginner,novice,expert,master
node_modules/.bin/vite-node scripts/simulate-games.ts 5000 20265506 master,beginner,novice,expert
node_modules/.bin/vite-node scripts/simulate-games.ts 5000 20270506 expert,master,beginner,novice
node_modules/.bin/vite-node scripts/simulate-games.ts 5000 20275506 novice,expert,master,beginner
```

## Same-Level Results

| Strategy | Games | Stalls | Avg Rounds | Avg Turns | Attack Damage | Event Damage | Healing | Prevented Damage | Attack Cards | Defense Cards | Ability Cards | True Ties |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Beginner | 5,000 | 0 | 8.21 | 22.13 | 285,473 | 105,586 | 43,818 | 60,243 | 71,411 | 10,275 | 46,476 | 12 |
| Novice | 5,000 | 0 | 8.52 | 23.60 | 279,417 | 113,406 | 45,949 | 92,073 | 74,664 | 23,080 | 50,867 | 27 |
| Competent | 5,000 | 0 | 8.40 | 23.16 | 286,698 | 108,701 | 49,584 | 98,495 | 76,226 | 28,160 | 47,967 | 33 |
| Expert | 5,000 | 0 | 8.09 | 21.78 | 289,749 | 105,485 | 47,110 | 106,539 | 78,876 | 31,042 | 43,268 | 27 |
| Master | 5,000 | 0 | 8.06 | 21.70 | 288,646 | 104,733 | 45,019 | 106,828 | 78,666 | 31,149 | 43,250 | 32 |

## Same-Level Interpretation

The strategy engine is now useful for pressure testing. Expert and master games finish about 1.5 turns faster than competent games while playing more attack cards and fewer low-value ability actions. That is closer to how stronger players should behave: apply pressure, spend defenses when worthwhile, and avoid spending too many actions on healing or resource loops.

Damage still clearly beats survival:

- Beginner attack damage vs healing plus prevention: 285,473 / 104,061 = 2.74
- Competent attack damage vs healing plus prevention: 286,698 / 148,079 = 1.94
- Expert attack damage vs healing plus prevention: 289,749 / 153,649 = 1.89
- Master attack damage vs healing plus prevention: 288,646 / 151,847 = 1.90

Event/collapse pressure remains meaningful, usually around 26-29% of attack plus event damage. I would not increase weapon damage right now.

## Mixed Results

Single fixed mixed run, seats 1-4 as Beginner, Novice, Expert, Master:

| Strategy | Wins | Win Rate |
| --- | ---: | ---: |
| Beginner | 806 | 16.12% |
| Novice | 641 | 12.82% |
| Expert | 1,583 | 31.66% |
| Master | 1,939 | 38.78% |
| No winner | 31 | 0.62% |

Rotated mixed aggregate across 20,000 games, with each strategy occupying each seat once:

| Strategy | Wins | Win Rate |
| --- | ---: | ---: |
| Beginner | 5,970 | 29.85% |
| Novice | 4,165 | 20.83% |
| Expert | 5,155 | 25.78% |
| Master | 4,603 | 23.02% |
| No winner | 107 | 0.54% |

The fixed mixed result looks sensible, but the rotated aggregate shows that strategy strength is still strongly tangled with seat/target dynamics. Beginner overperforms in the rotated set because random targeting and lower survival spending sometimes create better table pressure than the more structured strategies.

## Issues Found

1. Seat bias remains the largest simulation concern.

Same-level winner distribution still favors later seats. In master-vs-master, Player 4 won 1,776 games while Player 1 won 903. That is much better than the earlier competent-only report, but still too large to ignore.

2. Remaining no-winner games are true ties after the new tie-breaker.

The simulator no longer reports broad "game over without winner" or hand-limit issues. Remaining no-winner games are exact ties after comparing pre-effect health and hand size. This occurs in roughly 0.24-0.66% of games.

3. Strategy-vs-strategy results are useful but not authoritative yet.

The bots are heuristics, not AI players. They can now find mechanical problems and broad balance issues, but mixed strategy rankings should not drive card balance until seat bias is reduced.

4. Ability usage may still be too high in weaker play.

Beginner and novice runs play 46,476-50,867 ability cards per 5,000 games. Expert/master play about 43,250 while ending faster. This suggests some abilities are attractive to bots but not always productive. That is probably fine for casual play, but it is worth watching during manual tests.

## Recommendations

1. Do not change card counts yet.

The current deck balance still favors damage without ending games too quickly. Expert/master games average just over 8 rounds and about 22 turns. That is slightly longer than the earlier 5-7 round target, but current event pressure is already significant.

2. Fix or deliberately accept seat bias before serious balance tuning.

Best next implementation target: rotate first-player advantage each game or alter target selection incentives so the table does not naturally leave late-seat players healthier. A simulation setting that randomizes player seating would also help separate strategy strength from seat position.

3. Decide the exact-tie rule.

Recommended rule: if pre-effect health and hand size are also tied, the tied players are all eliminated and there is no winner. That is what the engine effectively does now. If that feels unsatisfying, add a final tiebreaker such as most cards in discard caused by player damage, most eliminations, or earliest seat in turn order.

4. Keep the pressure-oriented expert/master policy.

The first advanced policy overvalued healing and resource cards. The updated policy produces faster games and more attack-card usage without increasing card damage.

## Current Conclusion

The game is mechanically stable under 45,000 fresh simulated games from this pass: 25,000 same-level games plus 20,000 rotated mixed games, with no stalls. Balance still favors damage. The main unresolved design question is not damage quantity; it is seat/target bias and whether exact simultaneous-collapse ties should remain possible.
