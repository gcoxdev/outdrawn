import { useState } from "react";
import type { CardTarget } from "../game/cardTargets";
import { TargetPicker } from "./TargetPicker";

export function RedirectAction({ options, onRedirect }: { options: CardTarget[]; onRedirect: (id: string) => void }) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const target = options.find(option => option.player.id === targetId);
  return <div className="card-action-play redirect-action">
    <TargetPicker options={options} value={targetId} onChange={setTargetId} />
    <button type="button" className="decision-primary" disabled={!target} onClick={() => target && onRedirect(target.player.id)}>{target ? `Redirect to ${target.player.name}` : "Redirect attack"}</button>
  </div>;
}
