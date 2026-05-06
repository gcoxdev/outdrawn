# Last Hand Standing — Codex Web Prototype Plan v0.1

This plan is designed to give Codex a clear path to build a playable local web prototype of **Last Hand Standing** using the existing rules, card dataset, and UI design spec.

Recommended stack:

- **Vite + React + TypeScript**
- Local state only for first prototype
- No backend yet
- No online multiplayer yet
- Placeholder art first

Vite is a good fit because it is a modern frontend build tool with a straightforward React + TypeScript setup. React’s `useReducer` pattern is also appropriate because the game state has many related sub-values: players, deck, hands, current turn, events, combat prompts, and log entries.

---

# Prototype Goal

Build a playable local hot-seat prototype where 3–6 players can play from one browser.

The prototype should prioritize:

1. Correct rules execution
2. Clear game flow
3. Legal move enforcement
4. Debug-friendly game log
5. Card readability

It should not prioritize final art, animations, online play, or account systems yet.

---

# Project Setup

Create project:

```bash
npm create vite@latest last-hand-standing -- --template react-ts
cd last-hand-standing
npm install
npm install lucide-react clsx
npm run dev
```

Optional but recommended later:

```bash
npm install framer-motion
```

---

# Suggested File Structure

```txt
src/
  App.tsx
  main.tsx
  index.css

  data/
    cards.ts
    constants.ts

  game/
    types.ts
    setup.ts
    reducer.ts
    actions.ts
    selectors.ts
    rules.ts
    combat.ts
    events.ts
    deck.ts
    log.ts

  components/
    CardView.tsx
    CardHeader.tsx
    CardArt.tsx
    CardStats.tsx
    CardRulesText.tsx
    CardFooter.tsx
    PlayerPanel.tsx
    PlayerBoard.tsx
    Hand.tsx
    EventPanel.tsx
    ActionPanel.tsx
    GameLog.tsx
    TargetPicker.tsx
    ReactionPrompt.tsx
    SetupScreen.tsx
    DebugPanel.tsx

  styles/
    cardTokens.ts
```

---

# Core Constants

Create `src/data/constants.ts`:

```ts
export const STARTING_HEALTH = 20;
export const MAX_HEALTH = 20;
export const STARTING_HAND_SIZE = 5;
export const MAX_HAND_SIZE = 7;
export const ACTIONS_PER_TURN = 2;
export const OPENING_DAMAGE_CAP_ROUNDS = 2;
export const OPENING_DAMAGE_CAP = 6;
```

---

# Core Types

Create `src/game/types.ts`.

