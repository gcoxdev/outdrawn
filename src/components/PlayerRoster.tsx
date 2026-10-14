import "./PlayerRoster.css";
import { Activity, Bot, Copy, Heart, User } from "lucide-react";
import { memo, useMemo, useState, useRef, useEffect } from "react";
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
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [jumpPending, setJumpPending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const teams = [...new Set(state.players.map(player => player.teamId).filter(Boolean))] as string[];
  const visiblePlayers = state.players.filter(player => player.name.toLowerCase().includes(query.trim().toLowerCase()) && (!group || (group === "living" ? !player.eliminated : player.teamId === group)));
  useEffect(() => {
    if (!jumpPending) return;
    const active = listRef.current?.querySelector<HTMLElement>(".is-decision");
    active?.scrollIntoView({ block: "nearest" });
    active?.focus({ preventScroll: true });
    setJumpPending(false);
  }, [jumpPending]);
  const aliveCount = useMemo(() => state.players.reduce((count, player) => count + (player.eliminated ? 0 : 1), 0), [state.players]);
  const smokeProtectedPlayerIds = useMemo(() => new Set(state.smokeProtectedPlayerIds), [state.smokeProtectedPlayerIds]);
  const compactRoster = state.players.length > 24;
  const freeDrawsEnabled = state.settings.freeDrawsPerTurn > 0;

  return (
    <section className={`player-roster ${compactRoster ? "player-roster--compact" : ""}`} aria-label="Players">
      <div className="sidebar-section__header">
        <div>
          <h2>Players</h2>
        </div>
        <strong>{aliveCount} alive</strong>
      </div>
      <div className="roster-filters">
        <input aria-label="Search players" placeholder="Find a player…" value={query} onChange={event => setQuery(event.target.value)} />
        <select aria-label="Player group" value={group} onChange={event => setGroup(event.target.value)}><option value="">All players</option><option value="living">Living players</option>{teams.map(team => <option key={team} value={team}>{labelTeam(team)}</option>)}</select>
        <button type="button" onClick={() => { setQuery(""); setGroup(""); setJumpPending(true); }}>Find active player</button>
      </div>
      <div className="player-roster__list" ref={listRef}>
        {visiblePlayers.length === 0 && <p className="log-empty">No players match.</p>}
        {visiblePlayers.map((player) => (
          <PlayerRosterCard
            key={player.id}
            player={player}
            compactRoster={compactRoster}
            freeDrawsEnabled={freeDrawsEnabled}
            isCurrent={player.id === currentPlayerId}
            isDecision={player.id === decisionPlayerId}
            isDisplay={player.id === displayPlayerId}
            isSmokeProtected={smokeProtectedPlayerIds.has(player.id)}
            markedBonus={state.markedTargets[player.id] ?? 0}
            attackBonus={state.attackBonuses[player.id] ?? 0}
          />
        ))}
      </div>
    </section>
  );
}

type PlayerRosterCardProps = {
  player: PlayerState;
  compactRoster: boolean;
  freeDrawsEnabled: boolean;
  isCurrent: boolean;
  isDecision: boolean;
  isDisplay: boolean;
  isSmokeProtected: boolean;
  markedBonus: number;
  attackBonus: number;
};

const PlayerRosterCard = memo(function PlayerRosterCard({
  player,
  compactRoster,
  freeDrawsEnabled,
  isCurrent,
  isDecision,
  isDisplay,
  isSmokeProtected,
  markedBonus,
  attackBonus
}: PlayerRosterCardProps) {
  return (
    <article
      className={[
        "player-roster-card",
        player.teamId ? "is-team" : "",
        isDecision ? "is-decision" : "",
        isCurrent ? "is-current" : "",
        isDisplay ? "is-display" : "",
        player.eliminated ? "is-eliminated" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      tabIndex={-1}
      data-player-id={player.id}
      data-team-id={player.teamId}
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
          {freeDrawsEnabled && (
            <span className="stat-draws" title="Draws">
              <Copy size={14} />
              {player.freeDrawsRemaining}
            </span>
          )}
        </div>
      </div>
      <div className="player-roster-card__chips">
        {player.teamId && <span>{labelTeam(player.teamId)}</span>}
        {isDecision && <span>Decision</span>}
        {isCurrent && <span>Turn</span>}
        {isSmokeProtected && !compactRoster && <span>Smoke</span>}
        {markedBonus > 0 && !compactRoster && <span>Marked +{markedBonus}</span>}
        {attackBonus > 0 && !compactRoster && <span>Ambush +{attackBonus}</span>}
        {player.eliminated && <span>Out</span>}
      </div>
    </article>
  );
});

function getTeamStyle(player: PlayerState): CSSProperties | undefined {
  return player.teamId ? ({ "--team-accent": getTeamColor(player.teamId) } as CSSProperties) : undefined;
}

function labelController(player: PlayerState): string {
  return player.controller.type === "computer" ? `Computer - ${capitalize(player.controller.strategy)}` : "Human";
}

function capitalize(value: string): string {
  return value[0].toUpperCase() + value.slice(1);
}
