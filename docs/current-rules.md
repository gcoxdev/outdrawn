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
- Turn order: Standard by default. Standard rotates the first player marker each round. Round robin keeps the same seating order each round.
- Health reward on elimination: 0 by default. If enabled, a player who earns an elimination heals by that amount per elimination, up to maximum health.
- Defense on secondary attacks: off by default. If enabled, players can play eligible defense cards against player-caused secondary damage such as Ricochet, Grenade splash, Minigun hits, Counterattack, and Backfire. Ricochet cannot be used again against secondary damage. Event and collapse damage cannot be defended.
- Event cards are shuffled into the main deck after starting hands are dealt. Events drawn or revealed from the main deck resolve instead of going into hand. Drawing an event does not cost an action.
- The first player is randomly selected by the app.
- Team modes validate the selected roster before a game can start: duos, trios, and squads use teams of two, three, and four; two teams splits the roster into equal teams; custom teams require at least two populated teams. Teammates can see each other's hands, area damage has no friendly fire, and teammate healing/card transfer can be enabled or disabled before the game starts.

## Card Visibility

- Human hands are shown for the active decision. Between pending choices, team players can also switch the hand view to a living teammate.
- Computer opponents' hands are hidden. Human players may view their computer teammates' hands; when no humans remain, computer hands become visible.
- Played cards are revealed by the log and then discarded unless a card says otherwise.
- Discard piles and event cards are public. Use View piles in the sidebar to inspect the current main and event discards.
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
3. In Standard order, the first player marker advances clockwise to the next living player. Round robin retains its first player marker, moving it only if that player was eliminated.

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

- Pistol: deal 3 damage.
- Shotgun: deal 6 damage, then discard.
- Sniper Rifle: deal 8 damage.
- Knife: deal 2 damage.
- Grenade: deal 4 damage to the target and 2 splash damage to the living players before and after the target in seating order. Find the nearest living player in each direction, skipping the attacker and the target; hit each distinct player at most once. The attacker and their teammates take no splash damage.
- Assault Rifle: deal 5 damage.
- Crossbow: deal 4 damage and penetrates Armor Vest.
- SMG: deals 2 damage twice to the same target. Each hit has a separate reaction window. Ambush and Mark Target bonuses apply to the first hit only. The second hit stops if the shooter or original target is eliminated, or if the original target becomes protected by Smoke Bomb. Ricochet redirects only its current hit.
- Minigun: allocate up to 6 damage among living opponents, max 3 allocated per opponent. Attack bonuses add to the total pool; Mark Target adds damage to each marked target after allocation. Targets may defend once against their allocation only when defense on secondary attacks is enabled; otherwise the damage resolves without reactions.

## Defense

Defense cards are played from hand as reactions. There is no equipment system in the current prototype.

- Armor Vest: reduce incoming attack damage by 2 unless the weapon penetrates armor.
- Shield Plate: block 4 damage.
- Dodge: cancel damage to yourself from one attack. Grenade splash against other players still resolves.
- Counterattack: after taking damage, deal 3 damage back to the attacker.
- Smoke Bomb: cancel damage and become protected until your next turn. Ordinary attack targeting and targeted abilities cannot choose you. Splash and event damage still affect you. The current prototype also permits Ricochet to redirect an attack onto a smoke-protected player.
- Ricochet: redirect the current hit to another living player other than yourself, the attacker, or one of your teammates. The new target gets a defense window only if secondary defense is enabled. Ricochet cannot be chained against secondary damage.
- Backfire: cancel incoming attack damage and deal that much damage to the attacker.
- Brace: take half the incoming damage, rounded down (for example, 3 becomes 1).
- Revive: when an attack would eliminate you, survive at 1 health plus the healing values of all healing cards in your hand, capped at maximum health. Discard your entire hand, including Revive and those healing cards. This costs no actions and does not trigger extra draws from Painkillers.

## Abilities

- Ambush: your next attack this turn deals +3 damage.
- Disarm: target discards their highest-damage weapon from hand.
- Steal: choose 1 face-down card from an opponent's hand and take it without seeing its identity first.
- Search: draw 3, keep 1, discard the rest.
- Reload: your next weapon attack this turn stays in your hand instead of being discarded after it resolves.
- Sabotage: target discards up to 2 cards of their choice. If they have fewer than 2 cards, they discard what they have.
- Mark Target: add +1 damage against the target this round. Repeated marks stack. This applies to the first SMG hit and to an assigned Minigun hit, but not Grenade splash.
- Intimidate: the target must discard 1 other card before a single-target weapon attack against you until your next turn. The cost is paid once for an SMG attack. Minigun currently bypasses this cost.
- Adrenaline: gain 1 net action this turn and lose 2 health. This loss can eliminate you; at 1 or 2 health you are eliminated immediately.

## Healing

- Bandage: heal 3.
- Medkit: heal 6 and costs 2 actions.
- Painkillers: heal 2 and draw 1 card.
- Field Dressing: heal 4.

Healing cannot exceed maximum health. If team healing is enabled (on by default), you may heal a living teammate; you pay the card's action cost. Painkillers gives its extra draw to the player using it, even when healing a teammate.

## Events

- Pressure Zone: all living players take 1 damage.
- Supply Drop: draw 3 cards. You may exceed max hand size during play, but must discard down before ending your turn.
- Bounty: the highest-health living player takes 2 damage. If tied, each tied highest-health player takes 2 damage.
- Scavenge: each living player draws 1 card. Players may exceed max hand size during play, but must discard down before ending their turns.
- Low Ammo: each living player chooses one weapon from hand to discard or takes 3 damage if they have no weapon.
- No Cover: each living player chooses one defense card from hand to discard or takes 2 damage if they have no defense.
- Critical Condition: players at 10 or less health take 1 damage; players below 5 health take 2 instead.
- Black Market: the drawing player may make the configured market exchange once. Event cards revealed for market inventory are discarded and replaced. Unkept revealed cards are discarded.
- Black Market Standard: risk discard 2 cards; reward reveal 3 and keep 1.
- Black Market Discount Market: risk discard 1 card; reward reveal 3 and keep 1.
- Black Market Bigger Market: risk discard 2 cards; reward reveal 5 and keep 2.
- Black Market Health-Pay Market: risk 2 health; reward reveal 3 and keep 1.
- Black Market Custom: host-defined discard cost, health cost, reveal count, and keep count.

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
