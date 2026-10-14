import { useId, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { labelTeam } from "../game/rules";
import type { CardTarget } from "../game/cardTargets";
import { Dialog } from "./Dialog";

export function TargetPicker({ options, value, onChange, label = "Target", disabled = false }: {
  options: CardTarget[]; value: string | null; onChange: (id: string) => void; label?: string; disabled?: boolean;
}) {
  const detailsId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find(option => option.player.id === value);
  const visible = options.filter(({ player, seat }) => `${player.name} ${seat} ${player.teamId ? labelTeam(player.teamId) : ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const availableCount = options.filter(option => !option.disabledReason).length;
  return <div className="target-picker">
    <span className="target-picker__label">{label}</span>
    <button className="target-picker__trigger" type="button" aria-label={`Choose ${label.toLowerCase()}`} aria-describedby={detailsId} aria-haspopup="dialog" aria-expanded={open} disabled={disabled || options.length === 0}
      onClick={event => { event.currentTarget.focus(); setQuery(""); setOpen(true); }}>
      <span id={detailsId}>{selected ? <><strong>{selected.player.name}</strong><small>{selected.player.health} HP · Seat {selected.seat}{selected.note ? ` · ${selected.note}` : ""}</small></> : options.length ? "Choose a player" : "No players available"}</span>
      <ChevronDown size={17} aria-hidden="true" />
    </button>
    {selected?.disabledReason && <p className="card-action-note" role="status">{selected.disabledReason}</p>}
    {options.length > 0 && availableCount === 0 && !selected?.disabledReason && <p className="card-action-note" role="status">No eligible {label.toLowerCase()} right now. Open the list to see why.</p>}
    {open && <Dialog className="match-dialog target-dialog" label={`Choose ${label.toLowerCase()}`} onClose={() => setOpen(false)}>
      <section className="match-dialog__panel target-dialog__panel">
        <header className="match-dialog__header"><h2>Choose {label.toLowerCase()}</h2><button type="button" className="match-dialog__close" aria-label="Close target picker" onClick={() => setOpen(false)}><X size={19} /></button></header>
        {options.length > 6 && <div className="target-dialog__search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search targets" placeholder="Search by name, team or seat…" value={query} onChange={event => setQuery(event.target.value)} /></div>}
        <div className="match-dialog__body target-dialog__body">
          <ul className="target-options" aria-label="Players to choose from">
            {visible.map(({ player, seat, disabledReason, note }) => <li key={player.id}>
              <button type="button" className="target-option" aria-label={`Select ${player.name}, seat ${seat}`} aria-describedby={`${detailsId}-${player.id}`} aria-pressed={value === player.id} disabled={!!disabledReason}
                onClick={() => { onChange(player.id); setOpen(false); }}>
                <span id={`${detailsId}-${player.id}`}><strong>{player.name}</strong><small>{player.health} HP · Seat {seat}{player.teamId ? ` · ${labelTeam(player.teamId)}` : ""}{note ? ` · ${note}` : ""}</small>{disabledReason && <small className="target-option__reason">{disabledReason}</small>}</span>
                {value === player.id && <Check size={18} aria-hidden="true" />}
              </button>
            </li>)}
          </ul>
          {!visible.length && <p className="target-dialog__empty">No players match your search.</p>}
        </div>
        <div className="target-dialog__count">{availableCount} eligible · {options.length} players</div>
      </section>
    </Dialog>}
  </div>;
}
