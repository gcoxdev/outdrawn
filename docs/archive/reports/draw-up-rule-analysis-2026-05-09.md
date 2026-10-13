# Draw-Up Rule Analysis

## Context

The backlog idea is to add a draw-up rule where players refill cards automatically, while still only taking the configured number of actions on their turns. This is intended to reduce dead turns where players lack useful damage or action cards.

## Main Concern

Full round-start draw-up to max hand size is a larger balance change than it first appears. With current defaults, players would often begin each round at 7 cards. That increases options, but it also increases defense, healing, reaction availability, hand-limit friction, and deck cycling.

## Potential Issues

- More cards strongly buffs defense and healing because players are more likely to hold Shield Plate, Armor Vest, Dodge, Revive, Bandage, Medkit, and similar survival cards.
- Draw cards and draw actions lose value if players already refill automatically. Search, Supply Drop, Painkillers draw, Bounty draw, Black Market, and the normal Draw action all become less special.
- Players exceed max hand size more often after steals, looting eliminated players, Search, Supply Drop, Black Market, or teammate transfers.
- Team games can exploit refill more because teammates can transfer cards and smooth hands across the team.
- Deck cycling accelerates, especially with 4-6 players. More cycling means more reshuffles and more event cards revealed.
- Mixed event cards create timing questions. If a player draws events during automatic refill, the game must define whether those events resolve immediately and in what order.
- Pending decisions can interrupt round start. Search, Supply Drop, and Black Market can create pending choices before the next player acts.
- Physical play overhead increases if automatic refill triggers events and multiple players must pause to resolve effects mid-refill.

## Event Timing Gotchas

The current event model says events resolve when drawn. A draw-up rule should probably keep that behavior for consistency. That means round-start refill can become a resolution phase instead of a quick upkeep step.

Open questions:

- Do players draw up in seating order from the first player?
- Does one player fully resolve their refill before the next player draws?
- If an event eliminates someone before their refill, do they skip refill?
- If Supply Drop, Search, or Black Market creates a pending choice during refill, does the refill sequence pause until resolved?

## Cleaner Variants

These are lower-risk alternatives to full round-start draw-up to max:

- Current rules: no automatic refill. Players use actions and cards to draw.
- Start-of-turn floor: at the start of a player's turn, if they have fewer than a set number of cards, draw up to that floor. Example: draw up to 5.
- Round-start fixed draw: each living player draws a fixed amount at round start, such as 1 card.
- Low-hand refill only: at round start, players with 3 or fewer cards draw up to 5.
- Full draw-up to max: at round start, each living player draws up to max hand size.

## Future Setting Idea

Add a lobby setting for refill behavior instead of hard-coding one rule.

Possible options:

- No automatic refill
- Start turn: draw up to X
- Round start: draw N
- Round start: low-hand refill to X
- Round start: draw up to max hand size

The setting should include numeric fields where relevant, such as refill floor, fixed draw amount, and low-hand threshold.

## Recommendation

Do not make full draw-up to max the default yet. The safest first test candidate is:

`At the start of each player's turn, if they have fewer than 5 cards, draw until they have 5. Events drawn this way resolve immediately.`

This reduces dead turns without flooding every hand, keeps draw cards valuable, avoids long round-start pending chains, and should be easier to simulate and physically play.

Before implementing any refill variant as a default, run simulations across free-for-all and team games because the rule can shift damage/survival balance significantly.
