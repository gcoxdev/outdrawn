export const STARTING_HEALTH = 20;
export const MAX_HEALTH = 20;
export const STARTING_HAND_SIZE = 5;
export const MAX_HAND_SIZE = 7;
export const ACTIONS_PER_TURN = 2;

export type TurnOrderMode = "standard" | "roundRobin";
export type BlackMarketPreset = "standard" | "discount" | "noAction" | "bigger" | "healthPay" | "custom";

export type BlackMarketConfig = {
  actionCost: number;
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
  turnOrder: TurnOrderMode;
  eliminationHealthReward: number;
  allowSecondaryDefense: boolean;
  blackMarketPreset: BlackMarketPreset;
  blackMarketCustom: BlackMarketConfig;
  debugHandSnapshots: boolean;
  passDeviceMode: boolean;
};

export const blackMarketPresets: Record<BlackMarketPreset, BlackMarketConfig> = {
  standard: { actionCost: 1, discardCost: 2, healthCost: 0, revealCount: 3, keepCount: 1 },
  discount: { actionCost: 1, discardCost: 1, healthCost: 0, revealCount: 3, keepCount: 1 },
  noAction: { actionCost: 0, discardCost: 2, healthCost: 0, revealCount: 3, keepCount: 1 },
  bigger: { actionCost: 1, discardCost: 2, healthCost: 0, revealCount: 5, keepCount: 2 },
  healthPay: { actionCost: 1, discardCost: 0, healthCost: 2, revealCount: 3, keepCount: 1 },
  custom: { actionCost: 1, discardCost: 1, healthCost: 0, revealCount: 3, keepCount: 1 }
};

export const defaultGameSettings: GameSettings = {
  startingHealth: STARTING_HEALTH,
  maxHealth: MAX_HEALTH,
  startingHandSize: STARTING_HAND_SIZE,
  maxHandSize: MAX_HAND_SIZE,
  actionsPerTurn: ACTIONS_PER_TURN,
  turnOrder: "standard",
  eliminationHealthReward: 0,
  allowSecondaryDefense: false,
  blackMarketPreset: "standard",
  blackMarketCustom: blackMarketPresets.custom,
  debugHandSnapshots: false,
  passDeviceMode: false
};
