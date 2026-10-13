# Outdrawn

Outdrawn is a local browser card battle for 3–100 human or computer players. Play free-for-all or in teams, with five computer difficulty levels and configurable match settings. Win by being the last player or team standing.

Built with React, TypeScript, and Vite.

## How to play

Set up your players and teams in the lobby, then start a match. Spend actions to draw cards, attack, use abilities, or heal. Defend against incoming attacks and manage your hand as collapse damage raises the pressure each round.

Read the [current rules](docs/current-rules.md) for card effects, turn order, and match settings. The rules are also available in the game menu.

Human players share one device. Enable pass-device mode to hide hands between players. Matches save automatically in the same browser and restore on reload; saves are not shared across devices.

## Run locally

Requires Node.js 22.12 or newer and npm.

```bash
npm ci
npm run dev
```

Open the address printed in the terminal.

To build and preview the production version:

```bash
npm run build
npm run preview
```

The production build is written to `dist/` and supports installation for offline play. Let the initial download finish before going offline. Installation on another device requires trusted HTTPS. Available updates can be applied from the game menu between matches.

## Development

Run the unit and game-rule tests with:

```bash
npm test
```

Additional host, desktop-browser, and mobile-browser checks are available in the `package.json` scripts; browser checks require their corresponding browser tools to be installed.
