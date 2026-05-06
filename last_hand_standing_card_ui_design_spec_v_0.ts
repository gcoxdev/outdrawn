// Last Hand Standing — Card UI Design Spec v0.1
// Hybrid style: clean readable UI + gritty battle royale flavor.
// This is intended to guide the React/web prototype card component.

// ------------------------------------------------------------
// 1. Visual Design Goals
// ------------------------------------------------------------

export const designGoals = {
  readability: "A player should understand card type, timing, and main effect within 2 seconds.",
  hybridStyle: "Clean digital card UI with thematic survival/battle royale art and texture.",
  scalable: "Cards must work in hand view, zoomed detail view, mobile view, and printable prototype view.",
  implementation: "Use CSS variables/Tailwind-style tokens so colors and layout can be adjusted quickly."
};

// ------------------------------------------------------------
// 2. Card Dimensions
// ------------------------------------------------------------

export const cardDimensions = {
  // Digital default card ratio approximates poker/TCG card proportions.
  aspectRatio: "2.5 / 3.5",

  sizes: {
    hand: {
      width: 150,
      height: 210,
      usage: "Cards displayed in player hand. Text may be shortened."
    },
    board: {
      width: 110,
      height: 154,
      usage: "Equipped cards or event cards shown on board."
    },
    zoom: {
      width: 300,
      height: 420,
      usage: "Full readable card modal/detail view."
    },
    print: {
      widthInches: 2.5,
      heightInches: 3.5,
      usage: "Physical prototype card size."
    }
  }
};

// ------------------------------------------------------------
// 3. Card Type Color Tokens
// ------------------------------------------------------------

export const cardTypeStyles = {
  weapon: {
    label: "Weapon",
    primary: "#B73535",
    secondary: "#3A1515",
    glow: "rgba(183, 53, 53, 0.35)",
    icon: "crosshair",
    tone: "aggressive"
  },
  defense: {
    label: "Defense",
    primary: "#2F5E9E",
    secondary: "#10243F",
    glow: "rgba(47, 94, 158, 0.35)",
    icon: "shield",
    tone: "protective"
  },
  ability: {
    label: "Ability",
    primary: "#6E46A8",
    secondary: "#241436",
    glow: "rgba(110, 70, 168, 0.35)",
    icon: "zap",
    tone: "tactical"
  },
  healing: {
    label: "Healing",
    primary: "#3F8F5A",
    secondary: "#123220",
    glow: "rgba(63, 143, 90, 0.35)",
    icon: "heart-pulse",
    tone: "recovery"
  },
  event: {
    label: "Event",
    primary: "#C77A2D",
    secondary: "#3C220C",
    glow: "rgba(199, 122, 45, 0.35)",
    icon: "alert-triangle",
    tone: "global"
  }
};

// ------------------------------------------------------------
// 4. Layout Anatomy
// ------------------------------------------------------------

export const cardLayout = {
  container: {
    borderRadius: "16px",
    borderWidth: "2px",
    background: "dark textured gradient",
    shadow: "soft outer shadow + type-colored glow on hover",
    overflow: "hidden"
  },

  sections: [
    {
      name: "header",
      heightPercent: 15,
      contents: [
        "card name",
        "type badge",
        "timing badge if relevant"
      ],
      notes: "Header must remain readable at hand size. Use bold type and high contrast."
    },
    {
      name: "art",
      heightPercent: 42,
      contents: [
        "card artwork or placeholder illustration",
        "subtle type-colored vignette"
      ],
      notes: "Art should be visually strong but not interfere with text."
    },
    {
      name: "stats",
      heightPercent: 13,
      contents: [
        "damage/block/heal values",
        "target/splash/action cost indicators"
      ],
      notes: "Use icon chips for fast scanning."
    },
    {
      name: "rulesText",
      heightPercent: 22,
      contents: [
        "shortText in hand view",
        "rulesText in zoom/detail view"
      ],
      notes: "Rules text should be direct and non-flavorful."
    },
    {
      name: "footer",
      heightPercent: 8,
      contents: [
        "rarity pip",
        "set marker",
        "card id or debug id in prototype"
      ],
      notes: "Footer can be minimal in prototype."
    }
  ]
};

