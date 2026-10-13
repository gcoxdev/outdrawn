# Outdrawn Rules Freeze Review - 2026-05-13

## Purpose

This review reassesses the current implemented rules before AI card-front art is generated. The goal is to avoid regenerating art because of late card text changes.

The current rules are mostly solid. The remaining work is not a full redesign. It is a freeze pass: remove contradictions, reduce ambiguous wording, improve physical-card playability, and resolve card mechanics that may not scale cleanly.

## Source Of Truth Checked

- `src/data/cards.ts`
- `src/data/constants.ts`
- `src/game/reducer.ts`
- `src/game/combat.ts`
- `src/game/simulator.ts`
- `docs/current-rules.md`
- `docs/backlog.md`

## Recommended Freeze Standard

Before generating card fronts, every card should satisfy these rules:

1. The card text matches implementation exactly.
2. The card can be resolved in a physical game without hidden digital state.
3. The card works in free-for-all and team modes unless explicitly marked otherwise.
4. The card still makes sense at larger player counts.
5. The card's short text is concise enough for card art.
6. The rules text explains only the rule, not implementation details.

## Core Rules Assessment

The core loop is ready to freeze:

- Players take turns spending actions.
- Weapons and played cards are single-use unless a card says otherwise.
- Defense cards are reactions from hand, not equipment.
- Events are mixed into the main deck and resolve immediately when drawn.
- Event cards do not cost an action and are discarded after resolving.
- Players may exceed max hand size during play but must discard down before ending their turn.
- Eliminating a player with an attack grants their remaining hand as loot.
- Event/collapse eliminations discard the eliminated player's hand.
- Team mode uses no friendly fire for area damage.

These rules are coherent for digital and physical play.

## Art-Blocking Issues

### 1. Minigun Needs A Final Decision

Current rule:

- Deal 2 damage to up to 6 opponents in seating order.

Current concerns:

- It scales awkwardly with player count.
- It does not ask for a target, so "seating order" needs a clear starting point.
- It is strong in large games but not very interesting tactically.
- Attack bonuses such as Ambush currently apply as increased damage to each affected player, which can spike too hard if many targets are hit.
- Physical play is less clear because players need to know exactly who the six affected opponents are.

Recommended replacement:

> **Minigun**: Allocate 6 damage among any opponents, max 3 damage per opponent. Each chosen opponent may defend once against the total assigned to them.

Recommended bonus rule:

> Attack bonuses add to the Minigun damage pool, not to each target.

Examples:

- Normal Minigun: allocate 6 total damage, such as 3/3, 2/2/2, or 1/1/1/1/1/1.
- Minigun with Ambush: allocate 9 total damage, max 3 per opponent.
- In team games, allocation can only target opponents.

Why this is better:

- It scales cleanly at 4 players and 100 players.
- It gives the attacker a meaningful choice.
- It avoids automatic large-table damage spikes.
- It is easy to explain on a physical card.
- It gives defense one clear window per affected player.

Decision:

- Use **6 total damage** first. With Ambush it becomes 9, which is already strong. If simulations show Minigun underperforms, raise the pool to 8 later before art generation.

### 2. High Ground Name And Metadata Are Misaligned

Current text:

- Each living player draws 1 card.

Current issue:

- The card name "High Ground" implies attack advantage, but the implemented effect is a table-wide draw.
- Metadata still includes damage/first-attack style fields and tags even though the current effect is card draw.

Recommendation:

- Either keep the simple effect and rename the event, or restore an attack-advantage effect.

Freeze option:

> **Scavenge**: Each living player draws 1 card. Players may exceed max hand size during play, but must discard down before ending their turn.

Why:

- "Scavenge" matches a table-wide draw better than "High Ground."
- It is clear in physical play.
- It avoids lingering round-based modifiers.

Follow-up:

- Preserve High Ground as a future card concept in the backlog.

### 3. Black Market Should Be Clearly Personal

Current implemented behavior:

- The player who draws Black Market may make one configured exchange.

Current issue:

- Card metadata still marks it as targeting all players.
- The rules are mostly correct, but the card text should make it impossible to read as a table-wide event.

Recommended card text:

> **Black Market**: You may make the configured market exchange once. Reveal cards until the market has enough non-event cards. Keep the chosen cards and discard the rest.

Recommended rule:

- Event cards revealed for market inventory are discarded and replaced.
- Black Market never costs an action.
- Black Market affects only the player who drew it.

### 4. Supply Drop Is Clean Enough To Freeze

Current rule:

- The drawer draws 3.
- The player may exceed max hand size during play.
- They must discard down before ending their turn.

Recommendation:

- Freeze this rule.

Suggested card text:

> Draw 3 cards. You may exceed max hand size during play, but must discard down before ending your turn.

### 5. Events Should Use Consistent Language

Current model is good:

