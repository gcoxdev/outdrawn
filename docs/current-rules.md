# Outdrawn - Current Web Prototype Rules

These rules describe the implemented browser game. Lobby settings override the defaults listed below.

## Goal

Be the last player alive, or the last team with any living players in team mode.

The current web prototype is a local browser game for 3-100 players. Each player can be human or computer-controlled. Computer players can use Beginner, Novice, Competent, Expert, or Master strategy. Supported table modes are free-for-all, duos, trios, squads, two teams, and custom teams.

## Setup

- Starting health: 20 by default.
- Maximum health: 20 by default.
- Starting hand: 5 cards by default.
- Maximum hand size: 7 cards by default.
- Actions per turn: 2 by default.
- Free draws per turn: 0 by default. Free draws are used before action-spending draws.
- Turn order: Round robin by default, keeping the same seating order each round. The optional Rotating start mode moves the first player marker to the next living player each round.
- Health reward on elimination: 0 by default. If enabled, a player who earns an elimination heals by that amount per elimination, up to maximum health.
- Defense on secondary attacks: off by default. If enabled, players can play eligible defense cards against player-caused secondary damage such as Ricochet, Grenade splash, Minigun hits, Counterattack, and Backfire. Ricochet cannot be used again against secondary damage. Event and collapse damage cannot be defended.
- After starting hands are dealt, 65 regular cards and 16 event cards are shuffled into the opening draw pile at every table size. The regular-card supply is sampled from repeated copies of the standard deck as needed. Events drawn or revealed from the main deck resolve instead of going into hand. Drawing an event does not cost an action.
- The first player is randomly selected by the app.
- Team modes validate the selected roster before a game can start: duos, trios, and squads use teams of two, three, and four; two teams splits the roster into equal teams; custom teams require at least two populated teams. Teammates can see each other's hands, area damage has no friendly fire, and teammate healing/card transfer can be enabled or disabled before the game starts.

## Card Visibility

- Human hands are shown for the active decision. Between pending choices, team players can also switch the hand view to a living teammate.
- Computer opponents' hands are hidden. Human players may view their computer teammates' hands; when no humans remain, computer hands become visible.
- Played cards are revealed by the log and then discarded unless a card says otherwise.
- Discard piles and event cards are public. Use Discards in the table header to inspect the current main and event discards.
- With multiple living humans, optional pass-device mode hides hands until the receiving player chooses Reveal Hand. Reloading resets this privacy gate.
- Debug hand snapshots are development-only and opt-in. They capture future log entries, retain at most the latest 50 entries, and are cleared when disabled.

## Turn Structure

On a player's turn, they may spend actions to:

- Draw 1 card.
- Play a weapon as an attack.
- Play an ability.
- Play a healing card.
- Pass one action.
- Transfer one card to a living teammate for 1 action, if team card transfer is enabled.

If free draws are enabled, a player may draw up to the configured free-draw limit before drawing starts spending actions.

A player may end their turn early and forfeit unused actions and free draws. They cannot end while above the maximum hand size or while an attack, reaction, event choice, or draw effect is unresolved.

An ordinary Draw that reveals an event resolves that event and stops. It consumes neither an action nor a free draw, and does not automatically draw a replacement; the player can choose Draw again.

Card effects that promise a number of cards (Search, Supply Drop, Scavenge, and Painkillers) resolve encountered events and continue until they find the required number of non-event cards or no cards remain. Finish interactive event choices before the interrupted effect continues. Black Market is the exception: events revealed for its inventory are discarded without resolving and replaced.

When the main deck runs out, the main discard pile is shuffled to refill it. Discarded events are kept separate and do not return through this refill. Events have no ongoing round effect.

## Round Structure

Each living player acts once per round. After all living players have acted:

1. Collapse damage is applied.
2. Temporary round effects clear.
3. Round robin retains its first player marker, moving it only if that player was eliminated. In Rotating start mode, the first player marker advances clockwise to the next living player each round.

## Collapse

- Starting at the end of Round 3, all living players take 1 collapse damage.
- Starting at the end of Round 8, collapse damage becomes 2.
- Collapse is not an attack and cannot be blocked by normal defense cards.

## Combat

