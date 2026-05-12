# Scalable Players And Teams Design

## Goal

Expand Outdrawn from the current 3-6 player prototype into a scalable local game foundation that can support up to 100 players, dynamic team sizes, computer-heavy battle royale games, and future online multiplayer without rewriting the core model later.

This design is online-ready but local-first. It does not add networking, lobbies-by-code, accounts, matchmaking, or servers yet. It does shape player/team/game setup data so those features can be added later without replacing the local game engine.

## Current Constraints

- `createNewGame` rejects games outside 3-6 players.
- `TeamId` is currently fixed to `team_a | team_b | team_c`.
- The lobby mode list is fixed to free-for-all, 2v2, 2v2v2, and 3v3.
- Setup state uses fixed six-element arrays for names, controls, and teams.
- Team validation is hard-coded per mode.
- Deck size and composition are not scaled for larger tables.
- The roster and setup UI are built for a small number of visible players.
- Existing team rules are a good foundation: team win condition, teammate hand visibility, optional teammate healing, optional card transfer, and no friendly fire on area damage.

## Recommended Approach

Use a flexible game-mode system instead of adding many one-off modes. The core game should understand players, teams, and deck profiles independently:

- `PlayerSlot`: pre-game setup identity, controller, optional team assignment, and later online connection state.
- `TeamSetup`: id, name, color, target size, and roster order.
- `LobbyMode`: describes how teams are generated and validated.
- `DeckScaleProfile`: describes how card counts scale with player count and team mode.

This lets local play support large computer games now while keeping the data model close to what online multiplayer will need later.

## Player Counts

Supported range:

- Minimum: 3 players.
- Maximum: 100 players.

Initial implementation should keep the current 3-6 flow working exactly from a gameplay perspective, then progressively unlock larger games behind the same lobby screen.

For large local games, setup needs bulk controls:

- Player count input or stepper with quick presets: 4, 6, 10, 20, 50, 100.
- Fill missing slots with computer players.
- Set all computer skill levels.
- Set all players to Human or Computer only for visible/selected rows.
- Generate default names for all slots.

Manual editing 100 rows one by one should not be required.

## Team Modes

Replace fixed modes with these modes:

- Free-for-all: every player has no team.
- Duos: teams of 2.
- Trios: teams of 3.
- Squads: teams of 4.
- Two Teams: split all players across 2 teams, supporting formats like 2v2, 3v3, 10v10, and 50v50.
- Custom Teams: host can assign any player to any generated team, with validation requiring at least two teams with living players at game start.

Validation rules:

- Free-for-all requires 3-100 players.
- Duos requires an even player count.
- Trios requires player count divisible by 3.
- Squads requires player count divisible by 4.
- Two Teams requires an even player count and creates two equal teams.
- Custom Teams allows uneven teams, but must require at least two teams and no empty named team included in play.

Team ids should become dynamic strings such as `team_1`, `team_2`, etc. Team labels can default to Team A, Team B, Team C, continuing alphabetically or numerically for large counts.

Team colors should be generated from a stable palette, then repeated with variants if the team count exceeds the palette. The same color should appear in roster grouping, player cards, current-player indicators, and win screens.

## Lobby UI

The lobby should move from fixed rows to scalable setup controls:

- Summary controls at the top: mode, player count, team size/team mode, default controller, default bot skill.
- Bulk actions below summary controls.
- Player list virtualized or paginated for large counts.
- Collapsible team groups when team mode is active.
- Search/filter for player slots when the count is large.
- Per-player row: name, controller, team, and later online seat/status.

For 3-10 players, showing all rows is fine. For 20-100 players, the UI should avoid rendering full card-like rows for every player at once.

## Game Table UI

The main table should remain focused on the current decision-maker:

- Current player hand and action panel stay central.
- Roster moves to grouped/collapsible sections for team games.
- Large free-for-all roster should support compact rows, filters, and maybe alive/eliminated grouping.
- The log should remain filterable by player and eventually team.
- Human privacy rules remain: humans should only see their own hand and teammate hands. Computer-only endgames can still reveal all hands.

Rendering 100 full player cards at once should be avoided. The roster should become a compact status list rather than a card grid.

## Deck Scaling

Do not multiply the current deck blindly. Large games change card value:

- Area damage scales up sharply as player count grows.
- Single-target damage can become too slow at 50-100 players.
- Defense prompts and secondary reactions can create too much interruption.
- Healing and stall cards can make large games drag if scaled evenly.
- Events that affect everyone become much stronger and slower to resolve physically.

Add an automatic deck scaling profile:

- Start from the current default deck as the 3-6 player baseline.
- Scale weapons slightly faster than healing/defense.
- Scale card draw and market effects carefully to avoid runaway hand churn.
- Cap or rewrite global area damage cards for large tables.
- Use different scaling for free-for-all and team games.

