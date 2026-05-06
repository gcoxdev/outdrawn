// Last Hand Standing — Card Dataset v0.1
// Designed for the first web prototype.

export type CardType = "weapon" | "defense" | "ability" | "healing" | "event";

export type CardTiming =
  | "action"
  | "reaction"
  | "equip"
  | "immediate"
  | "thisRound"
  | "ongoing"
  | "lethal";

export type CardTarget =
  | "self"
  | "onePlayer"
  | "allPlayers"
  | "adjacentPlayers"
  | "none";

export type CardRarity = "common" | "uncommon" | "rare";

export type Card = {
  id: string;
  name: string;
  type: CardType;
  count: number;
  timing: CardTiming;
  target: CardTarget;
  rarity: CardRarity;

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

export const mainDeckCards: Card[] = [
  // Weapons — 24 cards
  {
    id: "weapon_pistol",
    name: "Pistol",
    type: "weapon",
    count: 6,
    timing: "action",
    target: "onePlayer",
    rarity: "common",
    damage: 3,
    supplyCost: 1,
    icons: ["damage", "target"],
    shortText: "Deal 3 damage to one player.",
    rulesText: "Deal 3 damage to one player.",
    flavorText: "Simple. Loud. Reliable.",
    tags: ["weapon", "basic", "single-target"]
  },
  {
    id: "weapon_shotgun",
    name: "Shotgun",
    type: "weapon",
    count: 4,
    timing: "action",
    target: "onePlayer",
    rarity: "uncommon",
    damage: 6,
    cooldownTurns: 1,
    supplyCost: 2,
    icons: ["damage", "cooldown", "target"],
    shortText: "Deal 6 damage. Cannot be used next turn.",
    rulesText: "Deal 6 damage to one player. After use, this weapon cannot be used on your next turn.",
    flavorText: "Close enough is good enough.",
    tags: ["weapon", "burst", "cooldown", "single-target"]
  },
  {
    id: "weapon_sniper_rifle",
    name: "Sniper Rifle",
    type: "weapon",
    count: 3,
    timing: "action",
    target: "onePlayer",
    rarity: "rare",
    damage: 7,
    supplyCost: 3,
    icons: ["damage", "target", "declare"],
    shortText: "Deal 7 damage. Declare target before modifiers.",
    rulesText: "Deal 7 damage to one player. You must declare the target before attack modifiers are played.",
    flavorText: "The shot lands before the panic does.",
    tags: ["weapon", "high-damage", "single-target"]
  },
  {
    id: "weapon_knife",
    name: "Knife",
    type: "weapon",
    count: 3,
    timing: "action",
    target: "onePlayer",
    rarity: "common",
    damage: 2,
    supplyCost: 1,
    icons: ["damage", "loot"],
    shortText: "Deal 2 damage. Better loot on elimination.",
    rulesText: "Deal 2 damage to one player. If this eliminates a player, you may keep 1 additional loot card before discarding down to hand size.",
    flavorText: "Quiet work pays extra.",
    tags: ["weapon", "loot", "single-target"]
  },
  {
    id: "weapon_grenade",
    name: "Grenade",
    type: "weapon",
    count: 3,
    timing: "action",
    target: "onePlayer",
    rarity: "uncommon",
    damage: 4,
    splashDamage: 2,
    supplyCost: 2,
    icons: ["damage", "splash", "target"],
    shortText: "Deal 4 to target and 2 splash to adjacent players.",
    rulesText: "Deal 4 damage to one target. Deal 2 splash damage to the next living player clockwise and counterclockwise from the target. The attacker is not hit by their own Grenade unless a card says otherwise. Dodge cancels damage only to the dodging player; splash still resolves.",
    flavorText: "Nobody is standing far enough away.",
    tags: ["weapon", "splash", "area"]
  },
  {
    id: "weapon_crossbow",
    name: "Crossbow",
    type: "weapon",
    count: 2,
    timing: "action",
    target: "onePlayer",
    rarity: "uncommon",
    damage: 4,
    ignoresArmor: true,
    supplyCost: 2,
    icons: ["damage", "pierce", "target"],
    shortText: "Deal 4 damage. Ignores Armor Vest.",
    rulesText: "Deal 4 damage to one player. This damage ignores equipped Armor Vest.",
    flavorText: "Old tech. New problem.",
    tags: ["weapon", "piercing", "single-target"]
  },
  {
    id: "weapon_smg",
    name: "SMG",
    type: "weapon",
    count: 3,
    timing: "action",
    target: "onePlayer",
    rarity: "uncommon",
    damage: 2,
    supplyCost: 2,
    icons: ["damage", "repeat", "target"],
    shortText: "Deal 2 damage twice to one player.",
    rulesText: "Deal 2 damage twice to the same player. Each hit resolves separately.",
    flavorText: "Accuracy by volume.",
    tags: ["weapon", "multi-hit", "single-target"]
  },

  // Defense — 20 cards
  {
    id: "defense_armor_vest",
    name: "Armor Vest",
    type: "defense",
    count: 4,
    timing: "equip",
    target: "self",
    rarity: "common",
    block: 2,
    supplyCost: 2,
    isEquip: true,
    icons: ["armor", "block"],
    shortText: "Equip. Reduce incoming damage by 2.",
    rulesText: "Equip as your defense item. Reduce all incoming attack and splash damage by 2 unless the damage ignores armor.",
    flavorText: "Not invincible. Just harder to kill.",
    tags: ["defense", "equip", "armor", "persistent"]
  },
  {
    id: "defense_shield_plate",
    name: "Shield Plate",
    type: "defense",
    count: 4,
    timing: "reaction",
    target: "self",
    rarity: "common",
    block: 4,
    supplyCost: 2,
    isReaction: true,
    icons: ["reaction", "block"],
    shortText: "Reaction. Block 4 damage.",
    rulesText: "Reaction defense. Block 4 damage from one attack, then discard this card.",
    flavorText: "A few seconds can save a life.",
    tags: ["defense", "reaction", "block"]
  },
  {
    id: "defense_dodge",
    name: "Dodge",
    type: "defense",
    count: 3,
    timing: "reaction",
    target: "self",
    rarity: "rare",
    supplyCost: 3,
    isReaction: true,
    icons: ["reaction", "cancel"],
    shortText: "Reaction. Cancel damage to yourself from one attack.",
    rulesText: "Reaction defense. Cancel damage to yourself from one attack. If used against Grenade, splash damage to other players still resolves.",
    flavorText: "The best armor is not being there.",
    tags: ["defense", "reaction", "cancel"]
  },
  {
    id: "defense_counterattack",
    name: "Counterattack",
    type: "defense",
    count: 2,
    timing: "reaction",
    target: "onePlayer",
    rarity: "uncommon",
    damage: 3,
    supplyCost: 2,
    isReaction: true,
    icons: ["reaction", "damage"],
    shortText: "Reaction. After taking damage, deal 3 back.",
    rulesText: "Reaction defense. After taking damage from an attack, deal 3 damage back to the attacker.",
    flavorText: "You first. Then me.",
    tags: ["defense", "reaction", "retaliation"]
  },
  {
    id: "defense_smoke_bomb",
    name: "Smoke Bomb",
    type: "defense",
    count: 2,
    timing: "reaction",
    target: "self",
    rarity: "uncommon",
    supplyCost: 2,
    isReaction: true,
    icons: ["reaction", "cancel", "stealth"],
    shortText: "Reaction. Cancel damage and become untargetable.",
    rulesText: "Reaction defense. Cancel damage to yourself from one attack. Until your next turn, you cannot be targeted except by splash or event damage.",
    flavorText: "A cloud of smoke can be a wall.",
    tags: ["defense", "reaction", "cancel", "stealth"]
  },
  {
    id: "defense_decoy",
    name: "Decoy",
    type: "defense",
    count: 2,
    timing: "reaction",
    target: "onePlayer",
    rarity: "uncommon",
    supplyCost: 2,
    isReaction: true,
    icons: ["reaction", "redirect"],
    shortText: "Reaction. Redirect an attack to another valid player.",
    rulesText: "Reaction defense. Redirect an attack targeting you to another valid player. Does not redirect event or collapse damage.",
    flavorText: "Wrong shadow.",
    tags: ["defense", "reaction", "redirect"]
  },
  {
    id: "defense_brace",
    name: "Brace",
    type: "defense",
    count: 2,
    timing: "reaction",
    target: "self",
    rarity: "common",
    supplyCost: 2,
    isReaction: true,
    icons: ["reaction", "block"],
    shortText: "Reaction. Reduce damage by half.",
    rulesText: "Reaction defense. Reduce damage from one attack by half, rounded down.",
    flavorText: "Take the hit on your terms.",
    tags: ["defense", "reaction", "block"]
  },
  {
    id: "defense_fake_death",
    name: "Fake Death",
    type: "defense",
    count: 1,
    timing: "lethal",
    target: "self",
    rarity: "rare",
    supplyCost: 3,
    isLethalDefense: true,
    icons: ["lethal", "survive"],
    shortText: "Survive lethal player damage at 1 HP. Discard hand.",
    rulesText: "Lethal defense. When you would be eliminated by another player's attack, survive at 1 health and discard your hand.",
    flavorText: "The body count was off by one.",
    tags: ["defense", "lethal", "survival"]
  },

  // Abilities — 22 cards
  {
    id: "ability_ambush",
    name: "Ambush",
    type: "ability",
    count: 3,
    timing: "action",
    target: "self",
    rarity: "common",
    damage: 3,
    supplyCost: 2,
    icons: ["damage", "buff"],
    shortText: "Your next attack this turn deals +3 damage.",
    rulesText: "Your next attack this turn deals +3 damage.",
    flavorText: "The fight starts before they know it.",
    tags: ["ability", "modifier", "damage-buff"]
  },
  {
    id: "ability_disarm",
    name: "Disarm",
    type: "ability",
    count: 3,
    timing: "action",
    target: "onePlayer",
    rarity: "common",
    discard: 1,
    supplyCost: 2,
    icons: ["discard", "weapon"],
    shortText: "Target discards their equipped weapon.",
    rulesText: "Choose one player. They discard their equipped weapon.",
    flavorText: "A threat without a weapon is just noise.",
    tags: ["ability", "control", "weapon-removal"]
  },
  {
    id: "ability_steal",
    name: "Steal",
    type: "ability",
    count: 3,
    timing: "action",
    target: "onePlayer",
    rarity: "common",
    supplyCost: 2,
    icons: ["steal", "hand"],
    shortText: "Take 1 random card from another player.",
    rulesText: "Choose one player. Take 1 random card from their hand.",
    flavorText: "Looting is easier when they are still alive.",
    tags: ["ability", "hand-attack", "steal"]
  },
  {
    id: "ability_search",
    name: "Search",
    type: "ability",
    count: 3,
    timing: "action",
    target: "self",
    rarity: "common",
    draw: 3,
    supplyCost: 2,
    icons: ["draw", "choose", "discard"],
    shortText: "Draw 3, keep 1, discard the rest.",
    rulesText: "Draw 3 cards. Keep 1 and discard the rest.",
    flavorText: "Something useful is always buried nearby.",
    tags: ["ability", "card-selection", "draw"]
  },
  {
    id: "ability_reload",
    name: "Reload",
    type: "ability",
    count: 2,
    timing: "action",
    target: "self",
    rarity: "uncommon",
    supplyCost: 2,
    icons: ["reuse", "weapon"],
    shortText: "Use a weapon even if unavailable this turn.",
    rulesText: "You may use a weapon this turn even if it would normally be unavailable because of a cooldown effect.",
    flavorText: "The empty click was only a pause.",
    tags: ["ability", "weapon-support", "cooldown"]
  },
  {
    id: "ability_sabotage",
    name: "Sabotage",
    type: "ability",
    count: 2,
    timing: "action",
    target: "onePlayer",
    rarity: "uncommon",
    discard: 2,
    supplyCost: 2,
    icons: ["discard", "hand"],
    shortText: "Target discards 2 cards of their choice.",
    rulesText: "Choose one player. They discard 2 cards of their choice.",
    flavorText: "Plans burn faster than supplies.",
    tags: ["ability", "control", "discard"]
  },
  {
    id: "ability_mark_target",
    name: "Mark Target",
    type: "ability",
    count: 2,
    timing: "action",
    target: "onePlayer",
    rarity: "uncommon",
    damage: 1,
    supplyCost: 2,
    icons: ["mark", "damage"],
    shortText: "Attacks against target deal +1 this round.",
    rulesText: "Choose one player. Attacks against that player deal +1 damage until the end of the round.",
    flavorText: "Everyone saw the signal.",
    tags: ["ability", "mark", "damage-buff"]
  },
  {
    id: "ability_intimidate",
    name: "Intimidate",
    type: "ability",
    count: 2,
    timing: "action",
    target: "onePlayer",
    rarity: "uncommon",
    supplyCost: 2,
    icons: ["control", "discard"],
    shortText: "Target must discard 1 to attack you before your next turn.",
    rulesText: "Choose one player. Until your next turn, that player cannot attack you unless they discard 1 card first.",
    flavorText: "Fear is a resource too.",
    tags: ["ability", "control", "deterrent"]
  },
  {
    id: "ability_adrenaline",
    name: "Adrenaline",
    type: "ability",
    count: 2,
    timing: "action",
    target: "self",
    rarity: "rare",
    supplyCost: 2,
    icons: ["extra-action", "self-damage"],
    shortText: "Gain 1 action this turn, then lose 2 health.",
    rulesText: "Gain 1 extra action this turn, then lose 2 health.",
    flavorText: "Move now. Pay later.",
    tags: ["ability", "extra-action", "risk"]
  },

  // Healing — 10 cards
  {
    id: "healing_bandage",
    name: "Bandage",
    type: "healing",
    count: 4,
    timing: "action",
    target: "self",
    rarity: "common",
    heal: 3,
    supplyCost: 1,
    icons: ["heal"],
    shortText: "Heal 3.",
    rulesText: "Heal 3 health. You cannot exceed your maximum health.",
    flavorText: "Not pretty. Good enough.",
    tags: ["healing", "basic"]
  },
  {
    id: "healing_medkit",
    name: "Medkit",
    type: "healing",
    count: 3,
    timing: "action",
    target: "self",
    rarity: "uncommon",
    heal: 6,
    actionsCost: 2,
    supplyCost: 1,
    icons: ["heal", "two-actions"],
    shortText: "Heal 6. Costs both actions.",
    rulesText: "Heal 6 health. This costs both of your actions for the turn. You cannot exceed your maximum health.",
    flavorText: "A full stop in the middle of a war.",
    tags: ["healing", "large-heal", "two-actions"]
  },
  {
    id: "healing_painkillers",
    name: "Painkillers",
    type: "healing",
    count: 2,
    timing: "action",
    target: "self",
    rarity: "common",
    heal: 2,
    draw: 1,
    supplyCost: 1,
    icons: ["heal", "draw"],
    shortText: "Heal 2 and draw 1 card.",
    rulesText: "Heal 2 health and draw 1 card. You cannot exceed your maximum health.",
    flavorText: "Pain is information. Ignore it briefly.",
    tags: ["healing", "draw"]
  },
  {
    id: "healing_second_wind",
    name: "Second Wind",
    type: "healing",
    count: 1,
    timing: "lethal",
    target: "self",
    rarity: "rare",
    supplyCost: 3,
    isLethalDefense: true,
    icons: ["lethal", "survive"],
    shortText: "Survive elimination at 1 HP. Discard hand.",
    rulesText: "When you would be eliminated, survive at 1 health and discard your hand.",
    flavorText: "One breath left is still one breath.",
    tags: ["healing", "lethal", "survival"]
  }
];

export const eventDeckCards: Card[] = [
  // Events — 16 cards
  {
    id: "event_pressure_zone",
    name: "Pressure Zone",
    type: "event",
    count: 2,
    timing: "thisRound",
    target: "allPlayers",
    rarity: "common",
    icons: ["collapse", "attack"],
    shortText: "Non-attacking players take +1 collapse damage.",
    rulesText: "This round, players who do not attack take +1 additional collapse damage.",
    flavorText: "The safe path disappeared first.",
    tags: ["event", "collapse", "pressure"]
  },
  {
    id: "event_supply_drop",
    name: "Supply Drop",
    type: "event",
    count: 2,
    timing: "immediate",
    target: "allPlayers",
    rarity: "uncommon",
    icons: ["draw", "supply", "health-cost"],
    shortText: "Reveal 3 cards. Lowest health chooses first.",
    rulesText: "Reveal 3 main-deck cards. Starting with the lowest-health player and proceeding upward, each player may take 1 card for free. A player may take additional revealed cards by paying each card's supply cost in health. Unclaimed cards are discarded.",
    flavorText: "Falling crates make rising tensions.",
    tags: ["event", "supply", "card-gain"]
  },
  {
    id: "event_bounty",
    name: "Bounty",
    type: "event",
    count: 2,
    timing: "thisRound",
    target: "onePlayer",
    rarity: "common",
    icons: ["mark", "draw"],
    shortText: "Highest-health player is marked. Damage them to draw 1.",
    rulesText: "The highest-health player is marked this round. Whenever another player damages them, that attacker draws 1 card.",
    flavorText: "The leader is never hard to find.",
    tags: ["event", "bounty", "catch-up"]
  },
  {
    id: "event_high_ground",
    name: "High Ground",
    type: "event",
    count: 2,
    timing: "thisRound",
    target: "allPlayers",
    rarity: "common",
    damage: 1,
    icons: ["damage", "first-attack"],
    shortText: "Each player's first attack this round deals +1.",
    rulesText: "The first attack each player makes this round deals +1 damage.",
    flavorText: "Position decides the opening shot.",
    tags: ["event", "damage-buff", "tempo"]
  },
  {
    id: "event_low_ammo",
    name: "Low Ammo",
    type: "event",
    count: 2,
    timing: "immediate",
    target: "allPlayers",
    rarity: "common",
    damage: 3,
    discard: 1,
    icons: ["discard", "weapon", "damage"],
    shortText: "Discard a weapon or take 3 damage.",
    rulesText: "Each player must discard one weapon from hand or equipped area. Players who cannot discard a weapon take 3 damage.",
    flavorText: "The loudest guns run dry first.",
    tags: ["event", "weapon-pressure", "damage"]
  },
  {
    id: "event_no_cover",
    name: "No Cover",
    type: "event",
    count: 2,
    timing: "thisRound",
    target: "allPlayers",
    rarity: "common",
    icons: ["defense-down", "reaction"],
    shortText: "Reaction blocks/reductions prevent 1 less damage.",
    rulesText: "Reaction defense cards block or reduce 1 less damage this round. Dodge, Smoke Bomb, Decoy, Fake Death, and Second Wind are unaffected.",
    flavorText: "Every hiding place has an angle.",
    tags: ["event", "defense-nerf"]
  },
  {
    id: "event_critical_condition",
    name: "Critical Condition",
    type: "event",
    count: 2,
    timing: "immediate",
    target: "allPlayers",
    rarity: "common",
    damage: 1,
    icons: ["damage", "low-health"],
    shortText: "Players at 10 or less take damage.",
    rulesText: "Players at 10 or less health take 1 damage. Players below 5 health take 2 damage instead.",
    flavorText: "Weakness has a sound.",
    tags: ["event", "low-health", "pressure"]
  },
  {
    id: "event_black_market",
    name: "Black Market",
    type: "event",
    count: 2,
    timing: "thisRound",
    target: "allPlayers",
    rarity: "uncommon",
    discard: 2,
    actionsCost: 1,
    icons: ["search", "discard", "action"],
    shortText: "Spend 1 action and discard 2 to search for 1 card.",
    rulesText: "This round, players may spend 1 action and discard 2 cards to search the deck for 1 card, reveal it, add it to hand, then shuffle the deck.",
    flavorText: "Everything is available. Nothing is free.",
    tags: ["event", "search", "card-selection"]
  }
];

export const allCards: Card[] = [...mainDeckCards, ...eventDeckCards];

export const deckSummary = {
  mainDeckTotal: mainDeckCards.reduce((sum, card) => sum + card.count, 0),
  eventDeckTotal: eventDeckCards.reduce((sum, card) => sum + card.count, 0),
  mainDeckBreakdown: {
    weapon: mainDeckCards.filter((card) => card.type === "weapon").reduce((sum, card) => sum + card.count, 0),
    defense: mainDeckCards.filter((card) => card.type === "defense").reduce((sum, card) => sum + card.count, 0),
    ability: mainDeckCards.filter((card) => card.type === "ability").reduce((sum, card) => sum + card.count, 0),
    healing: mainDeckCards.filter((card) => card.type === "healing").reduce((sum, card) => sum + card.count, 0)
  }
};