1. Attacker plays a weapon from hand and chooses a valid target.
2. For a single-target attack, the defender may play 1 eligible reaction card without spending an action, or take the hit. Minigun uses the secondary-defense setting instead.
3. Damage resolves.
4. The weapon and reaction card are discarded unless the specific card effect says otherwise.
5. Eliminations and loot resolve.

## Weapons

- Pistol: Deal 3 damage to one player.
- Shotgun: Deal 6 damage to one player.
- Sniper Rifle: Deal 8 damage to one player.
- Knife: Deal 2 damage to one player.
- Grenade: Deal 4 damage to one player and 2 splash damage to the next living player on each side in seating order. You are immune.
- Assault Rifle: Deal 5 damage to one player.
- Crossbow: Deal 4 damage to one player. Pierces Armor Vest.
- SMG: Deal 2 damage twice to one player. Resolve each hit separately.
- Minigun: Split up to 6 damage among opponents, max 3 each. Each may defend once only if secondary defense is agreed to.

### Weapon clarifications

- Played weapons are discarded under the general combat rules, including Shotgun.
- Grenade: find the nearest living player in each direction, skipping the attacker and the target; hit each distinct player at most once. The attacker and their teammates take no splash damage.
- SMG: each hit has a separate reaction window. Ambush and Mark Target bonuses apply to the first hit only. The second hit stops if the shooter or original target is eliminated, if the shooter loses the SMG (for example, by using Revive), or if the original target becomes protected by Smoke Bomb. Ricochet redirects only its current hit.
- Minigun: choose living opponents. Attack bonuses add to the total pool; Mark Target adds damage to each marked target after allocation. In the app, agreeing to secondary defense means enabling the “Defense on secondary attacks” setting; otherwise these hits resolve without reactions.

## Defense

Defense cards are played from hand as reactions. There is no equipment system in the current prototype.

- Armor Vest: Reduce this hit’s damage by 4, unless the weapon pierces armor.
- Shield Plate: Halve this hit’s damage to you, rounding down.
- Brace: Block 2 damage from this hit.
- Dodge: Cancel this hit’s damage to you. Grenade splash still hits other players.
- Counterattack: Take this hit’s damage, then deal 3 damage to the attacker.
- Smoke Bomb: Cancel this hit’s damage to you. Until your next turn, attacks and targeted abilities cannot choose you. Splash, events, and Ricochet still affect you.
- Ricochet: Redirect this hit to another living opponent, except the attacker. Smoke offers no protection. They may defend only if secondary defense is enabled. No further Ricochets.
- Backfire: Cancel this hit’s damage to you. Deal that much damage to the attacker.
- Revive: When another player’s attack would eliminate you, survive at 1 health. Use all healing cards in your hand, then discard the rest.

### Defense clarifications

- Shield Plate rounds the damage you take down: a 3-damage hit becomes 1 damage. No Cover reduces the amount prevented by 1, as it does for other blocking defenses.
- Ricochet cannot redirect to yourself, the attacker, or a teammate.
- Revive consumes all healing cards without spending actions or triggering extra draws from Painkillers. Healing is capped at maximum health, and your entire hand is discarded, including Revive and the healing cards.

## Abilities

- Ambush: Your next attack this turn deals +3 damage.
- Disarm: Choose one player. They discard their highest-damage weapon.
- Steal: Choose one player. Pick 1 card from their hand and take it. Choose a face-down card without seeing its identity first.
- Search: Draw 3 cards. Keep 1 and discard the rest.
- Reload: Keep your next weapon played this turn instead of discarding it after use.
- Sabotage: Choose one player. They discard 2 cards of their choice, or their whole hand if fewer.
- Mark Target: Choose one player. Attacks against them deal +1 damage until the round ends. Repeated marks stack. This applies to the first SMG hit and to an assigned Minigun hit, but not Grenade splash.
- Intimidate: Choose one player. Until your next turn, they must discard 1 other card before a single-target weapon attack against you. Pay once for SMG. Minigun is exempt.
- Adrenaline: Gain 1 net action this turn, then lose 2 health. This loss can eliminate you; at 1 or 2 health you are eliminated immediately.

## Healing

- Bandage: Heal 3 health, up to your maximum.
- Medkit: Spend 2 actions to heal 6 health, up to your maximum.
- Painkillers: Heal 2 health, up to your maximum. Draw 1 card.
- Field Dressing: Heal 4 health, up to your maximum.

