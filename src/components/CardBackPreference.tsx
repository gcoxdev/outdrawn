import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import cardBacks from "../data/cardBacks.json";

export const cardBackOptions = cardBacks.map(back => ({ ...back, image: `/optimized/cards/backs/${back.file}.webp` }));
const storageKey = "outdrawn-card-back-v1";
const defaultBack = cardBackOptions[0];
const CardBackContext = createContext({ cardBack: defaultBack, selectCardBack: (_id: string) => {} });

export function CardBackProvider({ children }: { children: ReactNode }) {
  const [cardBack, setCardBack] = useState(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return cardBackOptions.find(back => back.id === saved) ?? defaultBack;
    } catch { return defaultBack; }
  });
  const value = useMemo(() => ({
    cardBack,
    selectCardBack(id: string) {
      const next = cardBackOptions.find(back => back.id === id);
      if (!next) return;
      setCardBack(next);
      // Keep the preference usable for this visit when browser storage is unavailable.
      try { window.localStorage.setItem(storageKey, next.id); } catch {}
    }
  }), [cardBack]);
  return <CardBackContext.Provider value={value}>{children}</CardBackContext.Provider>;
}

export function useCardBack() { return useContext(CardBackContext); }
