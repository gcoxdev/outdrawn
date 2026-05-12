import { Activity, Bot, Copy, Heart, User } from "lucide-react";
import type { CSSProperties } from "react";
import { labelTeam } from "../game/rules";
import { getTeamColor } from "../game/setupOptions";
import type { GameState, PlayerId, PlayerState } from "../game/types";

type PlayerRosterProps = {
  state: GameState;
  currentPlayerId: PlayerId;
  decisionPlayerId: PlayerId;
  displayPlayerId: PlayerId;
};

export function PlayerRoster({ state, currentPlayerId, decisionPlayerId, displayPlayerId }: PlayerRosterProps) {
  const aliveCount = state.players.filter((player) => !player.eliminated).length;
  const compactRoster = state.players.length > 24;

  return (
    <section className={`player-roster ${compactRoster ? "player-roster--compact" : ""}`} aria-label="Players">
      <div className="sidebar-section__header">
        <div>
          <p className="eyebrow">Players</p>
          <h2>Roster</h2>
        </div>
        <strong>{aliveCount} alive</strong>
      </div>
      <div className="player-roster__list">
        {state.players.map((player) => (
          <article
            className={[
              "player-roster-card",
              player.teamId ? "is-team" : "",
              player.id === decisionPlayerId ? "is-decision" : "",
              player.id === currentPlayerId ? "is-current" : "",
              player.id === displayPlayerId ? "is-display" : "",
              player.eliminated ? "is-eliminated" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            data-team-id={player.teamId}
            key={player.id}
            style={getTeamStyle(player)}
          >
            <div className="player-roster-card__identity">
              <div>
                <h3>{player.name}</h3>
                <p>
                  {player.controller.type === "computer" ? <Bot size={12} /> : <User size={12} />}
                  {labelController(player)}
                </p>
              </div>
              <div className="player-roster-card__stats" aria-label={`${player.name} stats`}>
                <span className="stat-health" title="Health">
                  <Heart size={14} />
                  {player.health}
                </span>
                <span className="stat-cards" title="Cards">
                  <Copy size={14} />
                  {player.hand.length}
                </span>
                <span className="stat-actions" title="Actions">
                  <Activity size={14} />
                  {player.actionsRemaining}
                </span>
                {state.settings.freeDrawsPerTurn > 0 && (
                  <span className="stat-draws" title="Draws">
                    <Copy size={14} />
                    {player.freeDrawsRemaining}
                  </span>
                )}
              </div>
            </div>
            <div className="player-roster-card__chips">
              {player.teamId && !compactRoster && <span>{labelTeam(player.teamId)}</span>}
              {player.id === decisionPlayerId && <span>Decision</span>}
              {player.id === currentPlayerId && <span>Turn</span>}
              {state.smokeProtectedPlayerIds.includes(player.id) && !compactRoster && <span>Smoke</span>}
              {state.markedTargets[player.id] && !compactRoster && <span>Marked +{state.markedTargets[player.id]}</span>}
              {state.attackBonuses[player.id] && !compactRoster && <span>Ambush +{state.attackBonuses[player.id]}</span>}
              {player.eliminated && <span>Out</span>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function getTeamStyle(player: PlayerState): CSSProperties | undefined {
  return player.teamId ? ({ "--team-accent": getTeamColor(player.teamId) } as CSSProperties) : undefined;
}

function labelController(player: PlayerState): string {
  return player.controller.type === "computer" ? `Computer - ${capitalize(player.controller.strategy)}` : "Human";
}

function capitalize(value: string): string {
  return value[0].toUpperCase() + value.slice(1);
}
