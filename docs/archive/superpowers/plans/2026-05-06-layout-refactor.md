# Layout Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current top-bar/player-strip layout with a left operations sidebar and a main decision workspace while preserving all existing game behavior.

**Architecture:** Keep game state and reducer logic unchanged. `GameTable` remains the composition root, with a new `PlayerRoster` presentation component for compact player context and CSS controlling desktop sidebar/mobile tab behavior. Existing `ActionPanel`, `GameLog`, `GameMenu`, and card rendering remain behaviorally intact.

**Tech Stack:** React 19, TypeScript, Vite, plain CSS, Vitest.

---

## File Structure

- Create `src/components/PlayerRoster.tsx`
  - Renders compact roster rows.
  - Accepts ordered players plus current/decision/display identifiers and status maps.
  - Bubbles the decision player/current player to the top while keeping the rest in existing player order.

- Modify `src/components/GameTable.tsx`
  - Replace status-bar/player-strip/board-grid shell with `game-shell`, `operations-sidebar`, and `decision-workspace`.
  - Change mobile tabs from `Hand`, `Actions`, `Players`, `Log` to `Play`, `Players`, `Log`.
  - Keep pass-device overlay logic unchanged.

- Modify `src/index.css`
  - Add desktop two-column shell.
  - Add sidebar player/log split with a simple resize handle.
  - Add compact roster row styling.
  - Remove or neutralize old player-strip/top-status layout rules that no longer apply.
  - Update mobile layout to map tabs to `Play`, `Players`, and `Log`.

- Optionally modify `src/components/PlayerPanel.tsx`
  - Only if reusable status formatting can be shared cheaply.
  - Avoid a broad refactor if `PlayerRoster` is clearer as a separate compact component.

---

### Task 1: Add Compact Player Roster Component

**Files:**
- Create: `src/components/PlayerRoster.tsx`
- Modify: none initially

- [ ] **Step 1: Create `PlayerRoster.tsx`**

Implement a presentation-only component:

```tsx
import type { GameState, PlayerId, PlayerState } from "../game/types";

type PlayerRosterProps = {
  state: GameState;
  currentPlayerId: PlayerId;
  decisionPlayerId: PlayerId;
  displayPlayerId: PlayerId;
};

export function PlayerRoster({ state, currentPlayerId, decisionPlayerId, displayPlayerId }: PlayerRosterProps) {
  const orderedPlayers = orderPlayersForRoster(state.players, decisionPlayerId, currentPlayerId);

  return (
    <section className="player-roster" aria-label="Players">
      <div className="sidebar-section__header">
        <p className="eyebrow">Players</p>
        <strong>{state.players.filter((player) => !player.eliminated).length} alive</strong>
      </div>
      <div className="player-roster__list">
        {orderedPlayers.map((player) => (
          <article
            className={[
              "player-roster-card",
              player.id === decisionPlayerId ? "is-decision" : "",
              player.id === currentPlayerId ? "is-current" : "",
              player.id === displayPlayerId ? "is-display" : "",
              player.eliminated ? "is-eliminated" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            key={player.id}
          >
            <div>
              <h3>{player.name}</h3>
              <p>{labelController(player)}</p>
            </div>
            <strong>{player.health} HP</strong>
            <dl>
              <div>
                <dt>Cards</dt>
                <dd>{player.hand.length}</dd>
              </div>
              <div>
                <dt>Actions</dt>
                <dd>{player.actionsRemaining}</dd>
              </div>
            </dl>
            <div className="player-roster-card__chips">
              {player.id === decisionPlayerId && <span>Decision</span>}
              {player.id === currentPlayerId && <span>Turn</span>}
              {state.smokeProtectedPlayerIds.includes(player.id) && <span>Smoke</span>}
              {state.markedTargets[player.id] && <span>Marked +{state.markedTargets[player.id]}</span>}
              {state.attackBonuses[player.id] && <span>Ambush +{state.attackBonuses[player.id]}</span>}
              {player.eliminated && <span>Out</span>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function orderPlayersForRoster(players: PlayerState[], decisionPlayerId: PlayerId, currentPlayerId: PlayerId): PlayerState[] {
  const priority = players.find((player) => player.id === decisionPlayerId) ?? players.find((player) => player.id === currentPlayerId);
  return priority ? [priority, ...players.filter((player) => player.id !== priority.id)] : players;
}

function labelController(player: PlayerState): string {
  return player.controller.type === "computer" ? `Computer - ${capitalize(player.controller.strategy)}` : "Human";
}

function capitalize(value: string): string {
  return value[0].toUpperCase() + value.slice(1);
}
```