// ------------------------------------------------------------
// 5. Icon Mapping
// ------------------------------------------------------------

// Suggested icon library: lucide-react.
// These names map conceptually to lucide icons or custom SVGs.

export const iconMap = {
  damage: "Swords",
  target: "Crosshair",
  splash: "Bomb",
  block: "Shield",
  armor: "ShieldCheck",
  reaction: "Zap",
  cancel: "Ban",
  redirect: "Shuffle",
  heal: "HeartPulse",
  draw: "Cards / Library",
  discard: "Trash2",
  hand: "Hand",
  loot: "PackageOpen",
  cooldown: "Clock",
  repeat: "Repeat",
  pierce: "ArrowRightFromLine",
  declare: "Eye",
  stealth: "CloudFog",
  survive: "Activity",
  lethal: "Skull",
  buff: "TrendingUp",
  weapon: "Crosshair",
  mark: "BadgeAlert",
  control: "CircleSlash",
  choose: "MousePointerClick",
  reuse: "RefreshCw",
  extraAction: "PlusCircle",
  selfDamage: "HeartCrack",
  collapse: "Flame",
  supply: "Package",
  healthCost: "HeartMinus",
  firstAttack: "Flag",
  defenseDown: "ShieldOff",
  lowHealth: "HeartCrack",
  search: "Search",
  action: "CircleDot"
};

// ------------------------------------------------------------
// 6. Stat Chip Rules
// ------------------------------------------------------------

export const statChipRules = {
  weapon: [
    "Show damage chip first, e.g. ⚔ 3",
    "Show splash chip if applicable, e.g. 💥 2",
    "Show cooldown chip if applicable"
  ],
  defense: [
    "Show block chip if numeric",
    "Show Reaction badge for reaction cards",
    "Show Equip badge for Armor Vest"
  ],
  ability: [
    "Show action modifier chip, discard chip, draw chip, or control chip",
    "Avoid too many chips; max 3 chips on hand-size card"
  ],
  healing: [
    "Show heal chip first",
    "Show draw chip if applicable",
    "Show both-actions badge for Medkit"
  ],
  event: [
    "Show timing badge prominently: Immediate / This Round / Ongoing",
    "Show global effect icon"
  ]
};

// ------------------------------------------------------------
// 7. Typography
// ------------------------------------------------------------

export const typography = {
  title: {
    font: "Inter, system-ui, sans-serif",
    weight: 800,
    size: {
      hand: "0.95rem",
      zoom: "1.35rem"
    }
  },
  badge: {
    font: "Inter, system-ui, sans-serif",
    weight: 700,
    size: {
      hand: "0.6rem",
      zoom: "0.75rem"
    },
    transform: "uppercase",
    letterSpacing: "0.06em"
  },
  rules: {
    font: "Inter, system-ui, sans-serif",
    weight: 500,
    size: {
      hand: "0.72rem",
      zoom: "0.95rem"
    },
    lineHeight: 1.25
  },
  flavor: {
    font: "serif or italic sans",
    weight: 400,
    size: "0.75rem",
    usage: "Only shown in zoom view or printed cards."
  }
};

// ------------------------------------------------------------
// 8. Interaction States
// ------------------------------------------------------------

export const interactionStates = {
  default: {
    transform: "none",
    shadow: "medium shadow",
    cursor: "pointer"
  },
  hover: {
    transform: "translateY(-6px) scale(1.03)",
    shadow: "large shadow + type glow"
  },
  selected: {
    outline: "3px solid type primary color",
    transform: "translateY(-10px) scale(1.05)",
    notes: "Used when player selects a card to play."
  },
  playable: {
    glow: "subtle green or type-color pulse",
    notes: "Only show when it is legally playable."
  },
  disabled: {
    opacity: 0.45,
    grayscale: true,
    notes: "Used when card cannot currently be played."
  },
  reactionPrompt: {
    animation: "pulse border",
    notes: "Used when player can respond to an incoming attack."
  },
  zoomed: {
    modal: true,
    notes: "Click or long-press opens full card detail."
  }
};

// ------------------------------------------------------------
// 9. Card Component Props
// ------------------------------------------------------------

