# Outdrawn Backlog

## Expansion

- Support arbitrary player counts beyond the current 3-6 player setup.
- Design large-table battle royale pacing, deck scaling, event scaling, and UI behavior for high player counts such as 20, 50, or 100 players.
- Extend team modes beyond the current 2v2, 2v2v2, and 3v3 foundation into larger team formats.
- Add roster grouping for larger team games with expand/collapse team sections.
- Simulate larger player counts and team modes before changing card counts or balance assumptions.
- Add deck configuration support so a game can use predefined decks or a custom deck with selected card types/cards enabled.
- Add custom card definition support so hosts can create card templates with type, count, timing, target rules, damage, defense/block, healing, draw, discard, steal, splash/area effects, action cost, hand-limit behavior, reaction eligibility, and conditions such as low health, attacker/defender role, seating adjacency, team membership, or prior eliminations.
- Analyze and simulate deck-composition variants, including weapon-heavy, defense-light, ability-heavy, no-events, high-events, large-table, and beginner-friendly decks.
- Build an online multiplayer version with lobby creation, configurable game parameters, and private games joinable by key/code.
- Research Steam publishing requirements, including executable packaging options such as NW.js or Electron, Steamworks API integration, online play/auth/lobby support, server hosting needs, build/signing/release workflow, save/cloud support, achievements, controller/Steam Deck considerations, and store compliance.
- Generate AI-rendered PNG card faces, not SVG or rasterized SVG, following the root reference examples and preserving 2.5" x 3.5" width/height.
- Consider a configurable refill setting with options for current rules, start-turn draw-up, round-start fixed draw, low-hand refill, or full draw-up to max; see [draw-up rule analysis](draw-up-rule-analysis-2026-05-09.md).

## Rules To Clarify

- Decide the final true-tie rule for simultaneous non-attack eliminations: allow no winner or add a deterministic final tiebreaker such as seating order from the current turn marker.
- Revisit any future area-damage cards for large player counts so their value does not scale without a cap or damage pool.
- Simulate and compare pure round-robin turn order against the standard round model with a moving starting player.
- Decide whether to test 25 health, 7 starting cards, 10 max cards, and 3 actions as the next manual-play default candidate.
- Create physical-play rules/reference cards that remove web-only terms like logs, debug snapshots, bot levels, and pass-device mode.
- Add leaderboard and player stat tracking, especially for online play history, rankings, and lobby records.

## Deck Presets

- Default Battle Royale: current balanced prototype deck.
- Aggressive: more weapons, fewer healing/defense cards, faster eliminations.
- Tactical: more ability/reaction cards, fewer burst weapons, more counterplay.
- Low Complexity: simple weapons, basic defense, basic healing, minimal rules text for new players.
- Large Table: more area damage, more deck cycling, fewer single-target stall cards.
- Teams: more ally support, shared defense, revive, and coordinated attack cards.
- Futuristic: laser, rail, drone, shield, and cybernetic cards with precision targeting, piercing damage, and tech disruption.
- Wild West: six shooters, TNT, lassos, saloon medicine, quick-draw counters, and posse/team support.
- Eastern Weapons: katanas, ninja stars, smoke arts, parries, and stealth movement.
- Middle Ages: maces, morning stars, longbows, tower shields, potions, and battlefield formations.
- Intergalactic: plasma rifles, ion storms, orbital drops, alien tech, gravity traps, and ship-board hazards.
- Roman Arena: gladius, pilum, net-and-trident, formation shields, crowd favor, and arena hazards.
- Custom: host chooses which cards are included and optionally adjusts card counts.

## Future Card Ideas

Weapon candidates:

