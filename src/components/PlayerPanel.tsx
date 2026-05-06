import { allCards } from "../data/cards";
import type { PlayerState } from "../game/types";

function cardName(definitionId?: string) {
  return allCards.find((card) => card.id === definitionId)?.name ?? "Empty";
}

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
          <dt>Weapon</dt>
          <dd>{cardName(player.equippedWeapon?.definitionId)}</dd>
        </div>
        <div>
          <dt>Defense</dt>
          <dd>{cardName(player.equippedDefense?.definitionId)}</dd>
        </div>
      </dl>
    </article>
  );
}
