# Scalable Player Teams Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Outdrawn create and play local games with 3-100 players, generated team modes, and dynamic team ids while preserving current 3-6 player behavior.

**Architecture:** Add a small setup-domain module for player-count bounds, dynamic lobby modes, generated player slots, team assignment, and validation. Update game types/rules to treat team ids as dynamic strings. Refactor the lobby and roster to consume those helpers while leaving deck scaling and balance tuning for the next phase.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, existing reducer/game-state model.

---

## File Map

- Create `src/game/setupOptions.ts`: constants and pure helpers for player counts, generated names, lobby modes, team ids, team labels, team assignment, team validation, and setup slot normalization.
- Modify `src/game/types.ts`: make `TeamId` a string type and add setup-facing types if needed.
- Modify `src/game/rules.ts`: make `labelTeam` work for dynamic ids and keep teammate/win logic unchanged.
- Modify `src/game/setup.ts`: raise player validation to 3-100 and use exported player-count constants.
- Modify `src/components/SetupScreen.tsx`: replace fixed arrays and fixed team modes with dynamic slots and generated team helpers.
- Modify `src/components/PlayerRoster.tsx`: remove hard-coded team-a/b/c classes and add dynamic team labels/classes/data attributes.
- Modify `src/index.css`: add scalable lobby/player-list and dynamic team styling that does not rely on three fixed classes.
- Modify `src/components/SetupScreen.test.ts`: replace hard-coded 2v2/2v2v2/3v3 tests with generated mode validation tests.
- Modify `src/game/setup.test.ts`: assert 100-player setup is accepted and 101 is rejected.
- Modify or add targeted rule tests if dynamic team ids break team win/targeting.

## Task 1: Setup Option Helpers

**Files:**
- Create: `src/game/setupOptions.ts`
- Test: `src/components/SetupScreen.test.ts`

- [ ] **Step 1: Write failing tests for scalable lobby helpers**

Add tests that cover:

```ts
expect(getPlayerCountOptions()).toContain(100);
expect(generatePlayerSetups(10)).toHaveLength(10);
expect(assignTeamsForMode("duos", 6).map((team) => team)).toEqual(["team_1", "team_1", "team_2", "team_2", "team_3", "team_3"]);
expect(getTeamModeValidation("duos", assignTeamsForMode("duos", 6), 6).isValid).toBe(true);
expect(getTeamModeValidation("duos", assignTeamsForMode("duos", 5), 5).isValid).toBe(false);
expect(getTeamModeValidation("twoTeams", assignTeamsForMode("twoTeams", 100), 100).isValid).toBe(true);
expect(labelGeneratedTeam("team_27")).toBe("Team 27");
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/components/SetupScreen.test.ts --run`

Expected: FAIL because the new helpers/modes do not exist.

- [ ] **Step 3: Implement `setupOptions.ts`**

Add:

```ts
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 100;
export const PLAYER_COUNT_PRESETS = [4, 6, 10, 20, 50, 100] as const;
export type LobbyMode = "ffa" | "duos" | "trios" | "squads" | "twoTeams" | "custom";
```

Implement helpers:

- `clampPlayerCount(value: number): number`
- `getPlayerCountOptions(): number[]`
- `getDefaultPlayerName(index: number): string`
- `labelGeneratedTeam(teamId: TeamId): string`
- `getTeamOptionsForMode(mode: LobbyMode, playerCount: number): TeamId[]`
- `assignTeamsForMode(mode: LobbyMode, playerCount: number): TeamId[]`
- `getTeamModeValidation(mode: LobbyMode, teams: TeamId[], playerCount: number)`

Rules:

- FFA valid for 3-100.
- Duos divisible by 2.
- Trios divisible by 3.
- Squads divisible by 4.
- Two Teams divisible by 2.
- Custom requires at least two non-empty teams among active players.

- [ ] **Step 4: Re-run setup tests**

Run: `npm test -- src/components/SetupScreen.test.ts --run`

Expected: PASS after imports are corrected.

- [ ] **Step 5: Commit**