- Laser Pistol: deal moderate damage; ignores the first 1 point of block.
- Rail Gun: high damage that penetrates Armor Vest, but costs 2 actions.
- Plasma Blade: deal damage and prevent the target from using healing on their next turn.
- Ion Cannon: deal low damage to all opponents with no friendly fire in team games.
- Pulse Grenade: deal low splash damage and force damaged players to discard an ability if they have one.
- Six Shooter: deal small damage; may immediately attack a different target if it eliminates a player.
- TNT: high splash damage to a target and adjacent players in seating order.
- Lasso: deal low damage and force the target to discard one random card.
- Katana: deal medium damage; gains bonus damage against marked targets.
- Ninja Stars: split damage across up to three opponents.
- Mace: deal medium damage and reduce the target's next block by 1.
- Morning Star: high damage, but the attacker discards 1 card after use.
- Gladius: low damage, but draw 1 if used against the highest-health opponent.
- Pilum: medium damage that cannot be redirected.
- Flamethrower: deal low damage to two adjacent players in seating order.
- Rocket Launcher: high damage to one player and splash to both neighbors, but costs 2 actions.
- Poison Dart: deal small damage now and more damage at the start of that player's next turn.
- Boomerang Blade: deal small damage, then return to hand if it does not eliminate the target.
- Trap Mine: place a face-down trap that triggers when the chosen player attacks.
- Dual Pistols: split damage between two different players.
- Suppressed Pistol: deal low damage that cannot be redirected.
- Heavy Axe: deal high damage but force the attacker to discard another card.

Defense candidates:

- Energy Shield: block damage and keep 1 revealed tech card from discard if available.
- Deflector Field: reduce damage and redirect 1 prevented damage to an opponent.
- Phase Step: avoid an attack, then discard 1 card.
- Quick Draw: reduce damage; if you have a weapon, deal 1 damage back to the attacker.
- Steel Breastplate: block a fixed amount, unless the weapon penetrates armor.
- Shield Wall: in team games, reduce damage to you or a teammate.
- Smoke Art: avoid the attack and become untargetable until your next turn.
- Cover Fire: reduce incoming damage and force the attacker to discard 1 card.
- Jammed Weapon: cancel an attack unless the attacker discards another weapon.
- Emergency Shield: block all damage, then skip your next draw.
- Mirror Shield: reduce damage by half and return the prevented amount to the attacker.
- Escape Route: cancel an attack and move turn order focus to the next player.
- Decoy Hand: reveal two random cards; attacker chooses one to discard instead of dealing damage.
- Last Stand Armor: only playable at low health; block more damage than Armor Vest.

Ability candidates:

- EMP Burst: each opponent discards one ability or defense card, if able.
- Drone Scan: reveal one opponent's hand and the top card of the deck.
- Overclock: gain 1 action this turn, then take 1 damage.
- Hack: steal one revealed Black Market card before choices are made.
- High Noon: choose an opponent; both reveal a weapon if able, lower damage weapon is discarded.
- Duel: choose an opponent; until your next turn, you and that opponent can only attack each other.
- Shadow Step: move one seat left or right for seating-order effects.
- Rally Banner: all teammates may give one card to another teammate.
- Crowd Favor: draw 2, keep 1, discard the rest.
- Tactical Formation: until your next turn, the first teammate hit takes 1 less damage.
- Scout: look at one player's hand.
- Recon Drone: look at the top cards of the deck and reorder them.
- Trade Route: swap one card with another willing player.
- Forced Trade: swap one random card with a target player.
- Blackout: hide all hands and disable hand-peek effects until your next turn.
- Sabotage Supply: target player discards a random card, then draws 1.
- Focus: your next attack this turn gets +2 damage.
- Suppression: target player has 1 fewer action next turn.
- Feint: choose a target; if they spend a defense card against your next attack this turn, draw 1.
- Jam Comms: target player cannot receive ally support reactions until their next turn.
- Signal Boost: your next ability card this turn costs 0 actions.
- High Ground: future concept to preserve. Possible direction: gain a temporary attack or defense advantage tied to positioning, but keep the mechanic physical-play friendly and avoid lingering round-state complexity unless represented by a clear marker.

