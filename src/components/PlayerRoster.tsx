import type { GameState, PlayerId, PlayerState } from "../game/types";

type PlayerRosterProps = {
  state: GameState;
  currentPlayerId: PlayerId;
  decisionPlayerId: PlayerId;
  displayPlayerId: PlayerId;
};

export function PlayerRoster({ state, currentPlayerId, decisionPlayerId, displayPlayerId }: PlayerRosterProps) {
  const aliveCount = state.players.filter((player) => !player.eliminated).length;

  return (
    <section className="player-roster" aria-label="Players">
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
              player.id === decisionPlayerId ? "is-decision" : "",
              player.id === currentPlayerId ? "is-current" : "",
              player.id === displayPlayerId ? "is-display" : "",
              player.eliminated ? "is-eliminated" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            key={player.id}
          >
            <div className="player-roster-card__identity">
              <div>
                <h3>{player.name}</h3>
                <p>{labelController(player)}</p>
              </div>
              <strong>{player.health} HP</strong>
            </div>
            <dl>
              <div>
                <dt>Cards</dt>
                <dd>{player.hand.length}</dd>
              </div>
              <div>
                <dt>Actions</dt>
                <dd>{player.actionsRemaining}</dd>
              </div>
            </dl>
            <div className="player-roster-card__chips">
              {player.id === decisionPlayerId && <span>Decision</span>}
              {player.id === currentPlayerId && <span>Turn</span>}
              {state.smokeProtectedPlayerIds.includes(player.id) && <span>Smoke</span>}
              {state.markedTargets[player.id] && <span>Marked +{state.markedTargets[player.id]}</span>}
              {state.attackBonuses[player.id] && <span>Ambush +{state.attackBonuses[player.id]}</span>}
              {player.eliminated && <span>Out</span>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function labelController(player: PlayerState): string {
  return player.controller.type === "computer" ? `Computer - ${capitalize(player.controller.strategy)}` : "Human";
}

function capitalize(value: string): string {
  return value[0].toUpperCase() + value.slice(1);
}