- [ ] **Step 2: Run type/build check**

Run: `npm run build`

Expected: PASS. The new component compiles even before being used.

- [ ] **Step 3: Commit**

```bash
git add src/components/PlayerRoster.tsx
git commit -m "feat: add compact player roster"
```

---

### Task 2: Refactor `GameTable` Shell

**Files:**
- Modify: `src/components/GameTable.tsx`

- [ ] **Step 1: Replace shell composition**

In `GameTable.tsx`:

- Import `PlayerRoster`.
- Replace the old `<header className="status-bar">`, `<section className="player-strip">`, and `<section className="board-grid">` structure.
- Keep all existing derived values: `currentPlayer`, `decisionPlayerId`, `displayPlayer`, `selectedDefinition`, `activeEventDefinition`, `privacyGateActive`.

Target JSX shape:

```tsx
<main className={`game-table mobile-tab-${activeMobileTab}`}>
  {state.phase === "gameOver" && <WinnerModal winner={winner} dispatch={dispatch} />}
  <GameMenu settings={state.settings} dispatch={dispatch} />

  <nav className="mobile-board-tabs" aria-label="Board sections">
    {(["play", "players", "log"] as MobileTab[]).map(...)}
  </nav>

  <section className="game-shell">
    <aside className="operations-sidebar board-panel board-panel-players">
      <div className="sidebar-pane sidebar-pane--players">
        <PlayerRoster
          state={state}
          currentPlayerId={currentPlayer.id}
          decisionPlayerId={decisionPlayerId}
          displayPlayerId={displayPlayer.id}
        />
      </div>
      <div className="sidebar-resize-handle" aria-hidden="true" />
      <div className="sidebar-pane sidebar-pane--log board-panel-log">
        <div className="log-panel__meta">...</div>
        <GameLog entries={state.log} />
      </div>
    </aside>

    <section className="decision-workspace board-panel board-panel-play">
      <header className="decision-strip">...</header>
      <section className="current-board">...</section>
      <ActionPanel ... />
    </section>
  </section>

  {privacyGateActive && ...}
</main>
```

- [ ] **Step 2: Update `MobileTab` type**

Change:

```ts
type MobileTab = "hand" | "actions" | "players" | "log";
```

To:

```ts
type MobileTab = "play" | "players" | "log";
```

- [ ] **Step 3: Keep decision text equivalent**

Move existing status `h1` logic into `decision-strip`.

Do not change the text logic except where labels are clearer:

- Reaction.
- Redirect.
- Attack cost.
- Discard.
- Supply pick.
- Market pick.
- Current turn.

- [ ] **Step 4: Remove old `PlayerPanel` usage from `GameTable`**

Delete the `PlayerPanel` import if it is no longer used.

- [ ] **Step 5: Build**

Run: `npm run build`

Expected: PASS or CSS-only layout may look rough but TypeScript compiles.

- [ ] **Step 6: Commit**

```bash
git add src/components/GameTable.tsx
git commit -m "feat: refactor game table shell"
```

---

### Task 3: Implement Desktop Sidebar/Workspace CSS

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add new shell styles**

Add:

