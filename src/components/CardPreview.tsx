import { X } from "lucide-react";
import type { Card } from "../data/cards";
import { CardView } from "./CardView";
import { Dialog } from "./Dialog";
import "./CardPreview.css";

export function CardPreview({ card, onClose }: { card: Card; onClose: () => void }) {
  return (
    <Dialog className="card-preview-overlay" label={`${card.name} card preview`} onClose={onClose}>
      <button className="menu-backdrop" type="button" tabIndex={-1} aria-hidden="true" onClick={onClose} />
      <section className="card-preview-panel">
        <header><h2>{card.name}</h2><button className="menu-close" type="button" aria-label="Close card preview" onClick={onClose}><X size={19} /></button></header>
        <CardView card={card} mode="detail" />
        <p className="card-preview-rules">{card.rulesText}</p>
      </section>
    </Dialog>
  );
}
