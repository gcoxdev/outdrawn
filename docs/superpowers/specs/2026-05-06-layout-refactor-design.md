# Last Hand Standing Layout Refactor Design

## Goal

Refactor the current game table layout into a more scalable play surface without changing game rules, player-count limits, teams, cards, bot logic, or simulation behavior.

The immediate target is a cleaner 3-6 player interface. The design should also prepare the roster area for later support of larger player counts and team grouping.

## Non-Goals

- No arbitrary player-count support in this pass.
- No team rules or team data model in this pass.
- No card-balance changes.
- No simulation changes.
- No new gameplay mechanics.

## Layout Direction

Use the approved "Design A" structure:

- Left operations sidebar.
- Main decision workspace.
- Floating menu remains available.
- Current top status bar becomes a compact decision strip inside the main workspace or disappears as a major layout element.

The left sidebar owns long-running context:

- Player roster.
- Game log.
- Deck/discard/event counts.

The main workspace owns the current task:

- Round and decision summary.
- Active/decision player's hand.
- Action panel.
- Attack targets.
- Pending reactions, discard choices, Search picks, Supply Drop picks, and Black Market picks.

## Desktop Structure

Desktop shell:

```text
+----------------------+------------------------------------------+
| Players              | Round 4 - Ari's turn                     |
| roster               |                                          |
|                      | Active hand                              |
|----------------------|                                          |
| Log + deck counts    | Actions / selected card / targets        |
+----------------------+------------------------------------------+
```

The sidebar should use a fixed initial width suitable for compact player cards. The player/log split should start around 65/35 in favor of players.

A resize handle between the player roster and log is preferred. If browser persistence is added, store only local UI preference, not game state.

## Player Roster

The player roster should become denser than the current player strip.

Each player row/card should show:

- Name.
- Health.
- Hand count.
- Actions remaining when relevant.
- Current/decision state.
- Eliminated state.
- Important status chips such as smoke protection, marked target, attack bonus, or intimidation if already easy to derive.

The current player or pending decision player should visually bubble to the top. The remaining players should retain turn-order context below. This gives immediate clarity without losing seating/rotation information.

Future team mode can reuse this roster by adding grouped sections:

- Team A expanded/collapsed.
- Team B expanded/collapsed.
- Active team expanded automatically.
- Opposing teams collapsed when not relevant.

That grouping is not implemented in this pass, but the roster component should be structured so grouping can be added later.

## Log Area

The log remains in the sidebar under the roster.

At the top of the log area, show:

- Main deck count.
- Main discard count.
- Active event name.
- Event deck count.

Debug hand snapshots remain collapsed inside log entries and continue to appear only when development debug snapshots are enabled.

## Main Workspace

The main workspace should prioritize the player’s immediate decision.

Top decision strip:

- Round number.
- Current decision text, such as `Ari's turn`, `Blake is defending`, `Casey must discard`, or `Devon is choosing Search`.
- The active event can be repeated here only if it does not duplicate the log header too heavily.

Hand area:

- Shows the display player's hand or card backs according to existing privacy rules.
- Should not stretch cards vertically when action/log content gets long.
- Should keep stable card sizing with responsive grid behavior.

Action area:

- Existing `ActionPanel` behavior remains intact.
- Pending decisions should stay in the main workspace.
- Target selection remains close to selected weapon/ability context.

## Mobile Structure

Mobile should keep a tabbed flow, but simplify around the new shell:

- `Play`: decision strip, active hand, and action panel.
- `Players`: roster.
- `Log`: counts and game log.

The current four-tab model can collapse to three tabs because hand and actions are part of one task on small screens.

## Component Plan

Expected component changes:

- `GameTable`: owns the new shell and decision summary.
- `PlayerPanel`: likely becomes usable in compact roster mode, or a new `PlayerRoster` component wraps it.
- `GameLog`: remains focused on log rendering.
- `GameMenu`: remains floating.
- CSS: replace top-strip plus board-grid layout with sidebar/workspace shell.

Potential new component:

- `PlayerRoster`: receives players, current player id, decision player id, and relevant status maps. It renders the active/decision player first and the remaining players in turn-order context.

## Data Flow

No reducer or state model changes are required.

The layout can derive everything it needs from existing `GameState`:

- Current player from `getCurrentPlayer`.
- Decision player from `getDecisionPlayerId`.
- Display player from existing pending-state precedence.
- Active event from `state.activeEvent`.
- Counts from deck/discard arrays.
- Status chips from existing state maps.

## Testing

Automated tests should remain focused on existing game behavior. This is mostly a presentation refactor, so the required verification is:

- `npm test`
- `npm run build`
- Manual browser check at desktop and mobile widths.

Manual checks:

- Floating menu does not overlap important counts.
- Current/decision player is obvious.
- Pending reaction/discard/Search/Supply Drop/Black Market prompts remain understandable.
- Cards do not stretch vertically.
- Mobile tabs expose Play, Players, and Log cleanly.

## Risks

- Moving panels can accidentally hide the decision context.
- Making the roster too compact can reduce readability.
- A resize handle can add complexity; if it slows the pass down, ship the layout with a fixed 65/35 split first and add resizing afterward.
- Bubbling active players to the top can obscure turn order unless the rest of the roster remains clearly ordered.

## Recommended Implementation Order

1. Create the shell layout in `GameTable`.
2. Move deck/discard/event counts into the log header inside the sidebar.
3. Build or adapt a compact roster.
4. Move the decision summary out of the old top bar and into the main workspace.
5. Convert mobile tabs to `Play`, `Players`, and `Log`.
6. Add the player/log resize handle if the fixed split is stable.
7. Verify tests, production build, and manual responsive layout.
