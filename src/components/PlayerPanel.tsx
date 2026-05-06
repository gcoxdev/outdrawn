import type { PlayerState } from "../game/types";

type PlayerPanelProps = {
  player: PlayerState;
  isCurrent: boolean;
};

export function PlayerPanel({ player, isCurrent }: PlayerPanelProps) {
  return (
    <article className={`player-panel${isCurrent ? " is-current" : ""}${player.eliminated ? " is-eliminated" : ""}`}>
      <div>
        <h3>{player.name}</h3>
        <p>{player.eliminated ? "Eliminated" : `${player.actionsRemaining} actions`}</p>
      </div>
      <strong>{player.health} HP</strong>
      <dl>
        <div>
          <dt>Control</dt>
          <dd>{formatController(player)}</dd>
        </div>
        <div>
          <dt>Hand</dt>
          <dd>{player.hand.length}</dd>
        </div>
        <div>
          <dt>Attacked</dt>
          <dd>{player.attackedThisRound ? "Yes" : "No"}</dd>
        </div>
      </dl>
    </article>
  );
}

function formatController(player: PlayerState): string {
  if (player.controller.type === "human") {
    return "Human";
  }

  return `Computer - ${player.controller.strategy[0].toUpperCase()}${player.controller.strategy.slice(1)}`;
}
