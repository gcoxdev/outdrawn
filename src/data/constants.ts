export const STARTING_HEALTH = 20;
export const MAX_HEALTH = 20;
export const STARTING_HAND_SIZE = 5;
export const MAX_HAND_SIZE = 7;
export const ACTIONS_PER_TURN = 2;

export type GameSettings = {
  startingHealth: number;
  maxHealth: number;
  startingHandSize: number;
  maxHandSize: number;
  actionsPerTurn: number;
  debugHandSnapshots: boolean;
  passDeviceMode: boolean;
};

export const defaultGameSettings: GameSettings = {
  startingHealth: STARTING_HEALTH,
  maxHealth: MAX_HEALTH,
  startingHandSize: STARTING_HAND_SIZE,
  maxHandSize: MAX_HAND_SIZE,
  actionsPerTurn: ACTIONS_PER_TURN,
  debugHandSnapshots: false,
  passDeviceMode: false
};
