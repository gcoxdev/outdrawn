# Last Hand Standing - Current Web Prototype Rules

## Goal

Be the last player alive.

The current web prototype is a local browser game for 3-6 players. Each player can be human or computer-controlled. Computer players can use Beginner, Novice, Competent, Expert, or Master strategy.

## Setup

- Starting health: 20 by default.
- Maximum health: 20 by default.
- Starting hand: 5 cards by default.
- Maximum hand size: 7 cards by default.
- Actions per turn: 2 by default.
- The main deck and event deck are shuffled separately.
- The first player is randomly selected by the app.

## Card Visibility

- Human players can see only the active human decision hand.
- Computer hands are hidden from humans unless only computer players remain.
- Played cards are revealed by the log and then discarded unless a card says otherwise.
- Discard piles and event cards are public.
- Debug hand snapshots are available only in development mode and only when the debug setting is enabled.

## Turn Structure

On a player's turn, they may spend actions to:

- Draw 1 card.
- Play a weapon as an attack.
- Play an ability.
- Play a healing card.
- Use Black Market if the Black Market event is active.
- Pass.

A player may not end their turn while above the maximum hand size.

## Round Structure

Each living player acts once per round. After all living players have acted:

1. Collapse damage is applied.
2. End-of-round event effects resolve.
3. Temporary round effects clear.
4. The first player marker advances clockwise to the next living player.
5. A new event is revealed starting on Round 2.

## Collapse

- Starting at the end of Round 3, all living players take 1 collapse damage.
- Starting at the end of Round 6, collapse damage becomes 2.
- Pressure Zone can add 1 extra damage to players who did not attack that round.
- Collapse is not an attack and cannot be blocked by normal defense cards.

## Combat

1. Attacker plays a weapon from hand and chooses a valid target.
2. The defender may play 1 reaction defense card if eligible.
3. Damage resolves.
4. The weapon and reaction card are discarded unless the specific card effect says otherwise.
5. Eliminations and loot resolve.

Opening protection:

- During Rounds 1-2, a single attack's base damage is capped at 6 by default.
- Damage cap rounds controls how many opening rounds use this cap.
- Opening damage cap controls the maximum base damage during those rounds.

## Weapons

- Pistol: deal 3 damage.
- Shotgun: deal 6 damage, then discard.
- Sniper Rifle: deal 8 damage.
- Knife: deal 2 damage.
- Grenade: deal 4 damage to the target and 2 splash damage to nearby non-attacking players in turn order.
- Crossbow: deal 4 damage and ignores Armor Vest.
- SMG: deals 2 damage twice to the same target. Each hit has a separate reaction window.
- Minigun: deal 2 damage to every other living player. It does not choose a target and has no reaction window.

## Defense

Defense cards are played from hand as reactions. There is no equipment system in the current prototype.

- Armor Vest: reduce incoming attack damage by 2 unless the attack ignores armor.
- Shield Plate: block 4 damage.
- Dodge: cancel damage to yourself from one attack.
- Counterattack: after taking damage, deal 3 damage back to the attacker.
- Smoke Bomb: cancel damage and become untargetable until your next turn, except by splash or event damage.
- Ricochet: redirect the attack to another valid player.
- Backfire: cancel incoming attack damage and deal that much damage to the attacker.
- Brace: reduce damage by half, rounded down.
- Revive: when an attack would eliminate you, survive at 1 health and discard your hand.

## Abilities

- Ambush: your next attack this turn deals +3 damage.
- Disarm: target discards exactly 1 weapon from hand: their highest-damage weapon.
- Steal: take 1 card from another player's hand.
- Search: draw 3, keep 1, discard the rest.
- Reload: your next weapon attack this turn stays in your hand instead of being discarded after it resolves.
- Sabotage: target discards 2 cards of their choice.
- Mark Target: attacks against the target deal +1 damage this round.
- Intimidate: target must discard 1 card to attack you before your next turn.
- Adrenaline: gain 1 net action this turn and lose 2 health.

## Healing

- Bandage: heal 3.
- Medkit: heal 6 and costs 2 actions.
- Painkillers: heal 2 and draw 1 card.
- Field Dressing: heal 4.

Healing cannot exceed maximum health.

## Events

- Pressure Zone: this round, players who did not attack take +1 collapse damage.
- Supply Drop: reveal 3 main-deck cards. Players choose in lowest-health order; each may claim 1 card or pass.
- Bounty: damaging the highest-health player draws 1 card.
- High Ground: each player's first attack this round deals +1 damage.
- Low Ammo: each player discards their highest-damage weapon from hand or takes 3 damage.
- No Cover: block/reduction reactions prevent 1 less damage this round. Dodge, Smoke Bomb, Ricochet, Backfire, and Revive are unaffected.
- Critical Condition: players at 10 or less health take 1 damage; players below 5 health take 2 instead.
- Black Market: this round, players may spend 1 action and discard 2 cards to reveal 3 cards, keep 1, and discard the rest.

## Elimination And Loot

If a player is eliminated by another player's attack:

1. The attacker gains the eliminated player's remaining hand.
2. The eliminated player's hand is emptied.
3. Loot can temporarily put the attacker over the max hand size.
4. The attacker must discard down before ending their turn.

If a player is eliminated by event or collapse damage:

- Their cards are discarded.
- No player gains loot.

## Hand Limit

Players must discard down to the maximum hand size before ending their turn. Off-turn card gains such as Supply Drop, Search, and Black Market can create an immediate discard-down prompt.

## Tie Scenarios

A tie means the game reaches `gameOver` without one living winner. In the current implementation, this can happen only after non-attack damage eliminates all remaining players and the tiebreaker cannot distinguish them.

Known tie scenarios:

1. Collapse tie:
   - Two or more remaining players have the same pre-collapse health.
   - Collapse damage eliminates all of them at the same time.
   - They also have the same hand size.

2. Pressure Zone plus collapse tie:
   - Pressure Zone adds damage to multiple players who did not attack.
   - The combined collapse/Pressure Zone damage eliminates all remaining players.
   - Pre-effect health and hand size are still tied.

3. Critical Condition tie:
   - Critical Condition is revealed when all remaining players are low enough to be damaged.
   - Its immediate damage eliminates all remaining players.
   - Pre-effect health and hand size are tied.

4. Low Ammo tie:
   - All remaining players lack weapon cards.
   - Low Ammo deals 3 damage to each of them.
   - The damage eliminates all remaining players.
   - Pre-effect health and hand size are tied.

5. Splash or counterattack double elimination:
   - Combat can eliminate multiple players through Grenade splash or Counterattack.
   - Usually the attacker or another living player still wins.
   - A true no-winner tie is unlikely here because combat checks for a living winner after resolution, but simultaneous combat eliminations can still create unusual end states that should be watched in manual playtesting.

Current tiebreaker:

1. Highest pre-effect health wins.
2. If tied, largest hand wins.
3. If still tied, no winner is declared.

Recommended future tiebreaker:

Track player-caused damage or eliminations and use that before declaring no winner.
