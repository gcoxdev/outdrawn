import { useState } from "react";
import { PlayingCardsFan, Maximize2, X } from "lucide-react";
import type { Card } from "../data/cards";
import type { CardInstance } from "../game/types";
import { getCardDefinitionById } from "../game/rules";
import { Dialog } from "./Dialog";
import { CardView } from "./CardView";
import { CardPreview } from "./CardPreview";

export function DiscardPiles({ main, events, onClose }: { main: CardInstance[]; events: CardInstance[]; onClose: () => void }) {
  const [pile, setPile] = useState<"main" | "events">("main");
  const [preview, setPreview] = useState<Card | null>(null);
  const cards = pile === "main" ? main : events;
  return <>
    <Dialog className="match-dialog" label="Discard piles" onClose={onClose}>
      <section className="match-dialog__panel discard-piles-panel">
        <header className="match-dialog__header">
          <div><PlayingCardsFan size={18} /><h2>Discard piles</h2></div>
          <button className="match-dialog__close" type="button" aria-label="Close discard piles" onClick={onClose}><X size={19} /></button>
        </header>
        <div className="discard-piles-tabs" aria-label="Choose discard pile">
          <button type="button" aria-pressed={pile === "main"} onClick={() => setPile("main")}>Main deck <span>{main.length}</span></button>
          <button type="button" aria-pressed={pile === "events"} onClick={() => setPile("events")}>Events <span>{events.length}</span></button>
        </div>
        <div className="match-dialog__body discard-piles-body" key={pile}>
          {cards.length > 0 ? <>
            <p className="discard-piles-order">Most recent first</p>
            <ol className="discard-piles-list">
              {[...cards].reverse().map((instance, index) => {
                const card = getCardDefinitionById(instance.definitionId);
                if (!card) return <li key={instance.instanceId}>Unknown card</li>;
                return <li key={instance.instanceId}>
                  <div className="discard-piles-art" aria-hidden="true"><CardView card={card} mode="board" /></div>
                  <div className="discard-piles-copy"><span>{card.type}{index === 0 ? " · Latest" : ""}</span><h3>{card.name}</h3><p>{card.shortText}</p></div>
                  <button type="button" className="discard-piles-view" aria-label={`View ${card.name} card`} onClick={event => { event.currentTarget.focus(); setPreview(card); }}><Maximize2 size={14} /><span>View card</span></button>
                </li>;
              })}
            </ol>
          </> : <div className="discard-piles-empty"><PlayingCardsFan size={28} /><h3>No discarded {pile === "events" ? "events" : "cards"}</h3><p>{pile === "events" ? "Discarded event cards will appear here." : "Cards discarded during the match will appear here."}</p></div>}
        </div>
      </section>
    </Dialog>
    {preview && <CardPreview card={preview} onClose={() => setPreview(null)} />}
  </>;
}
