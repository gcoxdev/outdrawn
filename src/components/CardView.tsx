import {
  Activity,
  BadgeAlert,
  Bomb,
  Crosshair,
  HeartPulse,
  Shield,
  ShieldCheck,
  Swords,
  Zap
} from "lucide-react";
import type { Card } from "../data/cards";

const typeIcons = {
  weapon: Crosshair,
  defense: Shield,
  ability: Zap,
  healing: HeartPulse,
  event: BadgeAlert
};

type CardViewProps = {
  card: Card;
  mode?: "hand" | "board" | "detail";
  isSelected?: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
};

export function CardView({ card, mode = "hand", isSelected = false, isDisabled = false, onClick }: CardViewProps) {
  const TypeIcon = typeIcons[card.type];
  const stats = [
    card.damage ? { label: card.damage, icon: Swords, title: "Damage" } : null,
    card.splashDamage ? { label: card.splashDamage, icon: Bomb, title: "Splash" } : null,
    card.block ? { label: card.block, icon: ShieldCheck, title: "Block" } : null,
    card.heal ? { label: card.heal, icon: HeartPulse, title: "Heal" } : null,
    card.isReaction ? { label: "R", icon: Activity, title: "Reaction" } : null
  ].filter(Boolean);

  return (
    <button
      className={`card-view card-${card.type} card-${mode}${isSelected ? " is-selected" : ""}`}
      disabled={isDisabled}
      onClick={onClick}
      type="button"
    >
      <header className="card-view__header">
        <span className="card-view__name">{card.name}</span>
        <span className="card-view__type">
          <TypeIcon size={13} />
          {card.type}
        </span>
      </header>
      <div className="card-view__art" aria-hidden="true">
        <TypeIcon size={mode === "board" ? 28 : 42} strokeWidth={1.8} />
      </div>
      <div className="card-view__stats">
        {stats.map((stat) => {
          const Icon = stat!.icon;
          return (
            <span className="stat-chip" key={stat!.title} title={stat!.title}>
              <Icon size={12} />
              {stat!.label}
            </span>
          );
        })}
        {card.actionsCost && (
          <span className="stat-chip" title="Actions">
            {card.actionsCost}A
          </span>
        )}
      </div>
      <p className="card-view__text">{mode === "detail" ? card.rulesText : card.shortText}</p>
      <footer className="card-view__footer">
        <span>{card.rarity}</span>
        <span>{card.id.replace(/^[^_]+_/, "")}</span>
      </footer>
    </button>
  );
}

export function CardBack() {
  return (
    <div className="card-back" aria-label="Hidden card">
      <div className="card-back__mark">LHS</div>
    </div>
  );
}