```ts
export type PlayerId = string;
export type CardInstanceId = string;

export type CardType = "weapon" | "defense" | "ability" | "healing" | "event";
export type CardTiming = "action" | "reaction" | "equip" | "immediate" | "thisRound" | "ongoing" | "lethal";
export type CardTarget = "self" | "onePlayer" | "allPlayers" | "adjacentPlayers" | "none";

export type CardDefinition = {
  id: string;
  name: string;
  type: CardType;
  count: number;
  timing: CardTiming;
  target: CardTarget;
  rarity: "common" | "uncommon" | "rare";
  damage?: number;
  splashDamage?: number;
  block?: number;
  heal?: number;
  draw?: number;
  discard?: number;
  actionsCost?: number;
  supplyCost?: number;
  isEquip?: boolean;
  isReaction?: boolean;
  isLethalDefense?: boolean;
  ignoresArmor?: boolean;
  cooldownTurns?: number;
  icons: string[];
  shortText: string;
  rulesText: string;
  flavorText?: string;
  tags: string[];
};

export type CardInstance = {
  instanceId: CardInstanceId;
  definitionId: string;
};

export type Stance = "aggressive" | "defensive" | "scavenger" | "hunter" | null;

export type PlayerState = {
  id: PlayerId;
  name: string;
  health: number;
  hand: CardInstance[];
  equippedWeapon: CardInstance | null;
  equippedDefense: CardInstance | null;
  eliminated: boolean;
  stance: Stance;
  hunterTargetId: PlayerId | null;
  attackedThisRound: boolean;
  firstAttackUsed: boolean;
  firstReactionUsed: boolean;
  actionsRemaining: number;
  weaponCooldowns: Record<string, number>;
};

export type ActiveEvent = {
  card: CardInstance;
  timing: "thisRound" | "ongoing";
};

export type LogEntry = {
  id: string;
  round: number;
  message: string;
};

export type PendingReaction = {
  attackerId: PlayerId;
  defenderId: PlayerId;
  sourceCard: CardInstance;
  baseDamage: number;
  modifiedDamage: number;
  canUseReactionCards: boolean;
};

export type GamePhase =
  | "setup"
  | "event"
  | "draw"
  | "stance"
  | "action"
  | "reaction"
  | "cleanup"
  | "gameOver";

export type GameState = {
  phase: GamePhase;
  round: number;
  players: PlayerState[];
  currentPlayerIndex: number;
  firstPlayerIndex: number;
  mainDeck: CardInstance[];
  eventDeck: CardInstance[];
  discardPile: CardInstance[];
  eventDiscardPile: CardInstance[];
  activeEvent: ActiveEvent | null;
  pendingReaction: PendingReaction | null;
  selectedCardId: CardInstanceId | null;
  log: LogEntry[];
  winnerId: PlayerId | null;
};
```

---

# Game Actions

Use a reducer so all state transitions are centralized.

Create `src/game/actions.ts`:

```ts
import type { CardInstanceId, PlayerId, Stance } from "./types";

export type GameAction =
  | { type: "START_GAME"; playerNames: string[] }
  | { type: "ADVANCE_PHASE" }
  | { type: "DRAW_FOR_PLAYER"; playerId: PlayerId; count: number }
  | { type: "SELECT_STANCE"; playerId: PlayerId; stance: Stance; hunterTargetId?: PlayerId }
  | { type: "SELECT_CARD"; cardInstanceId: CardInstanceId | null }
  | { type: "PLAY_CARD"; playerId: PlayerId; cardInstanceId: CardInstanceId; targetPlayerId?: PlayerId }
  | { type: "EQUIP_CARD"; playerId: PlayerId; cardInstanceId: CardInstanceId }
  | { type: "ATTACK"; attackerId: PlayerId; targetPlayerId: PlayerId; weaponInstanceId: CardInstanceId }
  | { type: "PLAY_REACTION"; defenderId: PlayerId; reactionCardInstanceId: CardInstanceId | null }
  | { type: "DRAW_ACTION"; playerId: PlayerId }
  | { type: "DISCARD_CARDS"; playerId: PlayerId; cardInstanceIds: CardInstanceId[] }
  | { type: "PASS_ACTION"; playerId: PlayerId }
  | { type: "END_TURN" }
  | { type: "END_ROUND" }
  | { type: "RESET_GAME" };
```

---

# Game Setup

Create `src/game/setup.ts`.

Responsibilities:

- Expand card definitions into individual card instances
- Shuffle decks
- Create players
- Determine first player
- Deal starting hands

First prototype simplification:

- Instead of fully simulating initiative reveal, randomly choose first player.
- Add initiative system in milestone 2.

Later, implement official rule:

> Reveal cards from the top of the main deck until each player has revealed one weapon. Highest weapon damage goes first. Discard revealed cards.

---

# Reducer Responsibilities

Create `src/game/reducer.ts`.

The reducer should handle high-level state movement but delegate detailed rule calculations to helper functions.

Reducer should not contain large combat math directly.

Use helpers:

- `resolveAttack`
- `resolveReaction`
- `resolveEvent`
- `applyCollapse`
- `checkEliminations`
- `cleanupHands`
- `advanceToNextLivingPlayer`

---

# Combat System

Create `src/game/combat.ts`.

Combat flow:

