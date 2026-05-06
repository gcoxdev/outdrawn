# Last Hand Standing Project Review - 2026-05-06

## Executive Summary

Last Hand Standing now has a strong playable prototype foundation. The core card loop is implemented: players draw, play one-time weapons, react with defense, use abilities, heal, resolve events, discard down, loot eliminated players, and win by being the last player alive. The app supports local human play, computer players at five skill levels, hidden opponent hands, debug log snapshots, simulation tooling, and a game menu with rules/settings/card catalog.

The biggest improvement since the earlier reports is that the simulator is no longer dominated by seat bias. Same-skill simulations are now roughly balanced by seat, and mixed-skill simulations now generally rank outcomes by skill level, with Master leading Expert after the latest tuning.

The project is ready for serious manual playtesting. The next phase should focus less on adding more card mechanics and more on validating feel: turn clarity, hidden-information flow, event pacing, exact tie handling, and whether human players understand why the game state changes.

## Current Strengths

1. The reducer-first game engine is a good architecture.

Most game rules are enforced in the reducer/combat layer rather than scattered through UI components. This has paid off: simulations, tests, human UI, and computer-player UI all use the same action model. Keep this pattern.

2. Card implementation is effectively complete for the current deck.

`src/game/cardStatus.ts` marks all current weapons, defenses, abilities, healing cards, and events as implemented. Tests cover core behavior for SMG, Smoke Bomb, Disarm, Steal, Sabotage, Mark Target, Reload, Search, Supply Drop, Black Market, and the event deck.

3. The simulation harness is now useful.

The simulator catches stalls, over-hand-limit bugs, unresolved true ties, damage/survival ratios, and strategy outcomes. It is not a true AI, but it is good enough to detect mechanical problems and broad balance patterns.

4. The UI now supports both test mode and real-ish play.

Opponent cards can be hidden, computer players can act automatically, and debug snapshots can still reveal hands through the log. This is the right balance for this stage.

5. Automated coverage is meaningful.

Current test suite: 62 passing tests across setup, deck helpers, reducer turns, combat, abilities, reactions, events, search, settings, balance, gameplay corrections, and simulator behavior.

## Current Simulation Read

Latest mixed-skill rotated aggregate across 20,000 games:

| Strategy | Wins | Win Rate |
| --- | ---: | ---: |
| Beginner | 1,830 | 9.15% |
| Novice | 3,690 | 18.45% |
| Expert | 7,074 | 35.37% |
| Master | 7,274 | 36.37% |
| No winner | 165 | 0.83% |

Latest Master-vs-Master seat check:

| Player 1 | Player 2 | Player 3 | Player 4 | No Winner |
| ---: | ---: | ---: | ---: | ---: |
| 1,192 | 1,285 | 1,187 | 1,294 | 42 |

Interpretation:

- Seat bias is no longer the dominant problem.
- Skill level now matters in the expected direction.
- Expert and Master are still close, which is acceptable. Master leads, but not by so much that Expert becomes irrelevant.
- No-winner true ties remain below 1%. That is acceptable for now, but it still needs a final design decision.

## Key Gaps And Risks

### 1. Rules Document Drift

The current rules markdown still contains older concepts that are not implemented or no longer match the web prototype. Examples:

- Initiative by revealing weapons is described, but the app currently randomizes first player.
- Stance Phase is described, but there is no stance system in the app.
- Some roadmap text still references old equipment/cooldown-era planning.
- The rules document mixes design intent, current rules, roadmap, and historical notes.

Recommendation:

Create a clean `current-rules.md` that only describes the implemented web prototype. Move future ideas and historical notes to separate design docs. This will reduce confusion during playtesting.

### 2. Exact Tie Handling

The engine breaks simultaneous non-attack elimination ties by pre-effect health and then hand size. If still tied, no winner is declared. Simulations show this happens in under 1% of games.

Recommendation:

For a tabletop-feeling battle royale, a true no-winner result is acceptable but slightly anticlimactic. I recommend adding one final tiebreaker:

1. Highest pre-effect health.
2. Largest hand.
3. Most cards in discard caused by that player’s attacks, if we add tracking.
4. If still tied, no winner.

Do not use seat order as the final tiebreaker unless we want a simple but arbitrary rule.

### 3. Debug Log Snapshot Cost

Every log entry stores every player’s hand at that moment. This is excellent for debugging, but it grows with log length and hand size.

Recommendation:

Keep it for now. Later, add a `debugMode` setting and only store hand snapshots when enabled. For production or non-debug play, hand snapshots should be disabled.

### 4. UI Density And Mobile Ergonomics

The UI is improving, but the game is information-dense. The biggest mobile risks are:

- Card text becoming hard to read.
- Action panel and log competing with the active hand.
- Pending decision prompts appearing far from the relevant player context.
- Debug log hand snapshots adding vertical bulk.

Recommendation:

Next UI pass should introduce mobile-specific tabs or collapsible panels:

- `Hand`
- `Actions`
- `Players`
- `Log`

