# Player Count Simulation - 2026-05-07

## Scope

The current game setup supports 3 to 6 players. This run tested that full supported range as a baseline before designing arbitrary player counts or teams.

Each profile was simulated at 3, 4, 5, and 6 players:

- Competent mirror: 1,500 games with all players set to Competent.
- Mixed ladder: 3,000 games with increasing skill around the table.

Mixed ladder seats:

- 3 players: Beginner, Competent, Master
- 4 players: Beginner, Novice, Expert, Master
- 5 players: Beginner, Novice, Competent, Expert, Master
- 6 players: Beginner, Novice, Competent, Competent, Expert, Master

## Results

| Profile | Players | Competent Avg Rounds | Competent Avg Turns | Competent Ties | Mixed Avg Rounds | Mixed Avg Turns | Mixed Ties | Mixed Winner Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Current 20 / 5 / 7 / 2 | 3 | 7.36 | 18.44 | 2 | 7.19 | 17.81 | 8 | Master 1,347; Competent 1,213; Beginner 432. |
| Current 20 / 5 / 7 / 2 | 4 | 8.09 | 24.92 | 5 | 7.93 | 23.50 | 4 | Expert 1,107; Master 1,071; Novice 587; Beginner 231. |
| Current 20 / 5 / 7 / 2 | 5 | 8.57 | 31.18 | 2 | 8.57 | 30.00 | 3 | Master 807; Expert 831; Competent 662; Novice 485; Beginner 212. |
| Current 20 / 5 / 7 / 2 | 6 | 8.94 | 37.49 | 2 | 8.93 | 35.99 | 6 | Master 696; Expert 605; Competent seats 1,150 total; Novice 376; Beginner 167. |
| 25 / 7 / 10 / 3 | 3 | 7.17 | 17.46 | 3 | 6.80 | 16.33 | 4 | Master 1,453; Competent 1,262; Beginner 281. |
| 25 / 7 / 10 / 3 | 4 | 7.69 | 22.93 | 1 | 7.64 | 21.64 | 2 | Expert 1,120; Master 1,085; Novice 558; Beginner 235. |
| 25 / 7 / 10 / 3 | 5 | 8.11 | 28.77 | 1 | 8.13 | 27.09 | 3 | Master 869; Expert 861; Competent 700; Novice 430; Beginner 137. |
| 25 / 7 / 10 / 3 | 6 | 8.25 | 33.75 | 3 | 8.21 | 31.83 | 6 | Master 739; Expert 691; Competent seats 1,122 total; Novice 344; Beginner 98. |
| 25 / 6 / 9 / 3 | 3 | 7.10 | 17.39 | 2 | 6.95 | 16.78 | 0 | Master 1,418; Competent 1,270; Beginner 312. |
| 25 / 6 / 9 / 3 | 4 | 7.71 | 23.10 | 2 | 7.64 | 21.92 | 6 | Master 1,129; Expert 1,068; Novice 600; Beginner 197. |
| 25 / 6 / 9 / 3 | 5 | 8.20 | 29.41 | 4 | 8.20 | 27.88 | 6 | Master 888; Expert 784; Competent 701; Novice 467; Beginner 154. |
| 25 / 6 / 9 / 3 | 6 | 8.28 | 34.40 | 4 | 8.28 | 32.71 | 4 | Master 714; Expert 650; Competent seats 1,160 total; Novice 357; Beginner 115. |
| 30 / 7 / 10 / 3 | 3 | 8.10 | 20.42 | 1 | 7.93 | 19.73 | 3 | Master 1,466; Competent 1,292; Beginner 239. |
| 30 / 7 / 10 / 3 | 4 | 8.71 | 27.29 | 4 | 8.60 | 25.41 | 5 | Expert 1,153; Master 1,143; Novice 509; Beginner 190. |
| 30 / 7 / 10 / 3 | 5 | 8.88 | 33.66 | 1 | 8.93 | 31.65 | 3 | Master 891; Expert 877; Competent 652; Novice 423; Beginner 154. |
| 30 / 7 / 10 / 3 | 6 | 8.88 | 39.18 | 2 | 8.95 | 36.91 | 4 | Master 738; Expert 670; Competent seats 1,140 total; Novice 352; Beginner 96. |

## Readout

No profile stalled at any supported player count. True ties stayed low across the board.

Increasing player count mostly increases total turns, not round count. This is expected because each round contains more player turns. For example, the current defaults move from 18.44 competent turns at 3 players to 37.49 at 6 players, while rounds only move from 7.36 to 8.94.

The 25 / 7 / 10 / 3 profile remains the best candidate across player counts. It is faster than current defaults at every tested count while still giving players larger hands and more action flexibility. At 6 players, it averaged 33.75 competent turns versus 37.49 for current defaults.

The 30 / 7 / 10 / 3 profile is stable but consistently longer. It is playable at 3-6 players, but it is not the closest match to current pacing.

Skill signal generally holds. In 6-player mixed games, the two Competent seats together can out-total Master, but per seat Master remains stronger than either individual Competent seat.

## Scaling Concerns

At 5-6 players, area damage becomes more valuable. Minigun is especially sensitive because it hits every other living player. It is stable in the current 3-6 range, but it should be re-evaluated before supporting larger tables.

Starting hand size consumes a large share of the deck at higher counts. With 6 players and 7 starting cards, 42 main-deck cards are dealt immediately. That is acceptable in the current deck, but arbitrary player counts will need deck scaling or smaller starting hands.

Longer tables may need different UX pacing even if the rules remain stable. A 6-player game already lands around 32-37 total turns depending on defaults. Larger battle royale counts will need faster elimination pressure, simultaneous resolution, team phases, or a larger card economy.

## Recommendation

For the current 3-6 player game, keep testing:

- 25 starting/max health
- 7 starting cards
- 10 max cards
- 3 actions per turn

For larger future player counts, do not extrapolate directly from the 3-6 player results. The next analysis should model deck scaling and area-damage scaling before any arbitrary-player implementation.
