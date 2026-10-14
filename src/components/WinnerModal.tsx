import { Trophy, X, Equal, RotateCcw } from "lucide-react";
import { Dialog } from "./Dialog";
import type { GameAction } from "../game/actions";
import { labelTeam } from "../game/rules";
import type { PlayerState, TeamId, MatchOutcome } from "../game/types";

type WinnerModalProps = {
  onClose: () => void;
  outcome?: MatchOutcome;
  winner: PlayerState | undefined;
  winnerTeamId: TeamId | null;
  winnerTeamMembers: PlayerState[];
  round: number;
  playerCount: number;
  dispatch: (action: GameAction) => void;
};

export function WinnerModal({ onClose, outcome, winner, winnerTeamId, winnerTeamMembers, round, playerCount, dispatch }: WinnerModalProps) {
  const isTie = !winnerTeamId && !winner;
  const winnerTitle = winnerTeamId ? `${labelTeam(winnerTeamId)} wins` : winner ? `${winner.name} wins` : "It's a tie";
  const eliminations = winnerTeamId ? winnerTeamMembers.reduce((total, player) => total + player.eliminations, 0) : winner?.eliminations;

  return (
    <Dialog className="match-dialog winner-modal" label="Game winner" onClose={onClose}>
      <section className={`match-dialog__panel winner-modal__panel${isTie ? " winner-modal__panel--tie" : ""}`}>
        <header className="match-dialog__header"><div><span>Match complete</span></div><button className="match-dialog__close" type="button" onClick={onClose} aria-label="Close winner screen"><X size={19} /></button></header>
        <div className="match-dialog__body winner-modal__body">
          <div className="winner-modal__emblem" aria-hidden="true">{isTie ? <Equal size={30} /> : <Trophy size={30} />}</div>
          <p className="match-dialog__kicker">{isTie ? "No winner declared" : winner?.eliminated ? "Tiebreak victory" : winnerTeamId ? "Team victory" : "Last one standing"}</p>
          <h2>{winnerTitle}</h2>
          <p className="winner-modal__description">{outcome?.description ?? (isTie ? "The match ended without a winner." : winner?.eliminated ? "Everyone fell in the final effect. Most eliminations, then pre-effect health, then pre-effect hand size determined the winner." : winnerTeamId ? "Your team outlasted the opposition." : "The last survivor takes the match.")}</p>
          {winnerTeamId && <ul className="winner-modal__team" aria-label="Winning team">{winnerTeamMembers.map(player => <li key={player.id}>{player.name}</li>)}</ul>}
          <dl className="winner-modal__stats"><div><dt>Round</dt><dd>{round}</dd></div><div><dt>Players</dt><dd>{playerCount}</dd></div>{eliminations !== undefined && <div><dt>Eliminations</dt><dd>{eliminations}</dd></div>}</dl>
        </div>
        <footer className="match-dialog__footer winner-modal__actions">
          <button type="button" onClick={onClose}>Review table</button>
          <button className="match-dialog__primary" type="button" onClick={() => dispatch({ type: "RESTART_GAME" })}><RotateCcw size={16} />New Game</button>
        </footer>
      </section>
    </Dialog>
  );
}