- Events resolve immediately when drawn.
- Events are discarded after resolving.
- Events do not consume actions.

Recommendation:

- Do not print "does not cost an action" on every event card.
- Put that rule in the rulebook/menu.
- Keep event card text focused on the event effect.

### 6. Secondary Defense Needs One Stable Rule

Current setting:

- Defense on secondary attacks can be enabled or disabled.

Current concern:

- If this stays configurable, card art should avoid text that assumes one setting.

Recommendation:

- Keep the setting in the game rules, not on individual card fronts.
- Card text should use general wording such as "attack damage" or "damage from one attack."
- Rules/menu should state whether Grenade splash, Minigun damage, Ricochet, Counterattack, and Backfire are defensible.

Art impact:

- Do not print "cannot be defended" or "may be defended" on individual attack cards unless the rule becomes non-configurable.

### 7. Revive Is Ready To Freeze

Current rule:

- When another player's attack would eliminate you, survive at 1 health.
- Apply all available healing cards.
- Discard the rest.

Recommended card text:

> When another player's attack would eliminate you, survive at 1 health. Apply all available healing cards, then discard the rest.

Open choice:

- Decide whether Revive should work against event/collapse damage.

Recommendation:

- Keep it attack-only. Event/collapse damage should remain dangerous and easy to resolve.

### 8. Reload Is Mechanically Sound But Needs Clear Physical Wording

Current rule:

- Your next weapon attack this turn stays in your hand instead of being discarded.

Physical-play issue:

- The player must remember Reload is active until they play a weapon.

Recommendation:

- Freeze the rule, but define physical handling:

> Place Reload in front of you. The next weapon you play this turn returns to your hand after it resolves. Discard Reload after that attack or at end of turn.

Card-front text can remain concise:

> Your next weapon attack this turn stays in your hand after it resolves.

### 9. Mark Target Is Ready To Freeze

Current rule:

- Any attack against the marked player deals +1 damage until end of round.

Recommendation:

- Keep it as any player's attack, including enemies and teammates if targeting is otherwise valid.
- In team mode, attacks against teammates are normally not valid, so this mainly benefits opponents.

Suggested text:

> Choose one player. Any attack against them deals +1 damage until the end of the round.

### 10. Smoke Bomb Is Ready To Freeze

Current rule:

- Cancel damage.
- Until your next turn, attacks and targeted abilities cannot choose you.
- Splash and event damage still affect you.

Recommendation:

- Freeze.

Suggested text:

> Cancel damage to yourself from one attack. Until your next turn, attacks and targeted abilities cannot choose you. Splash and event damage still affect you.

## Physical-Play Friction

These rules need physical handling notes in the rulebook, not necessarily on cards:

- Reload marker until next weapon or end of turn.
- Mark Target marker until end of round.
- Intimidate marker until the source player's next turn.
- Smoke Bomb marker until the protected player's next turn.
- Max hand overflow may exist during play but must be resolved before ending turn.
- Events drawn from the deck resolve immediately and go to event discard.
- Black Market, Search, Supply Drop, and Painkillers should skip event cards as needed until the expected number of normal cards is reached, unless the event itself was the original draw.

## Card Text Cleanup Applied

Applied before art:

- Rename **High Ground** to **Scavenge**, or change its effect back to attack advantage. Recommendation: rename to Scavenge.
- Change **Minigun** to a damage-pool allocation rule.
- Change Black Market metadata to personal/self-targeted.
- Ensure all event metadata matches immediate one-time effects.
- Remove old damage/first-attack metadata from High Ground if its draw effect remains.
- Keep secondary-defense wording out of card fronts because it is configurable.

## Proposed Final Minigun Language

Short text:

> Allocate 6 damage among opponents.

Rules text:

> Allocate 6 damage among any opponents, max 3 per opponent. Each chosen opponent may defend once against their assigned damage.

Rulebook note:

> Attack bonuses add to Minigun's total damage pool, not to each target.

## Freeze Decisions Applied

Decisions applied in this pass:

1. Change Minigun to 6 total allocatable damage, max 3 per opponent.
2. Apply attack bonuses to Minigun's total damage pool.
3. Rename High Ground to Scavenge and keep the draw-1-to-everyone effect.
4. Make Black Market card metadata target the drawer only.
5. Keep Revive attack-only.
6. Keep secondary defense configurable and describe it only in the game rules.
7. Update `docs/current-rules.md` and `src/data/cards.ts` together.

## Not Recommended Before Art

- Adding new card types.
- Adding more configurable variants that alter card text.
- Changing default health/actions/hand size without a simulation pass.
- Printing digital-only terms such as "log," "debug," "bot," or "pass-device" on cards.

## Next Step

Run a broader simulation pass and manual play review. If no rules changes come out of that review, treat `src/data/cards.ts` as the card-art source.
