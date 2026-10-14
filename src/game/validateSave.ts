import { allCards } from "../data/cards";
import { normalizeSettings } from "./settings";
import type { GameState } from "./types";

const definitions = new Map(allCards.map(card => [card.id, card]));
function requireValue(valid: unknown): asserts valid { if (!valid) throw new Error("Invalid saved match structure"); }
function object(value: unknown): asserts value is Record<string, any> { requireValue(value && typeof value === "object" && !Array.isArray(value)); }
function text(value: unknown): asserts value is string { requireValue(typeof value === "string" && value.length > 0 && value.length <= 10000); }
function number(value: unknown, min = 0, max = 1_000_000): asserts value is number { requireValue(Number.isInteger(value) && Number(value) >= min && Number(value) <= max); }
function boolean(value: unknown) { requireValue(typeof value === "boolean"); }
function array(value: unknown, check: (item: any) => void, max = 10000): asserts value is any[] {
  requireValue(Array.isArray(value) && value.length <= max); value.forEach(check);
}
function card(value: unknown) { object(value); text(value.instanceId); requireValue(definitions.has(value.definitionId)); }
function cards(value: unknown) { array(value, card); }

/** Validate before rendering: JSON types, references, pending choices and ownership. */
export function validateSavedGame(value: unknown): asserts value is GameState {
  object(value);
  requireValue(value.phase === "action" || value.phase === "gameOver");
  object(value.settings);
  const normalized = normalizeSettings(value.settings);
  for (const key of Object.keys(normalized)) {
    requireValue(key === "blackMarketCustom" ? Object.entries(normalized.blackMarketCustom).every(([field, expected]) => value.settings.blackMarketCustom?.[field] === expected) : value.settings[key] === normalized[key as keyof typeof normalized]);
  }
  number(value.round, 1);
  array(value.players, player => {
    object(player); text(player.id); text(player.name); object(player.controller);
    requireValue(player.controller.type === "human" || (player.controller.type === "computer" && ["beginner", "novice", "competent", "expert", "master"].includes(player.controller.strategy)));
    if (player.teamId !== undefined) text(player.teamId);
    number(player.health, 0, value.settings.maxHealth); cards(player.hand);
    for (const key of ["eliminated", "attackedThisRound", "actedThisRound"]) boolean(player[key]);
    for (const key of ["eliminations", "actionsRemaining", "freeDrawsRemaining"]) number(player[key]);
    requireValue(player.eliminated === (player.health === 0));
    requireValue(!player.eliminated || player.hand.length === 0);
  }, 100);
  requireValue(value.players.length >= 3);
  const ids = new Set<string>(value.players.map(player => player.id));
  requireValue(ids.size === value.players.length);
  const playerId = (id: unknown) => requireValue(typeof id === "string" && ids.has(id));
  const playerIds = (list: unknown) => array(list, playerId, 100);
  const nullableId = (id: unknown) => { if (id !== null) playerId(id); };
  number(value.currentPlayerIndex, 0, value.players.length - 1); number(value.firstPlayerIndex, 0, value.players.length - 1);
  for (const key of ["mainDeck", "eventDeck", "discardPile", "eventDiscardPile"]) cards(value[key]);
  if (value.deckRandomState !== undefined) number(value.deckRandomState, 0, 0xffffffff);
  for (const key of ["reloadPlayerIds", "smokeProtectedPlayerIds"]) playerIds(value[key]);
  for (const key of ["attackBonuses", "markedTargets", "intimidations"]) {
    object(value[key]); for (const [id, amount] of Object.entries(value[key])) { playerId(id); if (key === "intimidations") playerIds(amount); else number(amount); }
  }
  if (value.outcome !== undefined) { object(value.outcome); requireValue(["survivor", "team", "tiebreak", "tie"].includes(value.outcome.kind)); text(value.outcome.description); }
  nullableId(value.winnerId);
  requireValue(value.winnerTeamId === null || value.players.some(player => player.teamId === value.winnerTeamId));
  requireValue(value.selectedCardId === null || value.players.some(player => player.hand.some((c: any) => c.instanceId === value.selectedCardId)));
  const optional = (key: string, check: (item: any) => void) => { if (value[key] !== undefined) check(value[key]); };
  const pending = (key: string, check: (item: any) => void) => { if (value[key] !== null) { object(value[key]); check(value[key]); } };
  const event = (p: any) => { object(p); card(p.card); requireValue(definitions.get(p.card.definitionId)?.type === "event"); playerId(p.playerId); };
  const attack = (p: any) => { object(p); playerId(p.attackerId); playerId(p.defenderId); card(p.weapon); requireValue(definitions.get(p.weapon.definitionId)?.type === "weapon"); number(p.baseDamage); };
  const secondary = (p: any) => { attack(p); requireValue(["splash", "ricochet", "minigun", "counterattack", "backfire"].includes(p.source)); };
  pending("activeEvent", p => { card(p.card); requireValue(["thisRound", "ongoing"].includes(p.timing)); if (p.sourcePlayerId !== undefined) playerId(p.sourcePlayerId); if (p.exemptPlayerIds !== undefined) playerIds(p.exemptPlayerIds); });
  pending("pendingEventDialog", event); optional("eventDialogQueue", v => array(v, event));
  optional("resolvedEventCount", v => number(v));
  pending("pendingReaction", attack);
  pending("pendingRedirect", p => { attack(p); card(p.decoy); });
  pending("pendingSecondaryDamage", p => { secondary(p); array(p.remaining, secondary); });
  pending("pendingAttackCost", p => {
    playerId(p.attackerId); playerId(p.targetPlayerId); playerId(p.sourcePlayerId); text(p.weaponInstanceId);
    requireValue(value.players.find((player: any) => player.id === p.attackerId).hand.some((c: any) => c.instanceId === p.weaponInstanceId));
  });
  pending("pendingMultiHitAttack", p => { playerId(p.attackerId); playerId(p.defenderId); card(p.weapon); number(p.hitsRemaining, 0, 2); number(p.hitDamage); });
  pending("pendingDiscard", p => {
    playerId(p.sourcePlayerId); playerId(p.playerId); number(p.count); text(p.reason);
    if (p.allowedCardInstanceIds !== undefined) array(p.allowedCardInstanceIds, id => { text(id); requireValue(value.players.find((player: any) => player.id === p.playerId).hand.some((c: any) => c.instanceId === id)); });
    requireValue(p.count <= (p.allowedCardInstanceIds?.length ?? value.players.find((player: any) => player.id === p.playerId).hand.length));
    if (p.continuation !== undefined) { object(p.continuation); requireValue(p.continuation.type === "forced_discard"); playerIds(p.continuation.remainingPlayerIds); requireValue(["weapon", "defense", "ability", "healing", "event"].includes(p.continuation.cardType)); text(p.continuation.reason); }
  });
  pending("pendingSearch", p => { playerId(p.playerId); cards(p.cards); requireValue(p.cards.length > 0); });
  pending("pendingMarketSearch", p => { playerId(p.playerId); cards(p.cards); number(p.keepCount, 0, p.cards.length); });
  pending("pendingSupplyDrop", p => { playerIds(p.playerOrder); number(p.currentIndex, 0, p.playerOrder.length - 1); cards(p.revealedCards); });
  pending("pendingBlackMarket", event);
  pending("pendingSteal", p => { playerId(p.playerId); playerId(p.targetPlayerId); });
  optional("drawContinuations", v => array(v, p => {
    object(p); playerId(p.playerId); number(p.remaining); cards(p.cards); boolean(p.replaceEvents);
    requireValue(p.destination === "hand" || p.destination === "search");
    if (p.spendDraw !== undefined) boolean(p.spendDraw); if (p.playedCard !== undefined) card(p.playedCard);
  }));
  array(value.log, entry => {
    object(entry); text(entry.id); number(entry.round); text(entry.message);
    for (const key of ["handSnapshots", "debugHandSnapshots"]) array(entry[key], snapshot => { object(snapshot); playerId(snapshot.playerId); text(snapshot.playerName); number(snapshot.health); cards(snapshot.cards); }, 100);
    if (entry.participantIds !== undefined) playerIds(entry.participantIds);
  }, 1000);
  requireValue(new Set(value.log.map(entry => entry.id)).size === value.log.length);
  const owned = [...value.mainDeck, ...value.eventDeck, ...value.discardPile, ...value.eventDiscardPile, ...value.players.flatMap(p => p.hand),
    ...(value.activeEvent ? [value.activeEvent.card] : []), ...(value.pendingSearch?.cards ?? []), ...(value.pendingMarketSearch?.cards ?? []), ...(value.pendingSupplyDrop?.revealedCards ?? []),
    ...(value.drawContinuations ?? []).flatMap((p: any) => [...p.cards, ...(p.playedCard ? [p.playedCard] : [])])];
  const ownedDefinitions = new Map(owned.map(c => [c.instanceId, c.definitionId]));
  requireValue(ownedDefinitions.size === owned.length);
  const reference = (c: any) => requireValue(ownedDefinitions.get(c.instanceId) === c.definitionId);
  for (const key of ["pendingReaction", "pendingRedirect", "pendingMultiHitAttack", "pendingSecondaryDamage"]) if (value[key]) reference(value[key].weapon);
  if (value.pendingRedirect) reference(value.pendingRedirect.decoy);
  value.pendingSecondaryDamage?.remaining.forEach((item: any) => reference(item.weapon));
}
