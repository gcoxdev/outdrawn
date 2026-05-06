# Last Hand Standing Simulation Report - 2026-05-06

## Run

Command:

```bash
node_modules/.bin/vite-node scripts/simulate-games.ts 5000 20260506
```

Sample:

- Games played: 5,000
- Completed games: 5,000
- Stalled games: 0
- Average rounds: 8.44
- Average turns: 23.31
- Minimum turns: 7
- Maximum turns: 41

## Winner Distribution

- Player 1: 437 wins, 8.74%
- Player 2: 783 wins, 15.66%
- Player 3: 1,346 wins, 26.92%
- Player 4: 2,103 wins, 42.06%
- No winner: 331 games, 6.62%

The no-winner result means all remaining players were eliminated by the same non-attack resolution, usually collapse/event damage. The engine now completes these games, but the rules need a tie-breaker.

## Damage And Survival

Observed totals:

- Attack damage: 287,557
- Event/collapse damage: 109,758
- Self damage: 8,400
- Healing: 52,710
- Prevented attack damage: 98,333

Derived ratios:

- Attack damage vs healing plus prevention: 287,557 / 151,043 = 1.90
- Attack plus event damage vs healing plus prevention: 397,315 / 151,043 = 2.63
- Event/collapse share of attack plus event damage: 27.62%

Interpretation:

Damage is favored, which matches the design goal. If manual testing feels too lethal, the first place to look is event/collapse pressure rather than weapon damage. Event/collapse damage is a large part of total pressure.

## Card Usage

Observed card/action usage:

- Attack cards played: 76,327
- Defense cards played: 28,146
- Healing cards played: 12,810
- Ability cards played: 48,065
- Event cards resolved: 40,262

Attack cards are used often, but non-attack card play is also high because abilities and defenses are now fully active. This suggests the game has enough interaction, but ability cards may be driving a lot of extra deck churn.

## Deck Balance Snapshot

Current deck model:

- Weapon cards: 29
- Defense plus healing cards: 27
- Ability cards: 21
- Weapon damage potential: 132
- Estimated survival value: 75
- Pressure-to-survival ratio: 1.76

This deck-level ratio looks reasonable. The observed in-game pressure ratio is higher mostly because events and collapse add a lot of damage after cards are exhausted or stalled.

## Potential Issues Found

1. Simultaneous elimination has no tie-breaker.

331 of 5,000 games ended with no winner. This is not a crash, but it is an unresolved rule. The game needs to say what happens when collapse or event damage eliminates all remaining players at the same time.

2. Turn-order/seat bias looks strong in bot play.

Player 4 won 42.06% of games while Player 1 won 8.74%. This may be partly caused by the deterministic bot policy and current first-player rotation, but it is large enough to investigate before assuming it is only a bot artifact.

3. Non-current players can exceed hand limit.

The simulator detected 215 cases where a non-current player exceeded max hand size. This can happen from loot, Supply Drop, Search/Market-style effects, or other card gain outside that player's normal end-turn discard check.

4. Game length may be slightly long.

Average length was 8.44 rounds. Previous target notes mentioned 5-7 rounds. The current length is still playable, but if real games drag, pressure should increase slightly after Round 6 or players should draw fewer non-damage options late.

5. Bot limitation: target/card choices are deterministic.

The simulator is useful for finding mechanical problems and rough balance, but it is not a strategic AI. Seat bias and card valuation need manual playtesting or a stronger bot before making major balance changes.

## Recommended Rule/Implementation Changes

1. Add a simultaneous-elimination tie-breaker.

Recommended rule: if all remaining players are eliminated by the same non-attack effect, the player who had the most health before that effect wins. If still tied, compare hand size. If still tied, declare shared defeat/no winner intentionally.

2. Enforce discard-down immediately after off-turn card gain.

Recommended implementation: whenever a player gains cards outside their own end turn, create a pending discard-down prompt if they exceed max hand size. This should apply to elimination loot, Supply Drop, Black Market, Search, Bounty draw, Painkillers draw, and normal draw refills.

3. Investigate seat bias with two alternate bot policies.

Run one simulation where targets are chosen randomly among valid players, and one where first-player index is fixed/rotated evenly across games. If Player 4 still dominates, inspect turn advancement and event timing.

4. Do not reduce weapon counts yet.

The deck-level pressure ratio is healthy and the observed attack damage is doing its job. If damage feels high, tune event/collapse pressure first.

5. Consider a gentler collapse curve only if manual tests feel abrupt.

Current data says event/collapse is responsible for 27.62% of total attack-plus-event damage. A possible adjustment is Round 3-6 collapse at 1 damage, Round 7 no increase, Round 9+ at 2 damage. Keep this as a playtest option, not an immediate change.

## Current Conclusion

The implementation is now mechanically complete enough for serious playtesting. The most important remaining rule clarifications are simultaneous elimination and discard-down timing after off-turn card gain. Balance currently favors damage, and the deck composition does not look underpowered on damage anymore.
