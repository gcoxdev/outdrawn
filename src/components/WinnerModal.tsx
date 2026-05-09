import { Trophy, X } from "lucide-react";
import { useState } from "react";
import type { GameAction } from "../game/actions";
import { labelTeam } from "../game/rules";
import type { PlayerState, TeamId } from "../game/types";

type WinnerModalProps = {
  winner: PlayerState | undefined;
  winnerTeamId: TeamId | null;
  winnerTeamMembers: PlayerState[];
  dispatch: (action: GameAction) => void;
};

export function WinnerModal({ winner, winnerTeamId, winnerTeamMembers, dispatch }: WinnerModalProps) {
  const [isVisible, setIsVisible] = useState(true);
  const winnerTitle = winnerTeamId ? `${labelTeam(winnerTeamId)} wins` : winner ? `${winner.name} wins` : "No winner";
  const winnerText = winnerTeamId
    ? winnerTeamMembers.map((player) => player.name).join(", ")
    : winner
      ? `${winner.name} survived the final hand.`
      : "The last players fell at the same time.";

  if (!isVisible) {
    return null;
  }

  return (
    <div className="winner-modal" role="dialog" aria-modal="true" aria-label="Game winner">
      <section className="winner-modal__panel">
        <div className="winner-modal__burst" aria-hidden="true" />
        <button className="winner-modal__close" type="button" onClick={() => setIsVisible(false)} aria-label="Close winner screen">
          <X size={24} strokeWidth={2.4} />
        </button>
        <Trophy className="winner-modal__icon" size={46} />
        <p className="eyebrow">Last Hand Standing</p>
        <h2>{winnerTitle}</h2>
        <p>{winnerText}</p>
        <button className="primary-command" type="button" onClick={() => dispatch({ type: "RESET_GAME" })}>
          New Game
        </button>
      </section>
    </div>
  );
}
