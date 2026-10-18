// Outdrawn - Card Dataset v0.1
// Designed for the first web prototype.

export type CardType = "weapon" | "defense" | "ability" | "healing" | "event";

export type CardTiming =
  | "action"
  | "reaction"
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
  maxTargets?: number;
  maxDamagePerTarget?: number;

  isReaction?: boolean;
  isLethalDefense?: boolean;
  ignoresArmor?: boolean;

  icons: string[];
  shortText: string;
  rulesText: string;
  flavorText?: string;
  tags: string[];
};

export const mainDeckCards: Card[] = [
  // Weapons — 35 cards
  {
    id: "weapon_pistol",
    name: "Pistol",
    type: "weapon",
    count: 8,
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
    count: 5,
    timing: "action",
    target: "onePlayer",
    rarity: "uncommon",
    damage: 6,
    supplyCost: 2,
    icons: ["damage", "target"],
    shortText: "Deal 6 damage to one player.",
    rulesText: "Deal 6 damage to one player.",
    flavorText: "Close enough is good enough.",
    tags: ["weapon", "burst", "single-target"]
  },
  {
    id: "weapon_sniper_rifle",
    name: "Sniper Rifle",
    type: "weapon",
    count: 3,
    timing: "action",
    target: "onePlayer",
    rarity: "rare",
    damage: 8,
    supplyCost: 3,
    icons: ["damage", "target"],
    shortText: "Deal 8 damage to one player.",
    rulesText: "Deal 8 damage to one player.",
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
    shortText: "Deal 2 damage to one player.",
    rulesText: "Deal 2 damage to one player.",
    flavorText: "Some arguments need a sharp point.",
    tags: ["weapon", "loot", "single-target"]
  },
  {
    id: "weapon_grenade",
    name: "Grenade",
    type: "weapon",
    count: 4,
    timing: "action",
    target: "onePlayer",
    rarity: "uncommon",
    damage: 4,
    splashDamage: 2,
    supplyCost: 2,
    icons: ["damage", "splash", "target"],
    shortText: "Deal 4 damage, plus 2 splash to players before and after target.",
    rulesText: "Deal 4 damage to one player and 2 splash damage to the next living player on each side in seating order. You are immune.",
    flavorText: "One little pin. One big boom.",
    tags: ["weapon", "splash", "area"]
  },
  {
    id: "weapon_assault_rifle",
    name: "Assault Rifle",
    type: "weapon",
    count: 4,
    timing: "action",
    target: "onePlayer",
    rarity: "uncommon",
    damage: 5,
    supplyCost: 2,
    icons: ["damage", "target"],
    shortText: "Deal 5 damage to one player.",
    rulesText: "Deal 5 damage to one player.",
    flavorText: "Controlled fire. Serious pressure.",
    tags: ["weapon", "midrange", "single-target"]
  },
  {
    id: "weapon_crossbow",
    name: "Crossbow",
    type: "weapon",
    count: 3,
    timing: "action",
    target: "onePlayer",
    rarity: "uncommon",
    damage: 4,
    ignoresArmor: true,
    supplyCost: 2,
    icons: ["damage", "pierce", "target"],
    shortText: "Deal 4 damage. Pierces Armor Vest.",
    rulesText: "Deal 4 damage to one player. Pierces Armor Vest.",
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
    damage: 4,
    supplyCost: 2,
    icons: ["damage", "repeat", "target"],
    shortText: "Deal 2 damage twice to one player.",
    rulesText: "Deal 2 damage twice to one player. Resolve each hit separately.",
    flavorText: "Accuracy by volume.",
    tags: ["weapon", "multi-hit", "single-target"]
  },
  {
    id: "weapon_minigun",
    name: "Minigun",
    type: "weapon",
    count: 2,
    timing: "action",
    target: "self",
    rarity: "rare",
    damage: 6,
    maxDamagePerTarget: 3,
    supplyCost: 3,
    icons: ["damage", "spray"],
    shortText: "Split up to 6 damage among opponents, max 3 each.",
    rulesText: "Split up to 6 damage among opponents, max 3 each. Each may defend once only if secondary defense is agreed to.",
    flavorText: "Nothing mini about the consequences.",
    tags: ["weapon", "area", "all-opponents"]
  },

  // Defense — 20 cards
  {
    id: "defense_armor_vest",
    name: "Armor Vest",
    type: "defense",
    count: 3,
    timing: "reaction",
    target: "self",
    rarity: "common",
    block: 4,
    supplyCost: 2,
    isReaction: true,
    icons: ["armor", "block"],
    shortText: "Reduce this hit’s damage by 4 unless armor is pierced.",
    rulesText: "Reduce this hit’s damage by 4, unless the weapon pierces armor.",
    flavorText: "Not invincible. Just harder to kill.",
    tags: ["defense", "reaction", "armor"]
  },
  {
    id: "defense_shield_plate",
    name: "Shield Plate",
    type: "defense",
    count: 4,
    timing: "reaction",
    target: "self",
    rarity: "common",
    supplyCost: 2,
    isReaction: true,
    icons: ["reaction", "block"],
    shortText: "Halve this hit’s damage, rounding down.",
    rulesText: "Halve this hit’s damage to you, rounding down.",
    flavorText: "Consider this a barrier to communication.",
    tags: ["defense", "reaction", "block"]
  },
  {
    id: "defense_dodge",
    name: "Dodge",
    type: "defense",
    count: 2,
    timing: "reaction",
    target: "self",
    rarity: "rare",
    supplyCost: 3,
    isReaction: true,
    icons: ["reaction", "cancel"],
    shortText: "Cancel this hit’s damage to you.",
    rulesText: "Cancel this hit’s damage to you. Grenade splash still hits other players.",
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
    shortText: "Take this hit, then deal 3 damage to the attacker.",
    rulesText: "Take this hit’s damage, then deal 3 damage to the attacker.",
    flavorText: "One good hit deserves another.",
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
    shortText: "Cancel this hit; prevent direct targeting until your next turn.",
    rulesText: "Cancel this hit’s damage to you. Until your next turn, attacks and targeted abilities cannot choose you. Splash, events, and Ricochet still affect you.",
    flavorText: "Nothing to see. That’s the point.",
    tags: ["defense", "reaction", "cancel", "stealth"]
  },
  {
    id: "defense_decoy",
    name: "Ricochet",
    type: "defense",
    count: 2,
    timing: "reaction",
    target: "onePlayer",
    rarity: "uncommon",
    supplyCost: 2,
    isReaction: true,
    icons: ["reaction", "redirect"],
    shortText: "Redirect this hit to another opponent, or the attacker if no other is available.",
    rulesText: "Redirect this hit to another opponent, or back to the attacker if no other is available. Smoke offers no protection. No further Ricochets.",
    flavorText: "A sharp turn for the worse.",
    tags: ["defense", "reaction", "redirect"]
  },
  {
    id: "defense_backfire",
    name: "Backfire",
    type: "defense",
    count: 2,
    timing: "reaction",
    target: "self",
    rarity: "uncommon",
    supplyCost: 2,
    isReaction: true,
    icons: ["reaction", "damage", "cancel"],
    shortText: "Cancel this hit; deal that damage to the attacker.",
    rulesText: "Cancel this hit’s damage to you. Deal that much damage to the attacker.",
    flavorText: "That blew up in your face. Literally.",
    tags: ["defense", "reaction", "retaliation", "cancel"]
  },
  {
    id: "defense_brace",
    name: "Brace",
    type: "defense",
    count: 2,
    timing: "reaction",
    target: "self",
    rarity: "common",
    block: 2,
    supplyCost: 2,
    isReaction: true,
    icons: ["reaction", "block"],
    shortText: "Block 2 damage from this hit.",
    rulesText: "Block 2 damage from this hit.",
    flavorText: "Brace for impact. This part hurts.",
    tags: ["defense", "reaction", "block"]
  },
  {
    id: "defense_fake_death",
    name: "Revive",
    type: "defense",
    count: 1,
    timing: "lethal",
    target: "self",
    rarity: "rare",
    supplyCost: 3,
    isLethalDefense: true,
    icons: ["lethal", "survive"],
    shortText: "Survive at 1 health, use your healing cards, discard the rest.",
    rulesText: "When another player’s attack would eliminate you, survive at 1 health. Use all healing cards in your hand, then discard the rest.",
    flavorText: "Not dead. Just dramatically injured.",
    tags: ["defense", "lethal", "survival"]
  },

  // Abilities — 21 cards
  {
    id: "ability_ambush",
    name: "Ambush",
    type: "ability",
    count: 2,
    timing: "action",
    target: "self",
    rarity: "common",
    damage: 3,
    supplyCost: 2,
    icons: ["damage", "buff"],
    shortText: "Your next attack this turn deals +3 damage.",
    rulesText: "Your next attack this turn deals +3 damage.",
    flavorText: "I was hoping you’d come around.",
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
    shortText: "Target discards their highest-damage weapon.",
    rulesText: "Choose one player. They discard their highest-damage weapon.",
    flavorText: "You had a handle on this. Had.",
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
    shortText: "Choose 1 card from another player.",
    rulesText: "Choose one player. Pick 1 card from their hand and take it.",
    flavorText: "Consider it an involuntary donation.",
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
    flavorText: "One of these has to be useful.",
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
    shortText: "Your next weapon stays in your hand after use.",
    rulesText: "Keep your next weapon played this turn instead of discarding it after use.",
    flavorText: "I wasn’t finished making my point.",
    tags: ["ability", "weapon-support", "reload"]
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
    shortText: "Target discards 2 cards of their choice, or all if fewer.",
    rulesText: "Choose one player. They discard 2 cards of their choice, or their whole hand if fewer.",
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
    shortText: "Anyone attacking target deals +1 this round.",
    rulesText: "Choose one player. Attacks against them deal +1 damage until the round ends.",
    flavorText: "Stand out. Fall first.",
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
    rulesText: "Choose one player. Until your next turn, they must discard 1 other card before a single-target weapon attack against you. Pay once for SMG. Minigun is exempt.",
    flavorText: "A little fear goes a long way.",
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
    shortText: "Gain 1 net action this turn, then lose 2 health.",
    rulesText: "Gain 1 net action this turn, then lose 2 health.",
    flavorText: "Move now. Pay later.",
    tags: ["ability", "extra-action", "risk"]
  },

  // Healing — 9 cards
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
    rulesText: "Heal 3 health, up to your maximum.",
    flavorText: "A temporary fix for a permanent concern.",
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
    shortText: "Heal 6. Costs 2 actions.",
    rulesText: "Spend 2 actions to heal 6 health, up to your maximum.",
    flavorText: "Health restored. Schedule ruined.",
    tags: ["healing", "large-heal", "two-actions"]
  },
  {
    id: "healing_painkillers",
    name: "Painkillers",
    type: "healing",
    count: 1,
    timing: "action",
    target: "self",
    rarity: "common",
    heal: 2,
    draw: 1,
    supplyCost: 1,
    icons: ["heal", "draw"],
    shortText: "Heal 2 and draw 1 card.",
    rulesText: "Heal 2 health, up to your maximum. Draw 1 card.",
    flavorText: "Take the edge off. Keep the attitude.",
    tags: ["healing", "draw"]
  },
  {
    id: "healing_field_dressing",
    name: "Field Dressing",
    type: "healing",
    count: 1,
    timing: "action",
    target: "self",
    rarity: "common",
    heal: 4,
    supplyCost: 1,
    icons: ["heal"],
    shortText: "Heal 4.",
    rulesText: "Heal 4 health, up to your maximum.",
    flavorText: "Apply pressure to yourself and the enemy.",
    tags: ["healing", "basic"]
  }
];

