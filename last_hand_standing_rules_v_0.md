# Last Hand Standing — Rules v0.4 Prototype

A fast, tactical battle‑royale card game for 3–6 players where the goal is to be the last surviving player.

---

# Core Design Goal

This should feel like a battle royale without needing a board.

Players should constantly make meaningful choices about who to attack, when to defend, when to heal, when to hold cards, and when to risk health for stronger options.

The game should include randomness through card draw, but the winner should usually be the player who manages timing, threat assessment, hand size, and table politics best.

---

# Core Objective

Be the last player alive.

---

# Player Setup

Each player starts with:

- **Health:** 20
- **Starting Hand:** 5 cards
- **Max Hand Size:** 7 cards
Shuffle the main deck and event deck separately.

---

# Determining First Player

Before starting hands are dealt, reveal cards from the top of the main deck until each player has revealed one weapon.

The player who revealed the weapon with the highest damage goes first.

If tied, tied players reveal again until the tie is broken.

All revealed initiative cards are discarded.

Turn order proceeds clockwise.

This avoids giving players extra starting cards or revealing hidden hand information.

---

# Card Visibility Rules

- **Cards in hand:** Hidden from other players
- **Equipped cards:** Face-up and visible
- **Discard pile:** Face-up and visible
- **Event cards:** Face-up and visible
- **Played cards:** Revealed when used
- **Eliminated player’s cards:** Revealed to all players when eliminated

When a player is eliminated, everyone sees what they had. This creates table knowledge and makes the loot choice transparent.

---

# Main Deck Composition

The starter main deck currently has **77 cards**.

---

## Weapons — 29 cards

- **Pistol (x8):** Deal 3 damage.
- **Shotgun (x5):** Deal 6 damage. After use, it cannot be used on your next turn.
- **Sniper Rifle (x3):** Deal 8 damage. You must declare the target before any attack modifiers are played.
- **Knife (x3):** Deal 2 damage. If this eliminates a player, you may keep 1 extra loot card from them this turn.
- **Grenade (x4):** Deal 4 damage to one target and 2 splash damage to nearby non-attacking players in turn order.
- **Crossbow (x3):** Deal 4 damage. Ignores Armor Vest.
- **SMG (x3):** Deal 2 damage twice to the same target. Each hit resolves separately.

---

## Defense — 18 cards

Defense cards are played from hand as reactions. There is no weapon or defense equipment in the current web prototype.

Unless a card says otherwise, a player may only use **1 reaction defense card per attack**.

- **Armor Vest (x3):** Reaction defense. Reduce incoming attack damage by 2 unless the damage ignores armor, then discard.
- **Shield Plate (x4):** Reaction defense. Block 4 damage, then discard.
- **Dodge (x2):** Reaction defense. Cancel damage to you from one attack.
- **Counterattack (x2):** Reaction defense. After taking damage from an attack, deal 3 damage back to the attacker.
- **Smoke Bomb (x2):** Reaction defense. Cancel damage to you from one attack. Until your next turn, you cannot be targeted except by splash or event damage.
- **Decoy (x2):** Reaction defense. Redirect an attack targeting you to another valid player. Does not redirect event damage.
- **Brace (x2):** Reaction defense. Reduce damage from one attack by half, rounded down.
- **Fake Death (x1):** Lethal defense. When you would be eliminated by another player’s attack, survive at 1 health and discard your hand.

---

## Abilities — 21 cards

- **Ambush (x2):** Your next attack this turn deals +3 damage.
- **Disarm (x3):** Choose a player. They discard their highest-damage weapon from hand.
- **Steal (x3):** Take 1 random card from another player’s hand.
- **Search (x3):** Draw 3 cards, keep 1, discard the rest.
- **Reload (x2):** Take the highest-damage weapon from the discard pile and add it to your hand.
- **Sabotage (x2):** Choose a player. They discard 2 cards of their choice.
- **Mark Target (x2):** Choose a player. Attacks against that player deal +1 damage until the end of the round.
- **Intimidate (x2):** Choose a player. Until your next turn, that player cannot attack you unless they discard 1 card first.
- **Adrenaline (x2):** Gain 1 extra action this turn, then lose 2 health.

---

## Healing — 9 cards

You cannot play a healing card at full health unless it has a non-healing effect.

- **Bandage (x4):** Heal 3.
- **Medkit (x3):** Heal 6. Costs both actions.
- **Painkillers (x1):** Heal 2 and draw 1 card.
- **Second Wind (x1):** When you would be eliminated, survive at 1 health and discard your hand.

---

# Event Deck Composition

The starter event deck has **16 cards**.

Events represent the changing battlefield. Most events last only for the current round. Some events are immediate.

To avoid confusion, event cards should not imply the game is literally ending unless they create a lasting endgame state.

---

## Event Cards — 16 cards

