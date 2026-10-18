import {
  Activity,
  Bomb,
  Crosshair,
  HeartPulse,
  Shield,
  ShieldCheck,
  CircleHelp,
  Zap
} from "lucide-react";
import { useState } from "react";
import type { Card } from "../data/cards";
import { EventIcon } from "./EventIcon";
import { HeartMinusIcon } from "./HeartMinusIcon";
import { useCardBack } from "./CardBackPreference";

const typeIcons = {
  weapon: Crosshair,
  defense: Shield,
  ability: Zap,
  healing: HeartPulse,
  event: EventIcon
};

type CardViewProps = {
  card: Card;
  mode?: "hand" | "board" | "detail";
  isSelected?: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
  opensDialog?: boolean;
};

type RulesAnchorRect = Pick<DOMRect, "left" | "right" | "top" | "bottom">;

function getCardFaceImage(card: Card) {
  if (card.type === "weapon") {
    const slug = card.id.replaceAll("_", "-");
    return `/optimized/cards/fronts/weapons/ai-review/final/${slug}-dark-01.webp`;
  }

  if (card.type === "defense") {
    const slugById: Partial<Record<Card["id"], string>> = {
      defense_decoy: "defense-ricochet",
      defense_fake_death: "defense-revive"
    };
    const slug = slugById[card.id] ?? card.id.replaceAll("_", "-");
    return `/optimized/cards/fronts/defense/ai-review/final/${slug}-dark-01.webp`;
  }

  if (card.type === "ability") {
    const slug = card.id.replaceAll("_", "-");
    return `/optimized/cards/fronts/ability/ai-review/final/${slug}-dark-01.webp`;
  }

  if (card.type === "healing") {
    const slug = card.id.replaceAll("_", "-");
    return `/optimized/cards/fronts/healing/ai-review/final/${slug}-dark-01.webp`;
  }

  if (card.type === "event") {
    const slug = card.id.replaceAll("_", "-");
    return `/optimized/cards/fronts/events/ai-review/final/${slug}-dark-01.webp`;
  }

  return null;
}

export function getRulesPopoverPosition(
  rect: RulesAnchorRect,
  viewportWidth: number,
  viewportHeight: number,
  preferredWidth = 260,
  margin = 8
) {
  const width = Math.min(preferredWidth, viewportWidth - margin * 2);
  const center = (rect.left + rect.right) / 2;
  const left = Math.min(Math.max(margin, center - width / 2), viewportWidth - width - margin);
  const hasRoomAbove = rect.top > 96;
  const top = hasRoomAbove ? rect.top - margin : Math.min(viewportHeight - margin, rect.bottom + margin);

  return {
    left,
    top,
    width,
    placement: hasRoomAbove ? "above" : "below"
  };
}

export function CardView({ card, mode = "hand", isSelected = false, isDisabled = false, onClick, opensDialog = false }: CardViewProps) {
  const [rulesPosition, setRulesPosition] = useState<ReturnType<typeof getRulesPopoverPosition> | null>(null);
  const TypeIcon = typeIcons[card.type];
  const cardFaceImage = getCardFaceImage(card);
  const className = `card-view card-${card.type} card-${mode}${cardFaceImage ? " card-view--image" : ""}${
    isSelected ? " is-selected" : ""
  }`;
  const stats = [
    card.damage ? { label: card.damage, icon: HeartMinusIcon, title: "Damage" } : null,
    card.splashDamage ? { label: card.splashDamage, icon: Bomb, title: "Splash" } : null,
    card.block ? { label: card.block, icon: ShieldCheck, title: "Block" } : null,
    card.actionsCost ? { label: card.actionsCost, icon: Activity, title: "Actions" } : null,
    card.heal ? { label: card.heal, icon: HeartPulse, title: "Heal" } : null
  ].filter(Boolean);

  const cardContent = cardFaceImage ? (
    <img className="card-view__image" src={cardFaceImage} alt={`${card.name}: ${card.rulesText}`} draggable={false} />
  ) : (
    <>
      <header className="card-view__header">
        <span className="card-view__name">{card.name}</span>
      </header>
      <div className="card-view__art" aria-hidden="true">
        <TypeIcon size={mode === "board" ? 28 : 42} strokeWidth={1.8} />
      </div>
      <footer className="card-view__footer">
        <span className="card-view__type">
          <TypeIcon size={12} />
          {card.type}
        </span>
      </footer>
      <p className="card-view__text">{mode === "detail" ? card.rulesText : card.shortText}</p>
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
      </div>
      <span
        className="card-view__rules"
        title={card.rulesText}
        aria-label={`Rules for ${card.name}: ${card.rulesText}`}
        onClick={(event) => {
          event.stopPropagation();
          setRulesPosition((current) =>
            current
              ? null
              : getRulesPopoverPosition(event.currentTarget.getBoundingClientRect(), window.innerWidth, window.innerHeight)
          );
        }}
        onPointerEnter={(event) =>
          setRulesPosition(getRulesPopoverPosition(event.currentTarget.getBoundingClientRect(), window.innerWidth, window.innerHeight))
        }
        onPointerLeave={() => setRulesPosition(null)}
      >
        <CircleHelp size={12} />
        {rulesPosition && (
          <span
            className={`card-view__rules-popover card-view__rules-popover--${rulesPosition.placement}`}
            style={{
              left: rulesPosition.left,
              top: rulesPosition.top,
              width: rulesPosition.width
            }}
          >
            {card.rulesText}
          </span>
        )}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        className={className}
        disabled={isDisabled}
        aria-haspopup={opensDialog ? "dialog" : undefined}
        onClick={onClick ? event => { event.currentTarget.focus(); onClick(); } : undefined}
        type="button"
      >
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
  const { cardBack } = useCardBack();
  return (
    <div className="card-back" aria-label="Hidden card">
      <img className="card-back__image" src={cardBack.image} alt="" aria-hidden="true" />
    </div>
  );
}