export type CardViewMode = "hand" | "board" | "zoom" | "print";

export type CardComponentProps = {
  cardId: string;
  mode: CardViewMode;
  isPlayable?: boolean;
  isSelected?: boolean;
  isDisabled?: boolean;
  isReactionPrompt?: boolean;
  showDebugId?: boolean;
  onClick?: (cardId: string) => void;
  onHover?: (cardId: string) => void;
};

// ------------------------------------------------------------
// 10. Recommended React Component Structure
// ------------------------------------------------------------

export const componentStructure = {
  CardView: {
    purpose: "Root card component. Accepts card data and mode.",
    children: ["CardHeader", "CardArt", "CardStats", "CardRulesText", "CardFooter"]
  },
  CardHeader: {
    purpose: "Displays name, type, and timing badge."
  },
  CardArt: {
    purpose: "Displays generated art or placeholder art."
  },
  CardStats: {
    purpose: "Displays icon chips derived from card fields."
  },
  CardRulesText: {
    purpose: "Displays shortText in compact mode, rulesText in zoom mode."
  },
  CardFooter: {
    purpose: "Displays rarity, set marker, and optional debug id."
  }
};

// ------------------------------------------------------------
// 11. Placeholder Art Rules
// ------------------------------------------------------------

export const placeholderArtRules = {
  untilFinalArt: true,
  approach: "Use type-colored gradient backgrounds with large lucide-style icons.",
  examples: {
    Pistol: "Red smoky background + crosshair/gun silhouette",
    Grenade: "Red-orange background + bomb icon + sparks",
    ArmorVest: "Blue tactical vest silhouette",
    Dodge: "Blue motion blur silhouette",
    Ambush: "Purple shadow figure / crosshair",
    Medkit: "Green medical case with glow",
    Bounty: "Orange wanted marker / target icon"
  }
};

// ------------------------------------------------------------
// 12. Final Artwork Direction
// ------------------------------------------------------------

export const finalArtworkDirection = {
  style: "semi-realistic, gritty, cinematic, high contrast",
  avoid: [
    "overly cartoonish art",
    "busy backgrounds",
    "tiny details that disappear on mobile",
    "text embedded inside artwork"
  ],
  include: [
    "clear object silhouettes",
    "dramatic lighting",
    "survival/battle royale atmosphere",
    "consistent color grading by card type"
  ]
};

// ------------------------------------------------------------
// 13. Accessibility
// ------------------------------------------------------------

export const accessibilityRules = {
  neverUseColorOnly: "Card type must be shown by label and icon, not only color.",
  contrast: "All text should meet strong contrast against background.",
  readableAtSmallSize: "Short text and stat chips must remain readable in hand view.",
  keyboard: "Cards should be focusable and playable with keyboard controls later.",
  reducedMotion: "Hover and pulse animations should respect prefers-reduced-motion."
};

// ------------------------------------------------------------
// 14. CSS Variable Tokens
// ------------------------------------------------------------

export const cssVariablePlan = `
.card {
  --card-primary: var(--type-primary);
  --card-secondary: var(--type-secondary);
  --card-glow: var(--type-glow);

  aspect-ratio: 2.5 / 3.5;
  border-radius: 16px;
  border: 2px solid var(--card-primary);
  background: linear-gradient(180deg, var(--card-secondary), #090909);
  box-shadow: 0 12px 28px rgba(0,0,0,.35);
  overflow: hidden;
}

.card:hover {
  transform: translateY(-6px) scale(1.03);
  box-shadow: 0 18px 36px rgba(0,0,0,.45), 0 0 22px var(--card-glow);
}
`;

// ------------------------------------------------------------
// 15. Immediate Web Prototype Recommendation
// ------------------------------------------------------------

export const prototypeRecommendation = {
  firstVersion: [
    "Use placeholder art only",
    "Implement all cards from the dataset",
    "Use zoom modal for full rules text",
    "Keep animations minimal",
    "Prioritize game log and legal move clarity over visual polish"
  ],
  afterGameplayWorks: [
    "Generate final art card-by-card",
    "Add sound/animation feedback",
    "Improve mobile drag/click behavior",
    "Add printable export later"
  ]
};
