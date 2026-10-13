# Last Hand Standing Playable Core Design

## Goal

Build a local browser prototype for Last Hand Standing that is playable enough to validate the core loop quickly. The app should prioritize readable cards, clear turn flow, legal move enforcement, and a useful log over complete rules coverage.

## Scope

The first implementation will create a Vite React TypeScript app with local state only. It will support 3-6 hot-seat players from one browser.

Implemented behavior:

- Setup screen for player count and names.
- Main and event deck expansion from the provided card dataset.
- Shuffle, deal 5 cards, set all players to 20 health, and choose a random first player.
- Current player hand visibility.
- Turn loop with 2 actions per turn.
- Draw 1 card, pass, end turn.
- Equip one weapon and one defense item.
- Attack with equipped weapons.
- Apply Armor Vest reduction unless a weapon ignores armor.
- Apply opening damage cap during rounds 1-2.
- Track Shotgun cooldown.
- Play simple healing cards: Bandage, Medkit, Painkillers.
- Eliminate players at 0 health and detect the winner.
- Log setup, actions, attacks, damage, eliminations, and round changes.

Deferred behavior:

- Reaction prompts and reaction defense.
- Stances.
- Event resolution.
- Loot selection.
- Complex abilities such as Steal, Search, Mark Target, Disarm, Black Market, and Supply Drop choices.
- Online multiplayer, accounts, persistence, animations, and final art.

## Architecture

Use React with a centralized reducer. Keep game transitions in `src/game/reducer.ts`, and move reusable rule calculations into small helper modules so reactions and events can be added without rewriting the reducer.

Primary modules:

- `src/data/cards.ts`: card definitions copied from the generated dataset.
- `src/data/constants.ts`: health, hand size, actions, and damage cap values.
- `src/game/types.ts`: game state, player, card, and action types.
- `src/game/deck.ts`: deck expansion, shuffle, drawing, card lookup.
- `src/game/setup.ts`: new game creation.
- `src/game/rules.ts`: selectors and legal move helpers.
- `src/game/combat.ts`: attack damage calculation and application.
- `src/game/reducer.ts`: action handling and turn progression.
- `src/components/*`: setup, table layout, cards, panels, actions, and log.

## UI

Use a dense battle-table layout:

- Top status bar: round, phase, current player, active event placeholder.
- Opponent strip: all players with HP, hand count, equipment, and eliminated state.
- Center area: selected card details, legal targets, action prompts.
- Current player board: equipped weapon, equipped defense, HP, actions.
- Hand rail: readable card views with type colors and key stats.
- Side or bottom log: chronological debug-friendly game history.

The card component should follow the generated card UI design spec: type-colored framing, compact stat chips, strong card names, short rules text in hand mode, and a larger detail mode for selected cards.

## Testing

Add focused tests for the highest-risk non-visual behavior:

- Deck expansion produces the expected number of card instances.
- New game creates the requested players and deals starting hands.
- Equip replaces the relevant equipment slot and spends an action.
- Basic attack applies damage, armor reduction, opening damage cap, and elimination.
- Round advancement resets actions and cooldown state.

If the scaffold or dependency state makes test setup expensive, prioritize typechecking and a manual browser smoke test for this first pass, then add tests once the app is stable.
