# Alternate Defaults Simulation - 2026-05-07

## Profiles Tested

Baseline:
- 20 starting/max health
- 5 starting cards
- 7 max cards
- 2 actions per turn

Requested alternate:
- 30 starting/max health
- 7 starting cards
- 10 max cards
- 3 actions per turn

Additional nearby profiles:
- 25 health, 6 starting cards, 9 max cards, 3 actions
- 30 health, 6 starting cards, 9 max cards, 2 actions
- 25 health, 7 starting cards, 10 max cards, 3 actions

Each profile was simulated as competent-vs-competent for 1,500 games and mixed skill for 3,000 games.

## Results

| Profile | Scenario | Avg Rounds | Avg Turns | True Ties | Skill / Seat Notes |
| --- | --- | ---: | ---: | ---: | --- |
| Current 20 / 5 / 7 / 2 | Competent | 8.09 | 24.80 | 3 | Same-skill seats balanced. |
| Current 20 / 5 / 7 / 2 | Mixed | 7.96 | 23.49 | 6 | Expert 1,102, Master 1,011, Novice 589, Beginner 292. |
| Requested 30 / 7 / 10 / 3 | Competent | 9.01 | 28.52 | 2 | Same-skill seats balanced, but longer. |
| Requested 30 / 7 / 10 / 3 | Mixed | 8.91 | 26.73 | 5 | Master 1,198, Expert 1,064, Novice 543, Beginner 190. |
| 25 / 6 / 9 / 3 | Competent | 7.87 | 23.91 | 2 | Same-skill seats balanced. |
| 25 / 6 / 9 / 3 | Mixed | 7.83 | 22.56 | 2 | Master 1,145, Expert 1,115, Novice 552, Beginner 186. |
| 30 / 6 / 9 / 2 | Competent | 10.53 | 35.45 | 3 | Too slow. |
| 30 / 6 / 9 / 2 | Mixed | 10.60 | 33.88 | 5 | Too slow despite good skill signal. |
| 25 / 7 / 10 / 3 | Competent | 7.81 | 23.45 | 1 | Same-skill seats balanced. |
| 25 / 7 / 10 / 3 | Mixed | 7.76 | 22.06 | 2 | Master 1,135, Expert 1,121, Novice 517, Beginner 225. |

## Readout

The requested 30 / 7 / 10 / 3 profile is stable and preserves skill signal, but it is noticeably longer than the current default. It adds about 0.9 rounds and 3-4 turns per game. That may be fine if the desired feel is a larger, more tactical table state, but it is not closest to current pacing.

The 30-health profiles show that health is the main driver of longer games. Keeping 30 health while staying at 2 actions is too slow. Giving 3 actions helps, but games still run longer than baseline.

The two 25-health profiles were closest to the current balance while still testing the bigger-hand, 3-action feel:

- 25 / 6 / 9 / 3 is the safer change. It stays near current pacing and gives players more action flexibility without flooding hands too much.
- 25 / 7 / 10 / 3 is the best match if the goal is specifically larger hands. It is slightly faster than current in mixed games because extra cards and actions increase attack access.

## Recommendation

Do not switch directly to 30 / 7 / 10 / 3 as the default unless we intentionally want longer games.

Best next default candidate:
- 25 starting/max health
- 7 starting cards
- 10 max cards
- 3 actions per turn

This keeps the larger-hand concept, keeps true ties low, keeps skill signal, and stays closest to current pacing.

If manual playtesting feels too explosive with 7 starting cards, use 25 / 6 / 9 / 3 instead.
