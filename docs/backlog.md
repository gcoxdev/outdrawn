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
- Generate AI-rendered PNG card faces, not SVG or rasterized SVG, following the root reference examples and preserving 2.5" x 3.5" width/height.
- Consider a round-start draw-up rule where all living players draw up to max hand size, while still only playing 2 or configured actions; likely requires higher HP and fresh simulations.

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
- Decoy Hand: reveal two random cards; attacker chooses one to discard instead of dealing damage.
- Last Stand Armor: only playable at low health; block more damage than Armor Vest.

Ability candidates:

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

Healing/support candidates:

- Safe House: skip your attack action to heal and become untargetable until your next turn.
- Emergency Rations: heal a small amount, then discard 1 card.
- Blood Pact: heal 1, then your next successful attack heals you for 1 more.
- Triage Kit: heal more if you have taken damage since your last turn.
- Reinforced Bandage: heal a small amount and reduce the next damage you take this round by 1.

Team-mode candidates:

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

- Fog of War: attacks must target a random opponent this round.
- Collapsing Zone: lowest-health player takes damage at round end.
- Interference: ability cards cannot be played this round.
- Revenge Round: eliminated players' cards are discarded instead of looted this round.
- Exposed Hands: each player reveals one random card from hand until round end.
- Forced March: players with more than max hand size take damage before discarding.
- Bad Intel: the first ability played this round targets a random valid player instead.

## Rules To Clarify

- Decide whether current events should be represented as full cards in the play area or remain compact event summaries near the log.
- Revisit area-damage cards like Minigun for large player counts, since their value scales with the number of opponents.
- Simulate and compare pure round-robin turn order against the standard round model with a moving starting player.
- Decide whether to test 25 health, 7 starting cards, 10 max cards, and 3 actions as the next manual-play default candidate.
- Create physical-play rules/reference cards that remove web-only terms like logs, debug snapshots, bot levels, and pass-device mode.
- Add leaderboard and player stat tracking, especially for online play history, rankings, and lobby records.
