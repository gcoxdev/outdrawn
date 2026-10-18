export const STARTING_HEALTH = 20;
export const MAX_HEALTH = 20;
export const STARTING_HAND_SIZE = 5;
export const MAX_HAND_SIZE = 7;
export const ACTIONS_PER_TURN = 2;
export const FREE_DRAWS_PER_TURN = 0;

export type TurnOrderMode = "standard" | "roundRobin";
export type BlackMarketPreset = "standard" | "discount" | "bigger" | "healthPay" | "custom";

export type BlackMarketConfig = {
  discardCost: number;
  healthCost: number;
  revealCount: number;
  keepCount: number;
};

export type GameSettings = {
  startingHealth: number;
  maxHealth: number;
  startingHandSize: number;
  maxHandSize: number;
  actionsPerTurn: number;
  freeDrawsPerTurn: number;
  turnOrder: TurnOrderMode;
  eliminationHealthReward: number;
  allowSecondaryDefense: boolean;
  allowTeamHealing: boolean;
  allowTeamCardTransfer: boolean;
  blackMarketPreset: BlackMarketPreset;
  blackMarketCustom: BlackMarketConfig;
  debugHandSnapshots: boolean;
  passDeviceMode: boolean;
};

export const blackMarketPresets: Record<BlackMarketPreset, BlackMarketConfig> = {
  standard: { discardCost: 2, healthCost: 0, revealCount: 3, keepCount: 1 },
  discount: { discardCost: 1, healthCost: 0, revealCount: 3, keepCount: 1 },
  bigger: { discardCost: 2, healthCost: 0, revealCount: 5, keepCount: 2 },
  healthPay: { discardCost: 0, healthCost: 2, revealCount: 3, keepCount: 1 },
  custom: { discardCost: 1, healthCost: 0, revealCount: 3, keepCount: 1 }
};

export const defaultGameSettings: GameSettings = {
  startingHealth: STARTING_HEALTH,
  maxHealth: MAX_HEALTH,
  startingHandSize: STARTING_HAND_SIZE,
  maxHandSize: MAX_HAND_SIZE,
  actionsPerTurn: ACTIONS_PER_TURN,
  freeDrawsPerTurn: FREE_DRAWS_PER_TURN,
  turnOrder: "roundRobin",
  eliminationHealthReward: 0,
  allowSecondaryDefense: false,
  allowTeamHealing: true,
  allowTeamCardTransfer: true,
  blackMarketPreset: "standard",
  blackMarketCustom: blackMarketPresets.custom,
  debugHandSnapshots: false,
  passDeviceMode: false
};