Suggested first implementation:

- `DeckScaleProfile = "auto" | "manualMultiplier" | "custom"` later.
- Start with `"auto"` only.
- Compute total desired deck size from player count, starting hand size, expected draw volume, and target game length.
- Preserve approximate card-type ratios, then apply large-table overrides.

Large-table card concerns:

- Minigun should likely hit a capped number of opponents, all opponents in a small game, or use reduced damage at large counts.
- Grenade seating-order splash remains physically understandable and scales well.
- Events should remain immediate and simple.
- Secondary defense should probably default off for large games, or apply only to direct targeted attacks.

## Turn Order And Pacing

The existing standard turn order and round-robin setting should remain, but large games need simulation before changing defaults.

Risks:

- A 100-player game with two actions each can take too long before a player acts again.
- Full-table effects can be slow if every player must make a decision.
- Elimination pacing may need more aggressive pressure after player count thresholds.

Recommendation:

- Keep current turn model initially.
- Run simulations for 6, 10, 20, 50, and 100 players.
- Track turns to finish, rounds to finish, eliminations per round, no-winner rate, damage/survival ratio, and team/seat bias.
- Consider large-table-only rules after evidence, such as higher damage pressure, lower starting health, more area cards, or faster draw cycling.

## Online-Ready Data Model

The local model should leave room for online fields without implementing them yet:

`PlayerSlot` should eventually support:

- slot id
- display name
- controller type: local human, computer, remote human
- bot skill if computer
- team id
- seat index
- connected/disconnected status later
- ready state later

`TeamSetup` should support:

- team id
- name
- color
- member slot ids

`GameSetup` should support:

- lobby mode
- player slots
- teams
- game settings
- deck scale profile

The game engine can still convert setup data into current `PlayerState` objects when the game starts.

## Physical Play Compatibility

Large player counts are mostly digital-first, but rules should remain physical-friendly when possible:

- Seating order must stay explicit for splash effects.
- Team assignment must be visible and simple.
- Events should resolve immediately and avoid hidden ongoing state.
- Global effects should avoid requiring random hidden selection by software.
- Deck scaling should map to physical deck presets or printed card counts.

For physical 50-100 player games, the game may require multiple decks or a large-table printed deck. The digital game can generate scaled decks automatically, but rules should still be explainable as card-count presets.

## Testing And Simulation

Required tests:

- Setup accepts 3-100 players and rejects outside that range.
- FFA creates no teams.
- Duos/trios/squads/two-team modes generate correct teams.
- Invalid mode/player-count combinations disable game start.
- Custom team validation rejects one-team or empty-team setups.
- Team win condition works with more than three teams.
- Teammate visibility works for dynamic teams.
- Area damage avoids friendly fire with dynamic teams.
- Deck generation produces enough cards for initial hands at 100 players.

Required simulations:

- FFA: 6, 10, 20, 50, 100 players.
- Duos: 6, 10, 20, 50, 100 players where divisible.
- Squads: 8, 20, 100 players.
- Two Teams: 10v10 and 50v50.
- Mixed bot skills and same-skill bot tables.

Simulation output should report:

- games played
- average turns and rounds
- no-winner/tie rate
- damage dealt vs healing/prevention
- average deck reshuffles
- average eliminations per round
- winner distribution by seat, team, and skill
- stalls or games exceeding turn caps

## Implementation Stages

1. Refactor types and setup validation:
   - Dynamic `TeamId`.
   - Player cap constants.
   - Setup helpers for player slots and generated teams.

2. Refactor lobby setup:
   - Dynamic player arrays.
   - Scalable mode selector.
   - Bulk player/controller controls.
   - Validation for FFA, duos, trios, squads, two teams, and custom teams.

3. Refactor team-aware rules:
   - Replace hard-coded team assumptions.
   - Verify targeting, teammate healing, card transfer, ricochet, splash, win detection, and privacy.

4. Refactor roster UI:
   - Compact rows.
   - Collapsible team groups.
   - Avoid rendering large full-card rosters.

5. Add deck scaling:
   - Auto profile first.
   - Simulate before adding manual/custom controls.

6. Run large-count simulations:
   - Produce a report and tune only after results.

## Open Decisions

- Should very large games allow all current reaction chains, or should large-table mode simplify reactions?
- Should Minigun remain “all opponents” or become capped above a player-count threshold?
- Should large team modes use shared team incentives or remain mostly individual cards plus team win condition?
- Should the lobby expose custom teams immediately, or start with generated team modes first?
- What is the target average length for 20, 50, and 100 player games?

## Recommendation

Proceed with stages 1-3 first. That creates the scalable foundation without committing to deck balance too early. After the engine and lobby can represent 100-player FFA and generated team modes, run simulations before changing card counts or adding new large-table cards.
