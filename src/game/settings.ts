import { blackMarketPresets, defaultGameSettings, type GameSettings } from "../data/constants";

function integer(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.trunc(value))) : fallback;
}

export function normalizeSettings(input: Partial<GameSettings>): GameSettings {
  const defaults = defaultGameSettings;
  const settings = { ...defaults, ...input };
  const custom = { ...defaults.blackMarketCustom, ...input.blackMarketCustom };
  const startingHealth = integer(settings.startingHealth, defaults.startingHealth, 1, 100);
  const startingHandSize = integer(settings.startingHandSize, defaults.startingHandSize, 1, 15);
  const revealCount = integer(custom.revealCount, 3, 1, 10);
  return {
    ...settings,
    startingHealth,
    maxHealth: Math.max(startingHealth, integer(settings.maxHealth, defaults.maxHealth, 1, 100)),
    startingHandSize,
    maxHandSize: Math.max(startingHandSize, integer(settings.maxHandSize, defaults.maxHandSize, 1, 20)),
    actionsPerTurn: integer(settings.actionsPerTurn, defaults.actionsPerTurn, 1, 6),
    freeDrawsPerTurn: integer(settings.freeDrawsPerTurn, 0, 0, 10),
    eliminationHealthReward: integer(settings.eliminationHealthReward, 0, 0, 20),
    turnOrder: settings.turnOrder === "roundRobin" ? "roundRobin" : "standard",
    blackMarketPreset: Object.hasOwn(blackMarketPresets, settings.blackMarketPreset) ? settings.blackMarketPreset : "standard",
    blackMarketCustom: {
      actionCost: 0,
      discardCost: integer(custom.discardCost, 1, 0, 6),
      healthCost: integer(custom.healthCost, 0, 0, 20),
      revealCount,
      keepCount: integer(custom.keepCount, 1, 1, revealCount)
    },
    allowSecondaryDefense: settings.allowSecondaryDefense === true,
    allowTeamHealing: settings.allowTeamHealing !== false,
    allowTeamCardTransfer: settings.allowTeamCardTransfer !== false,
    debugHandSnapshots: settings.debugHandSnapshots === true,
    passDeviceMode: settings.passDeviceMode === true
  };
}