Desktop can keep the current multi-column board. Mobile should prioritize one active task at a time.

### 5. Human Turn Privacy

Computer hands are hidden unless only computers remain. For local human hot-seat play, the active human’s hand is visible. This is playable, but real hot-seat privacy still requires social handling: players must look away between turns.

Recommendation:

Add an optional “pass device” interstitial before a human decision. Example: “Blake’s turn. Pass the device to Blake. Reveal hand.” This should be optional because it slows testing.

### 6. Bot Strategy Is Good Enough, Not Final AI

The five strategy levels now produce sensible aggregate outcomes, but they remain heuristics. They know all hands in simulation/live computer play, which is acceptable for testing but not a fair model of human hidden-information play.

Recommendation:

Split bot knowledge into two modes later:

- `omniscient`: current mode, useful for stress testing.
- `fair`: only uses public state plus inferred hand counts/types where visible.

This matters if the computer players are intended as a real single-player mode rather than only test opponents.

### 7. Some Legacy State Fields Should Be Removed

`PlayerState` still contains `equippedWeapon`, `equippedDefense`, and `weaponCooldowns`, while the current rules no longer use equipment and Shotgun is now one-time use with no cooldown.

Recommendation:

Remove unused equipment/cooldown state in a cleanup pass. This will reduce confusion and prevent future bugs caused by dead concepts.

## Balance Assessment

Current deck-level pressure looks healthy:

- Weapon cards: 29
- Defense plus healing cards: 27
- Ability cards: 21
- Weapon damage potential: 132
- Estimated survival value: 75
- Pressure-to-survival ratio: 1.76

Observed play favors damage, but not so heavily that defenses/healing are irrelevant. Expert/Master games tend to play many defenses and still finish in a reasonable number of turns.

Current recommendation:

Do not change card counts yet. Manual playtesting should come first. If human games feel too long, adjust event/collapse pressure before increasing weapon damage. If human games feel too abrupt, reduce collapse/event damage before weakening weapons.

## Recommended Next Implementation Phases

### Phase 1: Rules And State Cleanup

Priority: High

- Create a clean implemented-rules document.
- Remove or quarantine old rules text that mentions unimplemented phases.
- Remove `equippedWeapon`, `equippedDefense`, and `weaponCooldowns` from state if no code needs them.
- Confirm card catalog text and rules tab use only current wording.

Why:

This prevents the design from drifting back toward old equipment/cooldown assumptions.

### Phase 2: Manual Playtest Support

Priority: High

- Add optional pass-device/reveal-hand screen for human hot-seat privacy.
- Add a debug toggle for hand snapshots.
- Add clearer “why this is pending” instruction text in all pending panels.
- Add a compact current-effect strip showing active event, mark target, smoke protection, intimidations, and attack bonuses.

Why:

The mechanics exist, but human players need better affordances to understand state changes.

### Phase 3: Endgame And Tie Policy

Priority: Medium

- Decide final exact-tie rule.
- Track player-caused eliminations or damage dealt if we want better final tiebreakers.
- Improve winner modal with final standings and final hands.

Why:

Endgame clarity matters more once people start playing full games manually.

### Phase 4: Bot Fairness And Single-Player Quality

Priority: Medium

- Add fair-knowledge bot mode.
- Track known public information separately from hidden hands.
- Add bot personality descriptions in setup so skill levels feel understandable.
- Add a simulation report command that automatically runs all standard scenarios and writes a timestamped markdown report.

Why:

Current bots are good for testing. A fair bot would be better for actual play against computers.

### Phase 5: UI Mobile Mode

Priority: Medium

- Convert mobile layout into tabbed task panels.
- Keep active hand fixed-size and non-stretching.
- Make log snapshots collapsed by default, possibly hidden unless debug is on.
- Add visual indicators for playable cards, reaction cards, and cards blocked by current pending state.

Why:

The game is dense. Mobile can work, but only if the interface focuses the player on one decision at a time.

### Phase 6: Balance Playtesting

Priority: Medium

Run structured manual sessions:

- 4 humans, no bots.
- 1 human plus 3 computer players.
- 2 humans plus 2 computer players.
- All master bots as a stress test.

Track:

- Average game length.
- Whether players understand why they took damage.
- Whether defense feels too weak or too available.
- Whether events feel exciting or arbitrary.
- Whether players prefer true no-winner ties or a final tiebreaker.
- Which cards feel confusing.

## Highest-Value Next Steps

If choosing only three things, I recommend:

1. Clean up rules/state drift.
2. Add pass-device plus debug toggle.
3. Run a structured manual playtest and record findings in a new doc.

These are higher value than adding more cards right now. The prototype already has enough mechanics to reveal real gameplay problems; the next risk is clarity and playtest quality, not missing content.

## Current Verdict

The project is in a good prototype state. The game loop is mechanically complete enough to test seriously, and the bot/simulation layer is strong enough to catch broad balance issues. The main work now is consolidation: make the rules clear, remove stale state, improve player-facing clarity, and gather manual playtest evidence before making major balance changes.