```bash
git add src/game/setupOptions.ts src/components/SetupScreen.test.ts
git commit -m "feat: add scalable setup helpers"
```

## Task 2: Dynamic Team Types And Rules

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/rules.ts`
- Test: `src/game/teams.test.ts`

- [ ] **Step 1: Write failing tests for dynamic team ids**

Add tests that assert:

```ts
expect(labelTeam("team_4")).toBe("Team 4");
expect(labelTeam("team_alpha")).toBe("Team Alpha");
```

Add a team win/hostility test using `team_12` and `team_24`, not `team_a`/`team_b`.

- [ ] **Step 2: Run team tests and verify failure**

Run: `npm test -- src/game/teams.test.ts --run`

Expected: FAIL because `TeamId` and labels are hard-coded.

- [ ] **Step 3: Update team typing and label logic**

Change `TeamId` in `src/game/types.ts` from a fixed union to:

```ts
export type TeamId = string;
```

Update `labelTeam` in `src/game/rules.ts` to delegate to `labelGeneratedTeam` or equivalent dynamic formatting.

Keep `areTeammates`, `isHostileTarget`, `getWinningTeamId`, and `getTeamMembers` behavior the same.

- [ ] **Step 4: Run team and setup tests**

Run:

```bash
npm test -- src/game/teams.test.ts src/components/SetupScreen.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/types.ts src/game/rules.ts src/game/teams.test.ts
git commit -m "feat: support dynamic team ids"
```

## Task 3: Raise Engine Player Limit

**Files:**
- Modify: `src/game/setup.ts`
- Modify: `src/game/setup.test.ts`

- [ ] **Step 1: Write failing engine setup tests**

Add tests:

```ts
const players = Array.from({ length: 100 }, (_, index) => `Player ${index + 1}`);
const state = createNewGame(players, () => 0.5);
expect(state.players).toHaveLength(100);
expect(state.players.every((player) => player.hand.length === STARTING_HAND_SIZE)).toBe(true);
expect(() => createNewGame(Array.from({ length: 101 }, (_, index) => `Player ${index + 1}`), () => 0.5)).toThrow("3 to 100 players");
```

- [ ] **Step 2: Run setup tests and verify failure**

Run: `npm test -- src/game/setup.test.ts --run`

Expected: FAIL because setup rejects more than 6 players.

- [ ] **Step 3: Implement limit change**

Import `MIN_PLAYERS` and `MAX_PLAYERS` from `setupOptions.ts` into `setup.ts` and replace hard-coded `3` and `6`.

Error message should become:

```ts
`Outdrawn requires ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`
```

- [ ] **Step 4: Run setup tests**

Run: `npm test -- src/game/setup.test.ts --run`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/setup.ts src/game/setup.test.ts
git commit -m "feat: allow up to 100 players"
```

## Task 4: Refactor Lobby To Dynamic Slots

**Files:**
- Modify: `src/components/SetupScreen.tsx`
- Modify: `src/components/SetupScreen.test.ts`
- Modify: `src/index.css`

- [ ] **Step 1: Add component-level tests for new lobby modes**

Extend tests to cover:

- The mode list includes Free-for-all, Duos, Trios, Squads, Two Teams, and Custom Teams.
- Selecting Duos with 6 players validates.
- Selecting Trios with 5 players disables start and shows a validation message.
- Player count can be set to 100.