export const eventDeckCards: Card[] = [
  // Events — 16 cards
  {
    id: "event_pressure_zone",
    name: "Pressure Zone",
    type: "event",
    count: 2,
    timing: "immediate",
    target: "allPlayers",
    rarity: "common",
    icons: ["collapse", "attack"],
    shortText: "All players take 1 damage.",
    rulesText: "All living players take 1 damage.",
    flavorText: "The atmosphere has become openly hostile.",
    tags: ["event", "collapse", "pressure"]
  },
  {
    id: "event_supply_drop",
    name: "Supply Drop",
    type: "event",
    count: 2,
    timing: "immediate",
    target: "self",
    rarity: "uncommon",
    icons: ["draw", "supply"],
    shortText: "Draw 3 cards.",
    rulesText: "Draw 3 cards.",
    flavorText: "Special delivery.",
    tags: ["event", "supply", "card-gain"]
  },
  {
    id: "event_bounty",
    name: "Bounty",
    type: "event",
    count: 2,
    timing: "immediate",
    target: "onePlayer",
    rarity: "common",
    icons: ["mark", "draw"],
    shortText: "Highest-health player takes 2 damage.",
    rulesText: "The highest-health living player or players, if tied, takes 2 damage.",
    flavorText: "Healthy competition just got personal.",
    tags: ["event", "bounty", "catch-up"]
  },
  {
    id: "event_high_ground",
    name: "Scavenge",
    type: "event",
    count: 2,
    timing: "immediate",
    target: "allPlayers",
    rarity: "common",
    draw: 1,
    icons: ["draw", "supply"],
    shortText: "Each living player draws 1 card.",
    rulesText: "Each living player draws 1 card. Each may exceed their hand limit until their turn ends.",
    flavorText: "Finders keepers.",
    tags: ["event", "draw", "tempo"]
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
    rulesText: "Each player discards 1 weapon of their choice. Anyone unable to do so takes 3 damage.",
    flavorText: "Click. The shortest horror story.",
    tags: ["event", "weapon-pressure", "damage"]
  },
  {
    id: "event_no_cover",
    name: "No Cover",
    type: "event",
    count: 2,
    timing: "immediate",
    target: "allPlayers",
    rarity: "common",
    icons: ["defense-down", "reaction"],
    shortText: "Discard a defense or take 2 damage.",
    rulesText: "Each player discards 1 defense card of their choice. Anyone unable to do so takes 2 damage.",
    flavorText: "So much for staying out of sight.",
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
    rulesText: "Players with 5–10 health take 1 damage. Players below 5 health take 2 damage.",
    flavorText: "Bad shape. Worse timing.",
    tags: ["event", "low-health", "pressure"]
  },
  {
    id: "event_black_market",
    name: "Black Market",
    type: "event",
    count: 2,
    timing: "immediate",
    target: "self",
    rarity: "uncommon",
    discard: 2,
    icons: ["search", "discard", "action"],
    shortText: "You may make a market trade.",
    rulesText: "You may exchange once using the table’s Black Market configuration. Discard unkept cards.",
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