1. Attacker chooses equipped weapon or weapon from hand if already equipped logic allows.
2. Calculate base damage.
3. Apply modifiers:
   - Opening damage cap rounds 1–2
   - Aggressive stance +1 first attack
   - Scavenger stance -1 first attack
   - High Ground +1 first attack this round
   - Mark Target +1 if active against target
   - Ambush +3 if active
4. Create pending reaction.
5. Defender may play reaction or skip.
6. Apply defense.
7. Apply Armor Vest if applicable.
8. Apply damage.
9. Resolve splash damage if Grenade.
10. Check elimination.
11. Resolve loot.
12. Log everything.

Important implementation note:

For prototype v1, Ambush and Mark Target may be implemented as temporary flags on state rather than a full effect stack.

---

# Reaction Defense Rules

Default:

- A defender may play 1 reaction defense card per attack.

Comeback rule:

- If defender has 5 or less health, they may play up to 2 reaction defense cards per attack.

Prototype simplification:

- Implement 1 reaction first.
- Add 2-reaction low-health rule after basic combat works.

---

# Grenade Splash Rules

Create helper:

```ts
getGrenadeSplashTargets(players, attackerId, primaryTargetId): PlayerId[]
```

Rules:

- Primary target takes 4.
- Next living player clockwise from target takes 2.
- Next living player counterclockwise from target takes 2.
- Attacker is not hit by their own Grenade unless future card says otherwise.
- With 2 players left, only primary target is damaged.
- With 3 players left, only the other non-attacking player takes splash.
- Dodge only cancels damage to the dodging player; splash still resolves.

---

# Event System

Create `src/game/events.ts`.

Events:

## Pressure Zone
This round, non-attacking players take +1 collapse damage.

## Supply Drop
Reveal 3 main-deck cards. Lowest health chooses first.

Prototype implementation:

- Reveal 3 cards in an overlay.
- Each living player gets one pick opportunity in lowest-health order.
- First card picked is free.
- Additional picks cost supplyCost health.
- Unclaimed cards go to discard.

Simpler v1 option:

- Lowest-health player takes 1 free card.
- Next-lowest takes 1 free card.
- Continue until cards are gone.
- Add paid extra picks later.

## Bounty
Highest-health player marked. Damaging them draws 1 card.

## High Ground
Each player’s first attack this round deals +1.

## Low Ammo
Each player discards a weapon or takes 3 damage.

Prototype simplification:

- If player has weapon in hand, auto-discard first weapon in hand.
- Else if equipped weapon exists, discard equipped weapon.
- Else take 3 damage.

Later add player choice.

## No Cover
Reaction defense cards block/reduce 1 less damage. Dodge, Smoke Bomb, Decoy, Fake Death, Second Wind unaffected.

## Critical Condition
Players at 10 or less take 1. Players below 5 take 2 instead.

## Black Market
This round players may spend 1 action and discard 2 to search deck for 1 card.

Prototype simplification:

- Show searchable list of card definitions.
- Pick one available card from deck.
- Reveal and add to hand.
- Shuffle deck.

---

# Turn / Round Engine

Create `src/game/rules.ts`.

Required helpers:

```ts
getCurrentPlayer(state): PlayerState;
getLivingPlayers(state): PlayerState[];
isGameOver(state): boolean;
getWinner(state): PlayerState | null;
canPlayerAct(state, playerId): boolean;
canPlayCard(state, playerId, cardInstanceId): boolean;
getLegalTargets(state, playerId, cardInstanceId): PlayerId[];
```

Turn flow:

1. Current player starts with 2 actions.
2. Player spends actions until 0 or presses End Turn.
3. Move to next living player.
4. If all living players acted, end round.
5. Apply collapse.
6. Cleanup hand sizes.
7. Move first-player marker clockwise.
8. Start next round.

---

# UI Layout

Main game screen:

