import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { allCards } from "../data/cards";
import { blackMarketPresets } from "../data/constants";
import type { GameAction } from "../game/actions";
import { getPassDeviceContext } from "../game/privacy";
import { getCurrentPlayer, getTeamMembers, isHostileTarget, labelTeam } from "../game/rules";
import { getDecisionPlayerId } from "../game/simulator";
import type { CardInstance, GameState, PlayerId } from "../game/types";
import { ActionPanel } from "./ActionPanel";
import { CardBack, CardView } from "./CardView";
import { GameLog } from "./GameLog";
import { GameMenu } from "./GameMenu";
import { PlayerRoster } from "./PlayerRoster";
import { WinnerModal } from "./WinnerModal";

function definitionFor(card: CardInstance | null) {
  return card ? allCards.find((definition) => definition.id === card.definitionId) : undefined;
}

type GameTableProps = {
  state: GameState;
  dispatch: (action: GameAction) => void;
};

type MobileTab = "play" | "players" | "log";

export function GameTable({ state, dispatch }: GameTableProps) {
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>("play");
  const [lastRevealedHumanId, setLastRevealedHumanId] = useState<PlayerId | null>(null);
  const [sidebarPlayerPercent, setSidebarPlayerPercent] = useState(62);
  const [handViewerId, setHandViewerId] = useState<PlayerId | null>(null);
  const [hiddenHandPlayerIds, setHiddenHandPlayerIds] = useState<Set<PlayerId>>(() => new Set());
  const [selectedDiscardIds, setSelectedDiscardIds] = useState<string[]>([]);
  const currentPlayer = getCurrentPlayer(state);
  const decisionPlayerId = getDecisionPlayerId(state);
  const passDeviceContext = getPassDeviceContext(state, lastRevealedHumanId);
  const displayPlayer =
    state.players.find((player) => player.id === state.pendingReaction?.defenderId) ??
    state.players.find((player) => player.id === state.pendingRedirect?.defenderId) ??
    state.players.find((player) => player.id === state.pendingSecondaryDamage?.defenderId) ??
    state.players.find((player) => player.id === state.pendingAttackCost?.attackerId) ??
    state.players.find((player) => player.id === state.pendingDiscard?.playerId) ??
    state.players.find((player) => player.id === state.pendingSearch?.playerId) ??
    state.players.find((player) => player.id === state.pendingSupplyDrop?.playerOrder[state.pendingSupplyDrop.currentIndex]) ??
    state.players.find((player) => player.id === state.pendingMarketSearch?.playerId) ??
    state.players.find((player) => player.id === state.pendingBlackMarket?.playerOrder[state.pendingBlackMarket.currentIndex]) ??
    state.players.find((player) => player.id === state.pendingSteal?.playerId) ??
    currentPlayer;
  const selectedCard = displayPlayer.hand.find((card) => card.instanceId === state.selectedCardId) ?? null;
  const hasPendingDecision =
    Boolean(
      state.pendingReaction ||
        state.pendingRedirect ||
        state.pendingSecondaryDamage ||
        state.pendingAttackCost ||
        state.pendingDiscard ||
        state.pendingSearch ||
        state.pendingSupplyDrop ||
        state.pendingMarketSearch ||
        state.pendingBlackMarket ||
        state.pendingSteal
    );
  const teamHandViewers =
    displayPlayer.teamId && !hasPendingDecision
      ? getTeamMembers(state, displayPlayer.teamId).filter((player) => !player.eliminated)
      : [];
  const handDisplayPlayer =
    teamHandViewers.find((player) => player.id === handViewerId) ?? displayPlayer;
  const isComputerDecision = displayPlayer.controller.type === "computer" && displayPlayer.id === decisionPlayerId;
  const privacyGateActive = Boolean(passDeviceContext);
  const shouldRevealDisplayHand = canRevealTableHand(state, displayPlayer, handDisplayPlayer, privacyGateActive);
  const canToggleDisplayHandPrivacy = canToggleHandPrivacy(state, displayPlayer, handDisplayPlayer, privacyGateActive);
  const isHandManuallyHidden = hiddenHandPlayerIds.has(handDisplayPlayer.id);
  const shouldShowDisplayHand = shouldRevealDisplayHand && !isHandManuallyHidden;
  const canSelectDisplayHand =
    shouldShowDisplayHand &&
    handDisplayPlayer.id === displayPlayer.id &&
    displayPlayer.controller.type === "human" &&
    !isComputerDecision &&
    !privacyGateActive &&
    state.phase !== "gameOver";
  const handDiscardRequirement = getHandDiscardRequirement(state, currentPlayer, handDisplayPlayer);
  const playableReactionCardIds = getPlayableReactionCardIds(state, handDisplayPlayer);
  const selectedDiscardCards = handDisplayPlayer.hand.filter((card) => selectedDiscardIds.includes(card.instanceId));
  const selectedDefinition = canSelectDisplayHand && !handDiscardRequirement ? definitionFor(selectedCard) : undefined;
  const winner = state.players.find((player) => player.id === state.winnerId);
  const decisionText = getDecisionText(state, currentPlayer.name, displayPlayer.name, winner?.name);

  useEffect(() => {
    setActiveMobileTab("play");
  }, [decisionPlayerId]);

  useEffect(() => {
    setHandViewerId(null);
  }, [decisionPlayerId, hasPendingDecision]);

  useEffect(() => {
    setSelectedDiscardIds((current) => current.filter((id) => handDisplayPlayer.hand.some((card) => card.instanceId === id)));
  }, [handDisplayPlayer.id, handDisplayPlayer.hand.length]);

  function startSidebarResize(event: ReactPointerEvent<HTMLDivElement>) {
    const sidebar = event.currentTarget.closest(".operations-sidebar");
    if (!sidebar) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = sidebar.getBoundingClientRect();
    const update = (clientY: number) => {
      const nextPercent = ((clientY - bounds.top) / bounds.height) * 100;
      setSidebarPlayerPercent(Math.min(82, Math.max(28, nextPercent)));
    };

    update(event.clientY);
    const handleMove = (moveEvent: PointerEvent) => update(moveEvent.clientY);
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  return (
    <main className={`game-table mobile-tab-${activeMobileTab}`}>
      {state.pendingEventDialog ? (
        <EventDialog state={state} dispatch={dispatch} />
      ) : state.phase === "gameOver" ? (
        <WinnerModal
          winner={winner}
          winnerTeamId={state.winnerTeamId}
          winnerTeamMembers={state.winnerTeamId ? getTeamMembers(state, state.winnerTeamId) : []}
          dispatch={dispatch}
        />
      ) : null}
      <GameMenu settings={state.settings} dispatch={dispatch} phase={state.phase} />

      <nav className="mobile-board-tabs" aria-label="Board sections">
        {(["play", "players", "log"] as MobileTab[]).map((tab) => (
          <button className={activeMobileTab === tab ? "is-active" : ""} key={tab} type="button" onClick={() => setActiveMobileTab(tab)}>
            {tab}
          </button>
        ))}
        <GameMenu settings={state.settings} dispatch={dispatch} phase={state.phase} variant="mobileIcon" />
      </nav>

      <section className="game-shell">
        <aside
          className="operations-sidebar board-panel board-panel-players"
          style={{ gridTemplateRows: `${sidebarPlayerPercent}fr 8px ${100 - sidebarPlayerPercent}fr` }}
        >
          <div className="sidebar-pane sidebar-pane--players">
            <PlayerRoster
              state={state}
              currentPlayerId={currentPlayer.id}
              decisionPlayerId={decisionPlayerId}
              displayPlayerId={displayPlayer.id}
            />
          </div>
          <div
            className="sidebar-resize-handle"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize player roster and log"
            onPointerDown={startSidebarResize}
          />
          <div className="sidebar-pane sidebar-pane--log board-panel-log">
            <div className="log-panel__meta">
              <span>{state.mainDeck.length} deck</span>
              <span>{state.discardPile.length} discard</span>
            </div>
            <GameLog entries={state.log} players={state.players.map((player) => ({ id: player.id, name: player.name }))} />
          </div>
        </aside>

        <section className="decision-workspace board-panel board-panel-play">
          <header className="decision-strip">
            <div>
              <p className="eyebrow">Round {state.round}</p>
              <h1>{decisionText}</h1>
            </div>
          </header>

          <section className="current-board">
            <div className="board-heading">
              <div>
                <p className="eyebrow">
                  {state.pendingReaction
                    ? "Defender Hand"
                    : state.pendingRedirect
                      ? "Redirecting Hand"
                      : state.pendingSecondaryDamage
                        ? "Secondary Defense"
                        : state.pendingAttackCost
                        ? "Attack Cost"
                        : state.pendingDiscard
                          ? "Discarding Hand"
                          : state.pendingSearch
                            ? "Searching Hand"
                            : state.pendingSupplyDrop
                              ? "Supply Drop"
                              : state.pendingMarketSearch
                                ? "Black Market"
                                : state.pendingBlackMarket
                                  ? "Black Market"
                                  : state.pendingSteal
                                    ? "Stealing"
                                    : "Current Player"}
                </p>
                <h2>{handDisplayPlayer.name}</h2>
              </div>
              <div className="board-heading__health" aria-label={`${handDisplayPlayer.name} has ${handDisplayPlayer.health} health`}>
                <strong>{handDisplayPlayer.health}</strong>
                <span>HP</span>
              </div>
              <div className="board-heading__meta">
                {teamHandViewers.length > 1 && (
                  <label>
                    <span>{displayPlayer.teamId ? labelTeam(displayPlayer.teamId) : "Team"}</span>
                    <select value={handDisplayPlayer.id} onChange={(event) => setHandViewerId(event.target.value)}>
                      {teamHandViewers.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {canToggleDisplayHandPrivacy && (
                  <button
                    aria-label={isHandManuallyHidden ? `Show ${handDisplayPlayer.name}'s hand` : `Hide ${handDisplayPlayer.name}'s hand`}
                    aria-pressed={isHandManuallyHidden}
                    className="hand-privacy-button"
                    title={isHandManuallyHidden ? "Show hand" : "Hide hand"}
                    type="button"
                    onClick={() => {
                      setHiddenHandPlayerIds((current) => {
                        const next = new Set(current);
                        if (next.has(handDisplayPlayer.id)) {
                          next.delete(handDisplayPlayer.id);
                        } else {
                          next.add(handDisplayPlayer.id);
                        }
                        return next;
                      });
                      if (!isHandManuallyHidden && state.selectedCardId) {
                        dispatch({ type: "SELECT_CARD", cardInstanceId: null });
                      }
                    }}
                  >
                    {isHandManuallyHidden ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                )}
              </div>
            </div>
            <div className="hand-rail">
              {shouldShowDisplayHand ? (
                handDisplayPlayer.hand.map((card) => {
                  const definition = definitionFor(card);
                  const canSelectDiscard =
                    !handDiscardRequirement?.allowedCardInstanceIds ||
                    handDiscardRequirement.allowedCardInstanceIds.includes(card.instanceId);
                  const canSelectReaction = !playableReactionCardIds || playableReactionCardIds.includes(card.instanceId);
                  return definition ? (
                    <CardView
                      card={definition}
                      isDisabled={Boolean((handDiscardRequirement && !canSelectDiscard) || (playableReactionCardIds && !canSelectReaction))}
                      isSelected={handDiscardRequirement ? selectedDiscardIds.includes(card.instanceId) : state.selectedCardId === card.instanceId}
                      key={card.instanceId}
                      onClick={
                        canSelectDisplayHand ||
                        (shouldShowDisplayHand &&
                          handDisplayPlayer.controller.type === "human" &&
                          handDiscardRequirement?.playerId === handDisplayPlayer.id)
                          ? () => {
                              if (handDiscardRequirement) {
                                if (!canSelectDiscard) {
                                  return;
                                }

                                dispatch({ type: "SELECT_CARD", cardInstanceId: null });
                                setSelectedDiscardIds((current) => {
                                  if (current.includes(card.instanceId)) {
                                    return current.filter((id) => id !== card.instanceId);
                                  }

                                  return current.length >= handDiscardRequirement.count
                                    ? [...current.slice(1), card.instanceId]
                                    : [...current, card.instanceId];
                                });
                                return;
                              }

                              if (playableReactionCardIds && !canSelectReaction) {
                                return;
                              }

                              setSelectedDiscardIds([]);
                              dispatch({
                                type: "SELECT_CARD",
                                cardInstanceId: state.selectedCardId === card.instanceId ? null : card.instanceId
                              });
                            }
                          : undefined
                      }
                    />
                  ) : null;
                })
              ) : (
                handDisplayPlayer.hand.map((card) => <CardBack key={card.instanceId} />)
              )}
            </div>
          </section>

          <ActionPanel
            state={state}
            currentPlayer={currentPlayer}
            selectedCard={selectedDefinition ? selectedCard : null}
            selectedDiscardCards={selectedDiscardCards}
            discardRequirement={handDiscardRequirement}
            isComputerDecision={isComputerDecision || privacyGateActive}
            dispatch={dispatch}
          />
        </section>
      </section>

      {privacyGateActive && (
        <section className="pass-device-gate" role="dialog" aria-modal="true" aria-label={`Pass device to ${passDeviceContext!.playerName}`}>
          <div className="pass-device-gate__panel">
            <p className="eyebrow">Private turn</p>
            <h2>Pass to {passDeviceContext!.playerName}</h2>
            <p>{passDeviceContext!.reason}</p>
            <p>Cards and actions are hidden until this player is ready.</p>
            <button type="button" onClick={() => setLastRevealedHumanId(passDeviceContext!.playerId)}>
              <Eye size={18} />
              Reveal Hand
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

export function canRevealTableHand(
  state: GameState,
  displayPlayer: GameState["players"][number],
  handDisplayPlayer: GameState["players"][number],
  privacyGateActive: boolean
): boolean {
  if (state.players.every((player) => player.eliminated || player.controller.type === "computer")) {
    return true;
  }

  if (privacyGateActive) {
    return false;
  }

  if (handDisplayPlayer.controller.type === "human") {
    return true;
  }

  const livingHumans = state.players.filter((player) => !player.eliminated && player.controller.type === "human");
  const singleHumanTeamId = livingHumans.length === 1 ? livingHumans[0].teamId : undefined;
  const activeHumanTeamId = displayPlayer.controller.type === "human" ? displayPlayer.teamId : undefined;
  const visibleTeamId = singleHumanTeamId ?? activeHumanTeamId;

  return Boolean(visibleTeamId && handDisplayPlayer.teamId === visibleTeamId);
}

export function canToggleHandPrivacy(
  state: GameState,
  displayPlayer: GameState["players"][number],
  handDisplayPlayer: GameState["players"][number],
  privacyGateActive: boolean
): boolean {
  const hasLivingHuman = state.players.some((player) => !player.eliminated && player.controller.type === "human");
  return (
    hasLivingHuman &&
    !privacyGateActive &&
    displayPlayer.id === handDisplayPlayer.id &&
    handDisplayPlayer.controller.type === "human"
  );
}

export type HandDiscardRequirement = {
  type: "handLimit" | "pendingDiscard" | "blackMarket" | "attackCost";
  playerId: PlayerId;
  count: number;
  reason: string;
  allowedCardInstanceIds?: string[];
};

export function getHandDiscardRequirement(
  state: GameState,
  currentPlayer: GameState["players"][number],
  handDisplayPlayer: GameState["players"][number]
): HandDiscardRequirement | null {
  if (state.pendingDiscard?.playerId === handDisplayPlayer.id) {
    const allowedCardInstanceIds = state.pendingDiscard.allowedCardInstanceIds;
    const discardableCount = allowedCardInstanceIds
      ? handDisplayPlayer.hand.filter((card) => allowedCardInstanceIds.includes(card.instanceId)).length
      : handDisplayPlayer.hand.length;
    return {
      type: "pendingDiscard",
      playerId: handDisplayPlayer.id,
      count: Math.min(state.pendingDiscard.count, discardableCount),
      reason: state.pendingDiscard.reason,
      allowedCardInstanceIds
    };
  }

  if (state.pendingAttackCost?.attackerId === handDisplayPlayer.id) {
    const allowedCardInstanceIds = handDisplayPlayer.hand
      .filter((card) => card.instanceId !== state.pendingAttackCost!.weaponInstanceId)
      .map((card) => card.instanceId);
    return {
      type: "attackCost",
      playerId: handDisplayPlayer.id,
      count: Math.min(1, allowedCardInstanceIds.length),
      reason: "Intimidate",
      allowedCardInstanceIds
    };
  }

  const pendingBlackMarketPlayerId = state.pendingBlackMarket?.playerOrder[state.pendingBlackMarket.currentIndex];
  if (pendingBlackMarketPlayerId === handDisplayPlayer.id) {
    const config =
      state.settings.blackMarketPreset === "custom" ? state.settings.blackMarketCustom : blackMarketPresets[state.settings.blackMarketPreset];
    if (config.discardCost > 0) {
      return {
        type: "blackMarket",
        playerId: handDisplayPlayer.id,
        count: Math.min(config.discardCost, handDisplayPlayer.hand.length),
        reason: "Black Market"
      };
    }
  }

  if (currentPlayer.id === handDisplayPlayer.id && currentPlayer.hand.length > state.settings.maxHandSize) {
    return {
      type: "handLimit",
      playerId: currentPlayer.id,
      count: currentPlayer.hand.length - state.settings.maxHandSize,
      reason: "hand limit"
    };
  }

  return null;
}

export function getPlayableReactionCardIds(state: GameState, handDisplayPlayer: GameState["players"][number]): string[] | null {
  const activeReaction = state.pendingReaction ?? state.pendingSecondaryDamage;
  if (!activeReaction || activeReaction.defenderId !== handDisplayPlayer.id) {
    return null;
  }

  return handDisplayPlayer.hand
    .filter((card) => {
      const definition = definitionFor(card);
      if (definition?.type !== "defense" && !definition?.isLethalDefense) {
        return false;
      }

      if (state.pendingSecondaryDamage && definition.id === "defense_decoy") {
        return false;
      }

      if (definition.isLethalDefense) {
        return activeReaction.baseDamage >= handDisplayPlayer.health;
      }

      if (definition.id === "defense_decoy") {
        return state.players.some(
          (player) =>
            !player.eliminated &&
            player.id !== activeReaction.attackerId &&
            player.id !== handDisplayPlayer.id &&
            isHostileTarget(handDisplayPlayer, player)
        );
      }

      return true;
    })
    .map((card) => card.instanceId);
}

function getDecisionText(state: GameState, currentPlayerName: string, displayPlayerName: string, winnerName?: string): string {
  if (state.phase === "gameOver") {
    return `${winnerName ?? "Nobody"} wins`;
  }

  if (state.pendingReaction) {
    return `${displayPlayerName} is defending`;
  }

  if (state.pendingRedirect) {
    return `${displayPlayerName} is redirecting`;
  }

  if (state.pendingSecondaryDamage) {
    return `${displayPlayerName} is defending`;
  }

  if (state.pendingAttackCost) {
    return `${displayPlayerName} must discard to attack`;
  }

  if (state.pendingDiscard) {
    return `${displayPlayerName} must discard`;
  }

  if (state.pendingSupplyDrop) {
    return `${displayPlayerName} is choosing supply`;
  }

  if (state.pendingMarketSearch) {
    return `${displayPlayerName} is choosing market loot`;
  }

  if (state.pendingBlackMarket) {
    return `${displayPlayerName} is deciding on Black Market`;
  }

  if (state.pendingSteal) {
    return `${displayPlayerName} is stealing`;
  }

  if (state.pendingSearch) {
    return `${displayPlayerName} is searching`;
  }

  return `${currentPlayerName}'s turn`;
}

function EventDialog({ state, dispatch }: GameTableProps) {
  const pending = state.pendingEventDialog;
  if (!pending) {
    return null;
  }

  const definition = definitionFor(pending.card);
  const player = state.players.find((candidate) => candidate.id === pending.playerId);
  if (!definition) {
    return null;
  }

  return (
    <section className="event-dialog-backdrop" role="dialog" aria-modal="true" aria-label={`${definition.name} event`}>
      <div className="event-dialog-panel">
        <div className="event-dialog-card">
          <CardView card={definition} mode="detail" />
        </div>
        <div className="event-dialog-copy">
          <p className="eyebrow">Event Drawn</p>
          <h2>{definition.name}</h2>
          <p>{player ? `${player.name} drew ${definition.name}.` : `${definition.name} was drawn.`}</p>
          <p>{definition.rulesText}</p>
          <button type="button" onClick={() => dispatch({ type: "ACKNOWLEDGE_EVENT_DIALOG" })}>
            Acknowledge
          </button>
        </div>
      </div>
    </section>
  );
}