- **Pressure Zone (x2):** This round, players who do not attack take +1 collapse damage.
- **Supply Drop (x2):** Reveal 3 main-deck cards. Starting with the lowest-health player and proceeding upward, each player may either pass or claim one revealed card by paying health equal to that card’s supply cost. Unclaimed cards are discarded.
- **Bounty (x2):** The highest-health player is marked this round. Whenever another player damages them, that attacker draws 1 card.
- **High Ground (x2):** The first attack each player makes this round deals +1 damage.
- **Low Ammo (x2):** Each player must discard one weapon from hand. Players who cannot discard a weapon take 3 damage.
- **No Cover (x2):** Reaction defense cards block or reduce 1 less damage this round. Dodge, Smoke Bomb, Decoy, Fake Death, and Second Wind are unaffected.
- **Critical Condition (x2):** Players at 10 or less health take 1 damage. Players below 5 health take 2 damage instead.
- **Black Market (x2):** This round, players may spend 1 action and discard 2 cards to search the deck for 1 card, reveal it, add it to hand, then shuffle the deck.

---

# Supply Drop Costs

Supply Drop does not use secret bidding in v0.3.

Instead, each card has a simple supply cost based on type:

- Basic weapon or healing card: 1 health
- Defense card or ability card: 2 health
- High-damage weapon, Second Wind, Fake Death, or Dodge: 3 health

The lowest-health player chooses first because this helps prevent the leader from always getting stronger. However, the health cost still makes the choice meaningful.

---

# Round Structure

Each round consists of:

## 1. Event Phase

In the current web prototype, the first event is revealed when Round 2 begins, and then one event is revealed at the start of each later round.

Resolve it according to its text.

There are three event timings:

- **Immediate:** Resolves once, then is discarded.
- **This Round:** Stays visible until the end of the round.
- **Ongoing:** Stays active until replaced or removed.

The starter deck currently uses immediate and this-round events only.

Currently implemented event cards:

- **High Ground:** Active this round. Each player's first attack this round deals +1 damage.
- **Low Ammo:** Immediate. Each player discards their highest-damage weapon from hand or takes 3 damage.
- **No Cover:** Active this round. Block/reduction reactions prevent 1 less damage.
- **Critical Condition:** Immediate. Players at 10 or less health take 1 damage; players below 5 health take 2.

Pending event cards:

- **Pressure Zone**
- **Supply Drop**
- **Bounty**
- **Black Market**

## 2. Draw Phase

Each player draws 2 cards.

## 3. Stance Phase

Each player secretly selects one stance and reveals it when triggered.

- **Aggressive:** Your first attack this round deals +1 damage.
- **Defensive:** Your first reaction defense this round blocks or reduces +1 damage.
- **Scavenger:** Draw 1 extra card this round, but your first attack this round deals -1 damage.
- **Hunter:** Secretly choose a target. If you damage that player this round, draw 1 card.

## 4. Action Phase

Players take turns clockwise.

Each player gets **2 actions** per turn.

Available actions:

- Attack
- Play ability
- Heal
- Draw 1 card
- Discard 2 cards to draw 1 card
- Pass

Medkit costs both actions.

---

# Combat Resolution

1. Attacker declares target and attack.
2. Attacker declares attack modifiers.
3. Defender may play 1 reaction defense card.
4. Damage resolves.
5. Triggered effects resolve.
6. Check for elimination.

---

# Splash Damage Rules

Grenade and future splash cards affect the primary target plus nearby players in turn order.

For Grenade:

- Primary target takes 4 damage.
- The next living player clockwise from the target takes 2 splash damage.
- The next living player counterclockwise from the target takes 2 splash damage.

If there are only 2 players left, Grenade only damages the primary target.

If there are 3 players left, Grenade damages the primary target and the one other non-attacking player for 2 splash damage. The attacker is not hit by their own Grenade unless a card specifically says otherwise.

Defense against splash:

- A defense card only protects the player who played it.
- If the primary target plays Dodge, they avoid their own damage, but splash damage still happens to other affected players.
- Splash damage cannot currently be blocked by reaction defense in the web prototype.

---

# Elimination and Loot

When a player is eliminated by another player:

1. Reveal all eliminated player’s hand to everyone.
2. The eliminator adds any number of those cards to their hand.
3. The eliminator must immediately discard down to 7 cards.
4. All unclaimed cards are discarded.

The hand limit is the primary loot cap. This keeps looting exciting without adding an artificial limit.

If a player is eliminated by an event or collapse damage, their cards are revealed and then discarded. No player gains loot.

---

# Collapse System

Collapse represents the battlefield shrinking.

At the end of each round:

- Starting Round 3: all players take 1 collapse damage.
- Starting Round 6: all players take 2 collapse damage instead.

Additional pressure:

- Any player who did not attack during the round takes +1 additional collapse damage.

Collapse damage is not an attack and cannot be blocked by normal defense cards unless a card specifically says it can block collapse damage.

---

# End of Round Cleanup

At the end of each round:

1. Apply collapse damage.
2. Discard down to 7 cards.
3. Remove temporary effects.
4. Discard the active event card unless it says ongoing.
5. Pass the first-turn marker clockwise.

---

# First-Turn Marker

The player who goes first in Round 1 is determined by initiative.

At the end of each round, the first-turn marker passes clockwise.

This prevents one player from always acting first.

---

# Win Condition

The last player alive wins.

---

# Design Notes

This version corrects several early ambiguities:

- Events now have timing labels.
- “Final Circle” was replaced with “High Ground” because the old name implied the game was ending.
- Supply Drop no longer uses hidden bidding because that could become confusing and hard to resolve fairly.
- Loot is no longer artificially capped at 3. The 7-card hand limit already creates a natural cap.
- Eliminated players’ cards are revealed to everyone for transparency.
- Grenade splash now has precise targeting rules.
- Dodging the primary Grenade hit does not cancel splash damage.

---

# Future Actions / Roadmap

## Immediate Next Steps

- Run another simulated game using v0.3.
- Check whether loot becomes too strong now that eliminators may keep any cards up to hand size.
- Check whether Supply Drop feels useful without secret bidding.
- Test whether the lowest-health-first Supply Drop order helps balance the game.
- Confirm whether 20 health is correct or should be 18 or 24.

## Card Design Step

Create a card design system for the web prototype:

- Card size and layout
- Type colors
- Icons for damage, block, heal, draw, discard, reaction, collapse
- Rules text style
- Rarity or set markers if needed later
- Mobile-friendly and desktop-friendly layout

## Web Prototype Step

Prepare a Codex-ready implementation plan:

- React app structure
- Card data JSON/TypeScript model
- Game state model
- Turn engine
- Event system
- Combat resolver
- Bot/test mode or local multiplayer mode
- Log panel for debugging
- Simple placeholder card graphics first

## Later Production Steps

- Generate polished card artwork.
- Create printable prototype sheets.
- Add expansion card types.
- Add online multiplayer.
- Add ranked or competitive mode only after balance is stable.

---

# Open Questions

These are intentionally left unresolved until playtesting gives better evidence:

- Should players be allowed to play defense on behalf of another player?
- Should alliances have any formal rule support, or remain table talk only?
- Should there eventually be locations or zones, or should the game remain boardless?
- Should some weapons use ammo counters, or is that too much complexity?
- Should the game include character classes later, or only cards?

---

This is the current working ruleset for the first serious prototype.

---

# Additional Playtest Findings (v0.3 → v0.4 Adjustments)

After running multiple simulated games, the following patterns and issues consistently emerged:

## 1. Early Targeting Snowball

Players who deal high damage early (especially with Sniper Rifle) become immediate targets and often get eliminated before meaningful play.

### Fix

Add rule:

- **Opening Protection (Rounds 1–2):** Maximum damage from a single attack is capped at 6.

This keeps strong weapons impactful without instantly destabilizing the game.

---

## 2. Weapon Dominance (Sniper Rifle specifically)

Sniper Rifle remained disproportionately strong due to high burst damage.

### Fix

Current prototype adjustment:

- **Sniper Rifle:** Remains 8 damage, but Opening Protection caps single-attack damage at 6 during Rounds 1–2.

---

## 3. Defense Feels Too Limited Late Game

Limiting to 1 reaction defense sometimes makes players feel helpless in late rounds.

### Fix

Update rule:

- Players may use **1 reaction defense per attack normally**.
- If at **5 or less health**, they may use **up to 2 reaction defense cards per attack**.

This creates a comeback mechanic without overcomplicating early play.

---

## 4. Collapse Damage Ends Games Too Abruptly

Round 6+ dealing 2 damage per round sometimes ends games without meaningful interaction.

### Fix

Adjust collapse:

- Round 3+: 1 damage
- Round 6+: still 1 damage
- Round 8+: 2 damage

This extends the mid-game while keeping the endgame pressure.

---

## 5. Supply Drop Still Slightly Weak

Players often pass unless desperate.

### Fix

Enhance Supply Drop:

- Players may **take 1 card for free**, OR
- Take additional cards by paying health cost

This ensures the event always has impact.

---

## 6. Grenade Targeting Confusion (Resolved Fully)

Final clarification:

- Splash always hits the nearest living players in turn order
- The attacker is never hit unless explicitly stated
- Dodge only cancels damage to the player who used it

---

## 7. Loot Power Spike Acceptable (No Change)

Allowing players to keep up to hand size from eliminated players feels strong but **not broken** due to discard pressure and targeting.

No change needed.

---

## 8. Game Length Feels Good

Average simulation length: 5–7 rounds

No adjustment needed.

---

# Version Update

These changes define **Rules v0.4**.

This version is now stable enough to proceed into:

- Card design system
- Visual layout
- Web prototype
- Codex implementation

---

# Next Step

Proceed to **card design system (layout, icons, visual hierarchy)**.