Use existing test style in `SetupScreen.test.ts`.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/components/SetupScreen.test.ts --run`

Expected: FAIL because UI is still fixed to legacy modes/counts.

- [ ] **Step 3: Replace fixed setup arrays with generated slot arrays**

In `SetupScreen.tsx`:

- Import `LobbyMode`, `MAX_PLAYERS`, `MIN_PLAYERS`, `PLAYER_COUNT_PRESETS`, `assignTeamsForMode`, `clampPlayerCount`, `getDefaultPlayerName`, `getTeamModeValidation`, `getTeamOptionsForMode`.
- Replace separate `names`, `controls`, and `teams` arrays with a single slot array:

```ts
type SetupSlot = {
  name: string;
  control: ControlChoice;
  teamId?: TeamId;
};
```

- On player count change, grow/shrink slots while preserving existing edited values.
- On mode change, regenerate team ids for active slots.
- Convert active slots to `PlayerSetup[]` on start.

- [ ] **Step 4: Update lobby controls**

Replace modes:

- `ffa` label `Free-for-all`
- `duos` label `Duos`
- `trios` label `Trios`
- `squads` label `Squads`
- `twoTeams` label `Two Teams`
- `custom` label `Custom Teams`

Replace the player count select with presets plus enough support to choose 3-100. A numeric input is acceptable for this first pass if select options would be too long.

Add bulk controls:

- `Fill Computers` sets all non-first slots to `computer:competent`.
- `All Competent` sets all computer slots to competent.
- `All Master` sets all computer slots to master.

Keep the first player human by default.

- [ ] **Step 5: Keep large setup UI manageable**

For player counts above 20, show a compact note and render only the first 20 editable rows in this first pass, with a message that remaining slots use generated defaults. This is a temporary pragmatic step before virtualization.

Do not block start because only 20 rows are visible.

- [ ] **Step 6: Run setup screen tests**

Run: `npm test -- src/components/SetupScreen.test.ts --run`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/SetupScreen.tsx src/components/SetupScreen.test.ts src/index.css
git commit -m "feat: scale lobby player setup"
```

## Task 5: Roster Dynamic Team Styling

**Files:**
- Modify: `src/components/PlayerRoster.tsx`
- Modify: `src/index.css`
- Test: `src/components/GameTable.test.ts` or new focused roster test if existing patterns support it.

- [ ] **Step 1: Write a focused test or snapshot-free assertion**

Add a test that renders a game with `team_4` and asserts the roster displays `Team 4`.

- [ ] **Step 2: Run test and verify failure if current roster cannot display dynamic label**

Run: `npm test -- src/components/GameTable.test.ts --run`

Expected: FAIL or expose the missing dynamic styling/label path.

- [ ] **Step 3: Update roster class/data attributes**

In `PlayerRoster.tsx`, remove:

```ts
player.teamId === "team_a" ? "is-team-a" : ""
```

and fixed team-b/team-c checks.

Use:

```tsx
style={player.teamId ? { "--team-accent": getTeamColor(player.teamId) } as React.CSSProperties : undefined}
data-team-id={player.teamId}
```

Implement `getTeamColor(teamId)` in `setupOptions.ts` or a small UI helper.

- [ ] **Step 4: Update CSS**

Replace fixed `.is-team-a`, `.is-team-b`, `.is-team-c` styling with a generic team-accent custom property.

- [ ] **Step 5: Run roster/table tests**

Run: `npm test -- src/components/GameTable.test.ts --run`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/PlayerRoster.tsx src/index.css src/components/GameTable.test.ts src/game/setupOptions.ts
git commit -m "feat: style dynamic roster teams"
```

## Task 6: Integration And Regression Sweep

**Files:**
- Potentially modify any failing files found by the suite.

- [ ] **Step 1: Run targeted game tests**

Run:

```bash
npm test -- src/game/setup.test.ts src/game/teams.test.ts src/game/gameplayCorrections.test.ts src/game/events.test.ts src/game/reducer.test.ts --run
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `npm test -- --run`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Manual smoke test**

Start dev server:

```bash
npm run dev
```

Check:

- Default 4-player FFA still starts.
- 6-player Duos starts.
- 6-player Trios starts.
- 8-player Squads starts.
- 10-player Two Teams starts.
- 20-player FFA starts.
- 100-player FFA starts without obvious UI lockup.

- [ ] **Step 5: Commit any regression fixes**

```bash
git add <changed files>
git commit -m "fix: stabilize scalable player setup"
```

## Deferred Follow-Up

Do not implement in this plan:

- Automatic deck scaling.
- Large-count simulation reports.
- Virtualized roster/player setup.
- Online lobby/networking.
- Custom deck selection.
- Large-table card rebalance.

These require separate implementation after the engine/lobby foundation lands.
