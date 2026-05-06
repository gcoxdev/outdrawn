# Last Hand Standing Playable Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local hot-seat React TypeScript prototype that supports setup, card rendering, turns, equipment, simple healing, basic combat, eliminations, and winner detection.

**Architecture:** Use a Vite React app with a centralized `useReducer` game engine. Keep card/deck/setup/rules/combat helpers separate from UI components so reactions, events, stances, and loot can be added later without rewriting the core.

**Tech Stack:** Vite, React, TypeScript, Vitest, lucide-react, CSS modules/global CSS.

---

## File Structure

- Create `package.json`, `index.html`, `tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`.
- Create `src/main.tsx`, `src/App.tsx`, `src/index.css`.
- Create `src/data/cards.ts`, `src/data/constants.ts`.
- Create `src/game/types.ts`, `src/game/actions.ts`, `src/game/deck.ts`, `src/game/setup.ts`, `src/game/rules.ts`, `src/game/combat.ts`, `src/game/reducer.ts`.
- Create `src/components/CardView.tsx`, `SetupScreen.tsx`, `PlayerPanel.tsx`, `GameTable.tsx`, `ActionPanel.tsx`, `GameLog.tsx`.
- Create focused tests in `src/game/*.test.ts`.

## Task 1: Scaffold App

- [ ] Add Vite/React/TypeScript config and dependencies.
- [ ] Add empty React shell with global CSS.
- [ ] Run `npm install`.
- [ ] Run `npm run build` and fix scaffold issues.

## Task 2: Data And Deck Tests

- [ ] Write failing Vitest tests for deck expansion count and unique instance IDs.
- [ ] Add card data from `last_hand_standing_card_dataset_v_0.ts`.
- [ ] Implement constants and deck helpers.
- [ ] Run targeted tests and confirm they pass.

## Task 3: Setup Tests And Engine

- [ ] Write failing tests for 3-player setup: health, starting hands, deck size, random first player bounds.
- [ ] Implement core types and `createNewGame`.
- [ ] Run targeted tests and confirm they pass.

## Task 4: Turn And Equipment Tests

- [ ] Write failing tests for draw action, equip weapon/defense, action spending, end turn, and round rollover.
- [ ] Implement actions, selectors, reducer turn flow, and equipment replacement.
- [ ] Run targeted tests and confirm they pass.

## Task 5: Combat And Healing Tests

- [ ] Write failing tests for armor reduction, armor-ignoring damage, opening cap, shotgun cooldown, healing, elimination, and winner detection.
- [ ] Implement combat helpers and reducer attack/heal handling.
- [ ] Run targeted tests and confirm they pass.

## Task 6: UI

- [ ] Implement card rendering from the UI design spec with type colors, stat chips, and selected detail view.
- [ ] Implement setup screen, game table, player panels, actions, target picker, and log.
- [ ] Connect UI to reducer and enforce legal visible actions.
- [ ] Run `npm run build`.

## Task 7: Manual Smoke Test

- [ ] Start the dev server.
- [ ] Use the browser to start a 3-player game.
- [ ] Verify cards render, equipment works, draw/pass/end turn work, attacks apply damage, and a winner can be produced.
- [ ] Fix issues found during smoke testing.
