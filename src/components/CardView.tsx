import {
  Activity,
  BadgeAlert,
  Bomb,
  Crosshair,
  HeartPulse,
  Shield,
  ShieldCheck,
  Swords,
  CircleHelp,
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
  const className = `card-view card-${card.type} card-${mode}${isSelected ? " is-selected" : ""}`;
  const stats = [
    card.damage ? { label: card.damage, icon: Swords, title: "Damage" } : null,
    card.splashDamage ? { label: card.splashDamage, icon: Bomb, title: "Splash" } : null,
    card.block ? { label: card.block, icon: ShieldCheck, title: "Block" } : null,
    card.heal ? { label: card.heal, icon: HeartPulse, title: "Heal" } : null,
    card.isReaction ? { label: "R", icon: Activity, title: "Reaction" } : null
  ].filter(Boolean);

  const cardContent = (
    <>
      <header className="card-view__header">
        <span className="card-view__name">{card.name}</span>
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
        <span className="card-view__type">
          <TypeIcon size={12} />
          {card.type}
        </span>
      </footer>
      <span
        className="card-view__rules"
        data-rules={card.rulesText}
        title={card.rulesText}
        aria-label={`Rules for ${card.name}: ${card.rulesText}`}
      >
        <CircleHelp size={14} />
      </span>
    </>
  );

  if (onClick) {
    return (
      <button className={className} disabled={isDisabled} onClick={onClick} type="button">
        {cardContent}
      </button>
    );
  }

  return (
    <article className={className} aria-label={`${card.name} card`}>
      {cardContent}
    </article>
  );
}

export function CardBack() {
  return (
    <div className="card-back" aria-label="Hidden card">
      <img className="card-back__image" src="/cards/backs/outdrawn-back-dark-01.png" alt="" aria-hidden="true" />
    </div>
  );
}
