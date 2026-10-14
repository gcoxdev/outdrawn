import { useState } from "react";
import { Check, Maximize2 } from "lucide-react";
import type { Card } from "../data/cards";
import type { CardInstance } from "../game/types";
import { getCardDefinitionById } from "../game/rules";
import { CardView } from "./CardView";
import { CardPreview } from "./CardPreview";
import "./DecisionControls.css";

export function CardChoices({ cards, selectedIds, onChoose }: {
  cards: CardInstance[];
  selectedIds?: string[];
  onChoose: (instanceId: string) => void;
}) {
  const [preview, setPreview] = useState<Card | null>(null);
  return <>
    <ul className="card-choices" aria-label="Available cards">
      {cards.map(instance => {
        const card = getCardDefinitionById(instance.definitionId);
        if (!card) return null;
        const selected = selectedIds?.includes(instance.instanceId);
        return <li className={`card-choice${selected ? " is-selected" : ""}`} key={instance.instanceId}>
          <div className="card-choice__art" aria-hidden="true"><CardView card={card} mode="board" /></div>
          <div className="card-choice__copy"><span>{card.type}</span><h3>{card.name}</h3><p>{card.rulesText}</p></div>
          <div className="card-choice__actions">
            <button type="button" aria-label={`View ${card.name} card`} aria-haspopup="dialog"
              onClick={event => { event.currentTarget.focus(); setPreview(card); }}><Maximize2 size={14} aria-hidden="true" />View card</button>
            <button type="button" className="decision-primary" aria-pressed={selected}
              aria-label={`${selectedIds ? "Select" : "Keep"} ${card.name}`} onClick={() => onChoose(instance.instanceId)}>
              {selected && <Check size={14} aria-hidden="true" />}{selectedIds ? (selected ? "Selected" : "Select") : "Keep card"}
            </button>
          </div>
        </li>;
      })}
    </ul>
    {preview && <CardPreview card={preview} onClose={() => setPreview(null)} />}
  </>;
}