```css
.game-shell {
  display: grid;
  grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
  gap: 10px;
  min-height: calc(100vh - 20px);
}

.operations-sidebar {
  display: grid;
  grid-template-rows: minmax(260px, 65fr) 8px minmax(180px, 35fr);
  min-height: 0;
  padding: 8px;
}

.sidebar-pane {
  min-height: 0;
  overflow: auto;
}

.sidebar-resize-handle {
  align-self: center;
  height: 4px;
  border-radius: 999px;
  background: rgba(244, 238, 226, 0.14);
}

.decision-workspace {
  display: grid;
  grid-template-rows: auto minmax(0, auto) minmax(0, 1fr);
  gap: 10px;
  min-width: 0;
  padding: 10px;
}

.decision-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
```

- [ ] **Step 2: Add compact roster styles**

Add styles for:

- `.player-roster`
- `.sidebar-section__header`
- `.player-roster__list`
- `.player-roster-card`
- `.player-roster-card.is-decision`
- `.player-roster-card.is-current`
- `.player-roster-card.is-eliminated`
- `.player-roster-card__chips`

Keep rows compact and readable. Use existing colors and radius scale.

- [ ] **Step 3: Retire old layout assumptions**

Remove or stop relying on:

- `.status-bar` as a primary page element.
- `.player-strip` for desktop.
- `.board-grid` three-column desktop layout.

Do not delete classes still used by setup or other components unless `rg` confirms they are unused.

- [ ] **Step 4: Build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "style: add sidebar game layout"
```

---

### Task 4: Update Mobile Tabs And Responsive CSS

**Files:**
- Modify: `src/components/GameTable.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Change rendered mobile tab labels**

Use:

```tsx
{(["play", "players", "log"] as MobileTab[]).map((tab) => (
  <button ...>{tab}</button>
))}
```

If desired, label with capitalization through CSS text transform.

- [ ] **Step 2: Update mobile visibility rules**

Replace old hand/actions/player/log tab CSS with:

```css
@media (max-width: 720px) {
  .game-shell {
    display: block;
    min-height: 0;
  }

  .operations-sidebar {
    display: contents;
  }

  .game-table.mobile-tab-play .board-panel:not(.board-panel-play),
  .game-table.mobile-tab-players .board-panel:not(.board-panel-players),
  .game-table.mobile-tab-log .board-panel:not(.board-panel-log) {
    display: none;
  }
}
```

Adjust if `display: contents` causes styling issues; a block layout with duplicated panel classes is acceptable.

- [ ] **Step 3: Verify no card stretching**

Check `.hand-rail`, `.card-view`, and `.card-back` still have stable aspect-ratio behavior.

- [ ] **Step 4: Build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/GameTable.tsx src/index.css
git commit -m "style: simplify mobile game tabs"
```

---

### Task 5: Manual Verification And Final Cleanup

**Files:**
- Modify only if verification finds issues.

- [ ] **Step 1: Run full tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: build completes.

- [ ] **Step 3: Start or reuse dev server**

Run: `npm run dev`

Expected: Vite prints a local URL. If an existing server is already running, use its URL.

- [ ] **Step 4: Manual desktop check**

At desktop width, verify:

- Floating menu is visible and not covering deck/log counts.
- Sidebar shows players above log.
- Decision player/current player is visually obvious.
- Main workspace shows decision strip, hand, and action panel.
- Pending reaction/discard/Search/Supply Drop/Black Market flows still show the correct action panel.

- [ ] **Step 5: Manual mobile check**

At mobile width, verify:

- Tabs show `Play`, `Players`, `Log`.
- `Play` shows decision strip, hand, and actions.
- `Players` shows compact roster.
- `Log` shows counts and log.
- Cards keep a stable aspect ratio.

- [ ] **Step 6: Cleanup old unused CSS**

Run:

```bash
rg -n "status-bar|player-strip|board-grid|board-panel-actions|board-panel-hand" src
```

Remove rules only if no longer used.

- [ ] **Step 7: Final commit**

```bash
git add src
git commit -m "chore: clean up legacy layout styles"
```

Skip this commit if there is no cleanup.

