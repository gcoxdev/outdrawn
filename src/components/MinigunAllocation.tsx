import { useState } from "react";
import { Minus, Plus, Search, X } from "lucide-react";
import type { PlayerState } from "../game/types";
import "./DecisionControls.css";

export function MinigunAllocation({ targets, pool, perTargetCap, disabled, onFire }: {
  targets: PlayerState[];
  pool: number;
  perTargetCap: number;
  disabled: boolean;
  onFire: (allocation: Record<string, number>) => void;
}) {
  const [allocation, setAllocation] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const chosen = targets.filter(target => (allocation[target.id] ?? 0) > 0);
  const allocated = chosen.reduce((total, target) => total + allocation[target.id], 0);
  const visible = targets.filter(target => (!selectedOnly || (allocation[target.id] ?? 0) > 0)
    && target.name.toLowerCase().includes(query.trim().toLowerCase()));

  function adjust(id: string, change: number) {
    setAllocation(current => ({ ...current, [id]: Math.max(0, Math.min(perTargetCap, (current[id] ?? 0) + change)) }));
  }

  return <div className="minigun-picker">
    <div className="minigun-picker__tools">
      <label className="decision-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search opponents" placeholder="Search opponents…" value={query} onChange={event => setQuery(event.target.value)} />
        {query && <button type="button" aria-label="Clear opponent search" onClick={() => setQuery("")}><X size={14} aria-hidden="true" /></button>}
      </label>
      <button type="button" aria-pressed={selectedOnly} onClick={() => setSelectedOnly(value => !value)}>Selected ({chosen.length})</button>
    </div>
    <div className="minigun-picker__targets" role="group" aria-label="Allocate Minigun damage">
      {visible.map(target => {
        const damage = allocation[target.id] ?? 0;
        return <div className={`allocation-row${damage ? " is-selected" : ""}`} key={target.id}>
          <span>{target.name}<small>{target.health} HP</small></span>
          <div>
            <button type="button" disabled={disabled || damage <= 0} aria-label={`Remove damage from ${target.name}`} onClick={() => adjust(target.id, -1)}><Minus size={15} aria-hidden="true" /></button>
            <strong aria-label={`${damage} damage assigned to ${target.name}`}>{damage}</strong>
            <button type="button" disabled={disabled || damage >= perTargetCap || allocated >= pool} aria-label={`Add damage to ${target.name}`} onClick={() => adjust(target.id, 1)}><Plus size={15} aria-hidden="true" /></button>
          </div>
        </div>;
      })}
      {!visible.length && <p className="decision-empty">{selectedOnly && !chosen.length ? "No targets selected yet." : "No matching opponents."}</p>}
    </div>
    {chosen.length > 0 && <div className="minigun-picker__summary" aria-label="Selected targets">
      {chosen.map(target => <button type="button" key={target.id} disabled={disabled} aria-label={`Clear damage from ${target.name}`}
        onClick={() => setAllocation(current => ({ ...current, [target.id]: 0 }))}><span>{target.name} · {allocation[target.id]}</span><X size={12} aria-hidden="true" /></button>)}
    </div>}
    <div className="decision-footer">
      <p role="status"><strong>{pool - allocated}</strong> damage left<span>{allocated} of {pool} allocated</span></p>
      <button className="decision-primary" type="button" disabled={disabled || allocated <= 0 || allocated > pool}
        onClick={() => onFire(Object.fromEntries(chosen.map(target => [target.id, allocation[target.id]])))}>Fire Minigun</button>
    </div>
  </div>;
}
