import { Trophy, X } from "lucide-react";
import { useState } from "react";
import type { GameAction } from "../game/actions";
import type { PlayerState } from "../game/types";

type WinnerModalProps = {
  winner: PlayerState | undefined;
  dispatch: (action: GameAction) => void;
};

export function WinnerModal({ winner, dispatch }: WinnerModalProps) {
  const [isVisible, setIsVisible] = useState(true);

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
        <h2>{winner ? `${winner.name} wins` : "No winner"}</h2>
        <p>{winner ? `${winner.name} survived the final hand.` : "The last players fell at the same time."}</p>
        <button className="primary-command" type="button" onClick={() => dispatch({ type: "RESET_GAME" })}>
          New Game
        </button>
      </section>
    </div>
  );
}
