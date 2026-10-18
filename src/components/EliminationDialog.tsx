import { ArrowRight, Target, Users } from "lucide-react";
import { useId } from "react";
import type { GameState, PlayerId } from "../game/types";
import { Dialog } from "./Dialog";
import "./GameDialogs.css";

export function EliminationDialog({ state, playerIds, onContinue }: {
  state: GameState;
  playerIds: PlayerId[];
  onContinue: () => void;
}) {
  const descriptionId = useId();
  const players = state.players.filter(player => playerIds.includes(player.id));
  const alive = state.players.filter(player => !player.eliminated).length;
  return (
    <Dialog className="match-dialog elimination-dialog" label={players.length === 1 ? "Player eliminated" : "Players eliminated"} descriptionId={descriptionId}>
      <section className="match-dialog__panel elimination-dialog__panel">
        <header className="match-dialog__header">
          <div><Target size={18} aria-hidden="true" /><span>{players.length === 1 ? "Player eliminated" : "Players eliminated"}</span></div>
          <span className="match-dialog__meta">Round {state.round}</span>
        </header>
        <div id={descriptionId} className="match-dialog__body elimination-dialog__body">
          <div className="elimination-dialog__emblem"><Target size={30} aria-hidden="true" /></div>
          <p className="match-dialog__kicker">Out of the match</p>
          {players.length === 1 ? <h2>{players[0].name}</h2> : <>
            <h2>{players.length} players eliminated</h2>
            <ul className="elimination-dialog__players">{players.map(player => <li key={player.id}>{player.name}</li>)}</ul>
          </>}
          <p className="elimination-dialog__remaining"><Users size={16} aria-hidden="true" /><span><strong>{alive}</strong> {alive === 1 ? "player remains" : "players remain"}</span></p>
        </div>
        <footer className="match-dialog__footer">
          <button type="button" className="match-dialog__primary" onClick={onContinue}>{state.phase === "gameOver" ? "See results" : "Continue"}<ArrowRight size={16} aria-hidden="true" /></button>
        </footer>
      </section>
    </Dialog>
  );
}
