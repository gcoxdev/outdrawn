# Outdrawn

A local browser card battle for 3–100 human or computer players. Supports free-for-all and configurable teams, pass-device play, and installation for offline use.

## Run locally

Use Node.js 22.12 or newer and npm.

```bash
npm ci
npm run dev
```

Vite prints the local and LAN addresses. Development mode includes optional debug hand snapshots; use a production build for offline support.

```bash
npm run build
npm run preview
```

For installation from another device, follow [LAN HTTPS hosting](docs/lan-pwa-https-hosting.md). `npm run host:https` serves the production build using your local certificates. Both development and hosting bind all interfaces by default; use `HOST=127.0.0.1 npm run host:https` for loopback-only hosting.

## Checks

```bash
npm test
npm run build
npm run test:host
npm run test:browser
```

The browser smoke suite requires matching Chromium and ChromeDriver installations. It launches a disposable headless browser and temporary localhost server, exercises gameplay and privacy, then installs a second build and verifies an offline relaunch with updated code and artwork. Set `CHROMIUM`, `CHROMEDRIVER`, or `WEBDRIVER_PORT` to override its defaults. Host and browser tests need permission to open loopback sockets.

Game simulations share the live reducer. `simulateGame(seed, strategies, { strict: true })` fails on rejected actions, invalid health/elimination state, duplicate ownership, or lost cards instead of allowing recovery to conceal a failure. Simulation damage summaries describe observed net health changes; they are not a complete balance model of simultaneous healing and damage.

## Playing and saving

- [Current rules](docs/current-rules.md) describe the implemented game. They are also available in the in-game menu.
- A match is saved locally after each state change and restored on reload, including pending choices. Returning to the lobby clears the save; restarting replaces it. Saves belong to this browser and origin, and are not shared between devices. Browser storage restrictions can prevent saving; the game displays a warning when that happens.
- Pass-device mode hides human hands until the receiving player reveals them. Restoring a match resets that handoff gate.
- Bot difficulty controls decision heuristics. Bots still evaluate full game state in some heuristics and are not a simulation of strictly private human knowledge. Steal selects a random face-down card at every difficulty.
- Main and event discards can be inspected from the sidebar.

## Offline builds and updates

`npm run build` produces a release-specific service worker and generated `dist/offline-assets.json`. The cache version hashes shipped content, including artwork and the worker template. A failed precache rejects installation, preserving the existing release. The shell and its assets stay on the same release until an update activates.

Use **Menu → Check Updates**, then **Apply Update and Reload** when ready. Applying an update is disabled during a match. New installations need an online connection long enough to cache roughly 24 MiB of app and art. The build excludes unused review/source images from `dist`; originals remain under `public/` and elsewhere in the repository. Serve `dist/` as a complete deployment.

Stable URLs revalidate on the HTTPS host; only Vite's hashed assets are immutable. The app has one navigation route, `/`; missing assets and unknown paths return 404.

## Project map

- `src/game/`: state, reducer, resumable event draws, combat, settings, persistence, and simulations.
- `src/data/`: card definitions and default settings.
- `src/components/`: lobby, game board, shared dialogs, and offline controls.
- `scripts/`: production hosting, offline release generation, simulations, and browser checks.
- `tests/`: host/worker tests and browser fixtures; unit and rule tests live beside source.
- `docs/current-rules.md`: current gameplay reference.
- `docs/backlog.md`: future ideas, outside the cleanup scope.
- Root `last_hand_standing_*` files and dated design/simulation reports: historical material; current code and current rules supersede them.
- `internal/`: gitignored assessments, local probes, and working notes.

The event engine uses serializable draw continuations so nested effects resume after interactive choices. Turn legality and decision ownership are shared by the UI and engine; elimination finalization transfers or discards hands consistently. Logs retain the most recent 1,000 entries in memory and 250 in saved matches.