Healing/support candidates:

- Nano Meds: heal a teammate or yourself and draw 1 if still below half health.
- Repair Patch: heal less than Bandage, but also blocks the next 1 damage this round.
- Stim Injector: heal 2 and gain 1 action, then discard 1 card.
- Saloon Whiskey: heal 3, then reveal a random card from your hand.
- Herbal Remedy: heal 2; if used on a teammate, both players may discard 1 to draw 1.
- Field Surgeon: heal a large amount, but costs 2 actions.
- Martian Rations: heal 1 and recover one low-value card from discard.
- Safe House: skip your attack action to heal and become untargetable until your next turn.
- Emergency Rations: heal a small amount, then discard 1 card.
- Blood Pact: heal 1, then your next successful attack heals you for 1 more.
- Triage Kit: heal more if you have taken damage since your last turn.
- Reinforced Bandage: heal a small amount and reduce the next damage you take this round by 1.

Team-mode candidates:

- Current team foundation: 2v2, 2v2v2, and 3v3 setup, teammate hand visibility, team win condition, no friendly fire on area damage, optional teammate healing, and optional card transfer are implemented.
- Cover Ally: when a teammate is attacked, reduce that damage by 3.
- Intercept: take an attack meant for a teammate, then reduce that damage by 2.
- Coordinated Strike: you and a teammate each discard 1 card; deal bonus damage to one shared target.
- Flank: if a teammate damaged the target this round, deal extra damage to that target.
- Rally Point: all teammates may draw 1, then each must discard down to max hand size.
- Field Medic: heal a teammate; if they are at low health, heal extra.
- Shared Supplies: give a card from your hand to a teammate; both players may draw 1 if you give a defense card.
- Suppressing Fire: reduce the next attack against any teammate by 2 and mark the attacker.
- Revive Beacon: if a teammate would be eliminated, they stay at 1 HP, discard their hand, and skip their next turn.
- Squad Loadout: each teammate may pass one card to another teammate, then discard 1 if over max hand size.
- Callout: reveal one opponent's hand to your team until the end of the round.
- Crossfire: deal damage to an opponent; a teammate seated opposite or adjacent to them may deal 1 extra damage.
- Guard Rotation: until your next turn, the first attack against each teammate is reduced by 1.
- Last Squad Standing: if your team has fewer living players than another team, each teammate draws 1.
- Friendly Fire: event or hazard card where splash damage can hit teammates this round unless prevented.
- Broken Formation: target team cannot use ally reactions until the end of the round.
- Supply Line: each teammate may recover one low-value card from discard, then the team skips its next draw bonus.
- Extraction Zone: team event where a chosen teammate becomes untargetable but cannot attack until their next turn.
- Vengeance Pact: when a teammate is eliminated, one surviving teammate immediately draws 2 and may attack the eliminator.

Event candidates:

- Event candidates should resolve immediately when drawn, affect the whole table, a clearly defined table-wide group, or a personal opportunity like Supply Drop/Black Market, and avoid future round, end-of-round, or persistent "this round" effects. Future events should be one-time immediate-use cards with no lingering active event state.
- Event candidates should also be physical-play friendly: no hidden digital state, logs, bots, complex randomization, or memory burden that would be hard to track with real cards.
- Fog of War: every living player with at least 2 cards reveals one card of their choice, then passes it face down to the player on their left.
- Collapsing Zone: the lowest-health living player immediately takes 2 damage; tied players each take 1 damage.
- Interference: each living player immediately discards one ability card if they have one.
- Revenge Cache: each living player who has eliminated someone may draw 1 card, then discard down to max hand size.
- Exposed Hands: each living player immediately reveals one random card from hand.
- Forced March: each living player over max hand size immediately takes 1 damage, then discards down to max hand size.
- Bad Intel: each living player passes one non-defense card face down to the player on their right, if able.
