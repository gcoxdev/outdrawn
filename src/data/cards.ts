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
    rulesText: "Deal 6 damage to one player, then discard this card.",
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
    flavorText: "Quiet work pays extra.",
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
    rulesText: "Deal 4 damage to one target. Deal 2 splash damage to the living players before and after the target in seating order. Attacker is immune.",
    flavorText: "Nobody is standing far enough away.",
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
    shortText: "Deal 4 damage. Penetrates Armor Vest.",
    rulesText: "Deal 4 damage to one player. This weapon penetrates Armor Vest.",
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
    rulesText: "Deal 2 damage twice to the same player. Each hit resolves separately.",
    flavorText: "Accuracy by volume.",
    tags: ["weapon", "multi-hit", "single-target"]
  },
  {
    id: "weapon_minigun",
    name: "Minigun",
    type: "weapon",
    count: 2,
    timing: "action",
    target: "allPlayers",
    rarity: "rare",
    damage: 2,
    maxTargets: 6,
    supplyCost: 3,
    icons: ["damage", "spray"],
    shortText: "Deal 2 damage to up to 6 opponents.",
    rulesText: "Deal 2 damage to up to 6 opponents in seating order.",
    flavorText: "Nobody gets to ignore that sound.",
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
    block: 2,
    supplyCost: 2,
    isReaction: true,
    icons: ["armor", "block"],
    shortText: "Reduce incoming damage by 2.",
    rulesText: "Reduce incoming attack damage by 2 unless the weapon penetrates armor.",
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
    block: 4,
    supplyCost: 2,
    isReaction: true,
    icons: ["reaction", "block"],
    shortText: "Block 4 damage from one attack.",
    rulesText: "Block 4 damage from one attack.",
    flavorText: "A few seconds can save a life.",
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
    shortText: "Cancel damage to yourself from one attack.",
    rulesText: "Cancel damage to yourself from one attack. Grenade splash still resolves against other players.",
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
    shortText: "After taking damage, deal 3 back.",
    rulesText: "After taking attack damage, deal 3 damage back to the attacker.",
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
    shortText: "Cancel damage and become untargetable.",
    rulesText: "Cancel damage to yourself from one attack. Until your next turn, attacks and targeted abilities cannot choose you. Splash and event damage still affect you.",
    flavorText: "A cloud of smoke can be a wall.",
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
    shortText: "Redirect an attack to another player.",
    rulesText: "Redirect an attack targeting you to another valid player other than the attacker.",
    flavorText: "Wrong angle. Worse outcome.",
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
    shortText: "Cancel damage; attacker takes that damage.",
    rulesText: "Cancel incoming attack damage to yourself. The attacker takes the same amount of damage they tried to deal.",
    flavorText: "Bad shot. Worse timing.",
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
    supplyCost: 2,
    isReaction: true,
    icons: ["reaction", "block"],
    shortText: "Reduce damage by half.",
    rulesText: "Reduce damage from one attack by half, rounded down.",
    flavorText: "Take the hit on your terms.",
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
    shortText: "Survive at 1 HP. Consume healing cards.",
    rulesText: "When another player's attack would eliminate you, survive at 1 health. Apply all available healing cards, then discard the rest.",
    flavorText: "The body count was off by one.",
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
    shortText: "Target discards their highest-damage weapon.",
    rulesText: "Choose one player. They discard their highest-damage weapon from hand.",
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
    shortText: "Choose 1 card from another player.",
    rulesText: "Choose one player. Pick 1 card from their hand and take it.",
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
    shortText: "Your next weapon stays in your hand after use.",
    rulesText: "Your next weapon attack this turn stays in your hand instead of being discarded after it resolves.",
    flavorText: "The empty click was only a pause.",
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
    shortText: "Target discards up to 2 cards of their choice.",
    rulesText: "Choose one player. They discard up to 2 cards of their choice. If they have fewer than 2 cards, they discard what they have.",
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
    rulesText: "Choose one player. Any attack against that player deals +1 damage until the end of the round.",
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
    shortText: "Heal 6. Costs 2 actions.",
    rulesText: "Heal 6 health. This costs 2 actions. You cannot exceed your maximum health.",
    flavorText: "A full stop in the middle of a war.",
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
    rulesText: "Heal 2 health and draw 1 card. You cannot exceed your maximum health.",
    flavorText: "Pain is information. Ignore it briefly.",
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
    rulesText: "Heal 4 health. You cannot exceed your maximum health.",
    flavorText: "Fast hands and clean pressure.",
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
    flavorText: "The safe path disappeared first.",
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
    rulesText: "Draw 3 cards. You may exceed max hand size during play, but must discard down before ending your turn.",
    flavorText: "Falling crates make rising tensions.",
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
    rulesText: "The highest-health living player takes 2 damage. If tied, each tied highest-health player takes 2 damage.",
    flavorText: "The leader is never hard to find.",
    tags: ["event", "bounty", "catch-up"]
  },
  {
    id: "event_high_ground",
    name: "High Ground",
    type: "event",
    count: 2,
    timing: "immediate",
    target: "allPlayers",
    rarity: "common",
    damage: 1,
    icons: ["damage", "first-attack"],
    shortText: "Each living player draws 1 card.",
    rulesText: "Each living player draws 1 card. Players may exceed max hand size during play, but must discard down before ending their turns.",
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
    rulesText: "Each player chooses one weapon from hand to discard. Players who cannot discard a weapon take 3 damage.",
    flavorText: "The loudest guns run dry first.",
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
    rulesText: "Each player chooses one defense card from hand to discard. Players who cannot discard a defense card take 2 damage.",
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
    timing: "immediate",
    target: "allPlayers",
    rarity: "uncommon",
    discard: 2,
    icons: ["search", "discard", "action"],
    shortText: "You may make a market trade.",
    rulesText: "You may make the configured Black Market exchange once. Event cards revealed for market inventory are discarded and replaced. Unkept revealed cards are discarded.",
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
