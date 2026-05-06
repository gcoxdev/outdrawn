export const STARTING_HEALTH = 20;
export const MAX_HEALTH = 20;
export const STARTING_HAND_SIZE = 5;
export const MAX_HAND_SIZE = 7;
export const ACTIONS_PER_TURN = 2;
export const OPENING_DAMAGE_CAP_ROUNDS = 2;
export const OPENING_DAMAGE_CAP = 6;

export type GameSettings = {
  startingHealth: number;
  maxHealth: number;
  startingHandSize: number;
  maxHandSize: number;
  actionsPerTurn: number;
  openingDamageCapRounds: number;
  openingDamageCap: number;
  debugHandSnapshots: boolean;
  passDeviceMode: boolean;
};

export const defaultGameSettings: GameSettings = {
  startingHealth: STARTING_HEALTH,
  maxHealth: MAX_HEALTH,
  startingHandSize: STARTING_HAND_SIZE,
  maxHandSize: MAX_HAND_SIZE,
  actionsPerTurn: ACTIONS_PER_TURN,
  openingDamageCapRounds: OPENING_DAMAGE_CAP_ROUNDS,
  openingDamageCap: OPENING_DAMAGE_CAP,
  debugHandSnapshots: false,
  passDeviceMode: false
};