```txt
┌──────────────────────────────────────────────┐
│ Round / Phase / Active Event                 │
├──────────────────────────────────────────────┤
│ Opponent Panels                              │
│ [Player] [Player] [Player]                   │
├──────────────────────────────────────────────┤
│ Center Area                                  │
│ Event Card / Target Picker / Combat Prompt   │
├──────────────────────────────────────────────┤
│ Current Player Board                         │
│ Equipped Weapon | Equipped Defense | HP      │
├──────────────────────────────────────────────┤
│ Current Player Hand                          │
│ [Card] [Card] [Card] [Card]                  │
├──────────────────────────────────────────────┤
│ Actions / End Turn / Draw / Pass             │
├──────────────────────────────────────────────┤
│ Game Log                                     │
└──────────────────────────────────────────────┘
```

---

# Components

## SetupScreen

Allows:

- Choose player count 3–6
- Enter player names
- Start game

## PlayerPanel

Shows:

- Name
- Health
- Hand count
- Equipped weapon
- Equipped defense
- Eliminated state
- Whether they attacked this round
- Bounty/mark indicators

## CardView

Uses Card UI Design Spec.

Props:

```ts
type CardViewProps = {
  card: CardDefinition;
  instanceId?: string;
  mode: "hand" | "board" | "zoom";
  isPlayable?: boolean;
  isSelected?: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
};
```

## Hand

Displays current player’s hand.

Only current player’s hand is visible in hot-seat prototype.

## EventPanel

Shows active event and timing.

## ActionPanel

Shows legal actions:

- Play selected card
- Equip selected card
- Attack selected target
- Draw 1
- Discard 2 to draw 1
- Pass
- End turn

## TargetPicker

Shows legal target buttons after selecting a targeted card or attack.

## ReactionPrompt

Shown when a player is attacked.

Options:

- Play legal reaction card
- Skip reaction

## GameLog

Logs every important step.

Example:

```txt
Round 3: Blake attacked Ari with Shotgun for 6 damage.
Ari played Shield Plate and blocked 4.
Ari took 2 damage. Ari is now at 11 HP.
```

---

# Legal Move Priorities

Codex should enforce these before full polish:

- Cannot play healing at full health unless it draws or has another effect.
- Cannot attack eliminated players.
- Cannot target self unless card allows self.
- Cannot exceed action count.
- Cannot use Shotgun while on cooldown.
- Cannot keep more than 7 cards after cleanup/loot.
- Cannot equip more than 1 weapon and 1 defense.
- Cannot block collapse damage with normal defense.

---

# Milestone Build Order

## Milestone 1 — Static UI + Card Rendering

- Load card dataset
- Render sample hand
- Render player panels
- Render event panel
- Render game log placeholder

Acceptance:

- All card types render with correct colors/icons.
- Card hover and zoom work.

## Milestone 2 — Game Setup and Decks

- Create shuffled main deck and event deck
- Create players
- Deal starting hands
- Random first player for now

Acceptance:

- New game starts with correct player health and hand sizes.

## Milestone 3 — Basic Turns and Actions

- Current player flow
- Draw action
- Equip action
- Pass/end turn
- Action counter

Acceptance:

- Players can take turns and rounds advance.

## Milestone 4 — Basic Combat

- Equipped weapon attack
- Damage application
- Armor Vest reduction
- Elimination check
- Game winner check

Acceptance:

- Player can attack and eliminate another player.

## Milestone 5 — Reaction Defense

- Pending reaction prompt
- Shield Plate
- Dodge
- Brace
- Counterattack
- Smoke Bomb
- Decoy later if needed

Acceptance:

- Defender can respond before damage resolves.

## Milestone 6 — Abilities and Healing

- Bandage
- Medkit
- Painkillers
- Ambush
- Disarm
- Steal
- Search
- Adrenaline

Acceptance:

- Most non-event main deck cards are playable.

## Milestone 7 — Events and Collapse

- Reveal event each round
- Implement each event
- Apply collapse end of round

Acceptance:

