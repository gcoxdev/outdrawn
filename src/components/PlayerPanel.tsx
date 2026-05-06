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
