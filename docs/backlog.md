# Last Hand Standing Backlog

## Expansion

- Support arbitrary player counts beyond the current 3-6 player setup.
- Design large-table battle royale pacing, deck scaling, event scaling, and UI behavior for high player counts such as 20, 50, or 100 players.
- Add team modes such as 2v2, 3v3, and large-team formats.
- Define team visibility rules, including whether teammates can see each other's hands and when pass-device privacy should trigger.
- Add roster grouping for team games with expand/collapse team sections.
- Simulate larger player counts and team modes before changing card counts or balance assumptions.
- Add deck configuration support so a game can use predefined decks or a custom deck with selected card types/cards enabled.
- Analyze and simulate deck-composition variants, including weapon-heavy, defense-light, ability-heavy, no-events, high-events, large-table, and beginner-friendly decks.
- Build an online multiplayer version with lobby creation, configurable game parameters, and private games joinable by key/code.

## Deck Presets

- Default Battle Royale: current balanced prototype deck.
- Aggressive: more weapons, fewer healing/defense cards, faster eliminations.
- Tactical: more ability/reaction cards, fewer burst weapons, more counterplay.
- Low Complexity: simple weapons, basic defense, basic healing, minimal rules text for new players.
- Large Table: more area damage, more deck cycling, fewer single-target stall cards.
- Teams: more ally support, shared defense, revive, and coordinated attack cards.
- Custom: host chooses which cards are included and optionally adjusts card counts.

## Future Card Ideas

Weapon candidates:

- Flamethrower: deal low damage to two adjacent players in seating order.
- Rocket Launcher: high damage to one player and splash to both neighbors, but costs 2 actions.
- Poison Dart: deal small damage now and more damage at the start of that player's next turn.
- Boomerang Blade: deal small damage, then return to hand if it does not eliminate the target.
- Trap Mine: place a face-down trap that triggers when the chosen player attacks.
- Dual Pistols: split damage between two different players.
- Suppressed Pistol: deal low damage that cannot be redirected.
- Heavy Axe: deal high damage but force the attacker to discard another card.

Defense candidates:

- Cover Fire: reduce incoming damage and force the attacker to discard 1 card.
- Jammed Weapon: cancel an attack unless the attacker discards another weapon.
- Emergency Shield: block all damage, then skip your next draw.
- Mirror Shield: reduce damage by half and return the prevented amount to the attacker.
- Escape Route: cancel an attack and move turn order focus to the next player.
- Bodyguard: in team games, take damage for an ally and reduce it by 2.
- Decoy Hand: reveal two random cards; attacker chooses one to discard instead of dealing damage.
- Last Stand Armor: only playable at low health; block more damage than Armor Vest.

Ability candidates:

- Scout: look at one player's hand.
- Recon Drone: look at the top cards of the deck and reorder them.
- Bounty Contract: mark a player; whoever damages them draws a card.
- Trade Route: swap one card with another willing player.
- Forced Trade: swap one random card with a target player.
- Blackout: hide all hands and disable hand-peek effects until your next turn.
- Sabotage Supply: target player discards a random card, then draws 1.
- Rally: all teammates draw 1 in team games.
- Focus: your next attack this turn gets +2 damage.
- Suppression: target player has 1 fewer action next turn.
- Pickpocket: steal a random face-down card from target player's hand.
- Counterplay: recover a defense card from the discard pile.

Healing/support candidates:

- Field Dressing: heal a small amount and draw 1.
- Painkillers: heal now, then take delayed damage next round.
- Stim Pack: gain 1 action this turn and heal 1.
- Safe House: skip your attack action to heal and become untargetable until your next turn.
- Team Medic: heal yourself or an ally.
- Second Chance: if you would be eliminated this round, stay at 1 HP and discard your hand.

Event candidates:

- Fog of War: attacks must target a random opponent this round.
- Ammo Shortage: weapon cards cost 1 extra action this round.
- Open Season: all attack damage is increased by 1 this round.
- Medical Cache: each living player may heal or draw.
- Collapsing Zone: lowest-health player takes damage at round end.
- Air Drop: reveal several cards; players draft in turn order.
- Interference: ability cards cannot be played this round.
- Revenge Round: eliminated players' cards are discarded instead of looted this round.

## Rules To Clarify

- Decide whether current events should be represented as full cards in the play area or remain compact event summaries near the log.
- Revisit area-damage cards like Minigun for large player counts, since their value scales with the number of opponents.
- Analyze whether event cards should be mixed into the main deck and become active for everyone when drawn.
- Compare pure round-robin turn order against the current round model with a moving starting player.
- Decide whether Backfire, Ricochet, splash damage, and other indirect damage should allow ordinary defense reactions.
- Rebalance Black Market incentives; current cost may be too high for the expected reward.
- Decide whether to test 25 health, 7 starting cards, 10 max cards, and 3 actions as the next manual-play default candidate.
- Create physical-play rules/reference cards that remove web-only terms like logs, debug snapshots, bot levels, and pass-device mode.