- Game can run from start to finish with events.

## Milestone 8 — Loot and Cleanup

- Reveal eliminated player cards
- Eliminator chooses loot
- Discard to hand limit

Acceptance:

- Eliminations create loot flow without breaking hand size.

## Milestone 9 — Debug/Test Tools

- New game button
- Seeded random option
- Show all hands toggle
- Force draw card
- Force event

Acceptance:

- Game is easy to test and balance.

---

# Codex Prompt — Initial Build

Use this prompt when starting the project:

```txt
Build a local hot-seat React + TypeScript web prototype for a battle royale card game called Last Hand Standing.

Use Vite + React + TypeScript. Use local state only, no backend. Use a useReducer-based game engine.

Implement the project structure described in Last Hand Standing — Codex Web Prototype Plan v0.1.

Start with Milestone 1 and Milestone 2 only:
1. Load the full card dataset from cards.ts.
2. Render cards using the Card UI Design Spec.
3. Create a setup screen for 3–6 players.
4. Start a game by creating players, shuffling decks, dealing 5 cards, and choosing a random first player.
5. Show player panels, current player hand, active round/phase, and game log.

Do not implement combat yet. Keep the code clean, typed, and organized so later milestones can add rules.
```

---

# Codex Prompt — Add Turn Engine

```txt
Continue the Last Hand Standing prototype.

Implement Milestone 3:
- Current player turn flow
- 2 actions per turn
- Draw 1 card action
- Equip weapon and defense cards
- Pass action
- End turn
- Advance to next living player
- End round after all living players act
- Start next round

Enforce max one equipped weapon and one equipped defense. Log every action.
```

---

# Codex Prompt — Add Combat

```txt
Continue the Last Hand Standing prototype.

Implement Milestone 4:
- Attacking with equipped weapons
- Target selection
- Damage application
- Armor Vest reduction
- Opening damage cap in rounds 1–2
- Shotgun cooldown
- Elimination checks
- Winner detection
- Game log entries

Do not implement reaction defense yet. Add TODO hooks for pending reactions.
```

---

# Codex Prompt — Add Reactions

```txt
Continue the Last Hand Standing prototype.

Implement Milestone 5:
- Pending reaction state when a player is attacked
- Legal reaction cards from defender hand
- Shield Plate, Dodge, Brace, Counterattack, Smoke Bomb
- Allow defender to skip reaction
- Resolve damage after reaction
- At 5 or less health, allow up to 2 reaction defenses per attack if practical; otherwise add a TODO and keep 1 reaction for now.

Log all reaction decisions and final damage.
```

---

# Codex Prompt — Add Events

```txt
Continue the Last Hand Standing prototype.

Implement Milestone 7:
- Event phase at start of each round
- Draw event card
- Display active event
- Implement Pressure Zone, Bounty, High Ground, Low Ammo, No Cover, Critical Condition, Black Market, and Supply Drop
- Apply collapse at end of round
- Discard temporary this-round events at cleanup

Keep event logic in src/game/events.ts.
```

---

# Prototype Scope Boundaries

Do not build yet:

- Online multiplayer
- Accounts
- Ranked mode
- Card packs
- Final artwork pipeline
- Payment/store systems
- Animations beyond basic hover

Build first:

- A local playable version
- Clear logs
- Correct rules
- Debug tools

---

# Notes for Future Physical Card Work

The web prototype should not be treated as the final print source.

For print production later:

- Use 2.5 in x 3.5 in poker-size cards
- Design at 300 DPI
- Include bleed and safe zones
- Keep card text and icons inside safe area
- Create separate print-ready front/back assets

The web prototype should mimic the print layout, but the final cards should be exported from a print-specific design workflow.

---

# Current Recommended Next Step

Send Codex the **Initial Build** prompt and have it complete Milestone 1 and Milestone 2 only.

Do not ask Codex to build the whole game in one pass. The rules are detailed enough that a staged implementation will be much more reliable.