Healing cannot exceed maximum health. If team healing is enabled (on by default), you may heal a living teammate; you pay the card's action cost. Painkillers gives its extra draw to the player using it, even when healing a teammate.

## Events

- Pressure Zone: All living players take 1 damage.
- Supply Drop: Draw 3 cards.
- Bounty: The highest-health living player or players, if tied, takes 2 damage.
- Scavenge: Each living player draws 1 card. Each may exceed their hand limit until their turn ends.
- Low Ammo: Each player discards 1 weapon of their choice. Anyone unable to do so takes 3 damage.
- No Cover: Each player discards 1 defense card of their choice. Anyone unable to do so takes 2 damage.
- Critical Condition: Players with 5–10 health take 1 damage. Players below 5 health take 2 damage.
- Black Market: You may exchange once using the table’s Black Market configuration. Discard unkept cards.
- Black Market Standard: risk discard 2 cards; reward reveal 3 and keep 1.
- Black Market Discount Market: risk discard 1 card; reward reveal 3 and keep 1.
- Black Market Bigger Market: risk discard 2 cards; reward reveal 5 and keep 2.
- Black Market Health-Pay Market: risk 2 health; reward reveal 3 and keep 1.
- Black Market Custom: host-defined discard cost, health cost, reveal count, and keep count.

Events affect living players only. Players above 10 health take no damage from Critical Condition. Card draws may put you over your hand limit, but you must discard down before ending your turn. Event cards revealed for Black Market inventory are discarded and replaced.

Black Market exchanges do not spend actions. A health payment must leave you with at least 1 health; you can always decline the exchange.

## Elimination And Loot

If a player is eliminated by another player's attack:

1. The attacker gains the eliminated player's remaining hand.
2. The eliminated player's hand is emptied. Splash and counterattack eliminations follow the same rule; if the credited player is also eliminated, the cards go to discard.
3. Loot can temporarily put the attacker over the max hand size.
4. The attacker must discard down before ending their turn.

If a player is eliminated by event or collapse damage:

- Their cards are discarded. The same applies to self-inflicted Adrenaline elimination.
- No player gains loot.

## Hand Limit

Players may exceed maximum hand size during play. They must discard down to the maximum hand size before ending their turn.

## Tie Scenarios

A tie means the match ends without a winner. This happens when final non-attack eliminations remain tied after the tiebreaker, or when the final combat sequence leaves nobody alive. Complete all pending counter and secondary damage before deciding the result.

Known tie scenarios:

1. Collapse tie:
   - Two or more remaining players have the same pre-collapse health.
   - Collapse damage eliminates all of them at the same time.
   - Elimination counts and pre-effect hand sizes are also tied.

2. Pressure Zone tie:
   - Pressure Zone deals immediate damage to all living players.
   - Its damage eliminates all remaining players.
   - Elimination counts, pre-effect health, and pre-effect hand size are all tied.

3. Critical Condition tie:
   - Critical Condition is revealed when all remaining players are low enough to be damaged.
   - Its immediate damage eliminates all remaining players.
   - Elimination counts, pre-effect health, and pre-effect hand size are all tied.

4. Low Ammo tie:
   - All remaining players lack weapon cards.
   - Low Ammo deals 3 damage to each of them.
   - The damage eliminates all remaining players.
   - Elimination counts, pre-effect health, and pre-effect hand size are all tied.

5. Splash or counterattack double elimination:
   - Combat can eliminate multiple players through Grenade splash or Counterattack.
   - If the full combat sequence leaves nobody alive, no winner is declared.
   - A living attacker or another surviving player can still win after all pending damage resolves.

Current tiebreaker for final non-attack eliminations, considering only players alive immediately before the final effect (a selected player wins for their team in team mode):

1. Most player eliminations wins.
2. If tied, highest pre-effect health wins.
3. If tied, largest hand wins.
4. If still tied, no winner is declared.

## Computer knowledge

Computers choose from their own cards and public information, including health, hand counts, elimination credit, and public choices. They cannot inspect opposing or teammate hand contents or draw-pile contents. Disarm may find no weapon; Steal chooses a random face-down card. Higher difficulty changes heuristics without granting hidden information. Computers do not model memory of cards revealed earlier.
