/** Historical IDs in v1 saves. Instance IDs remain unchanged to preserve references. */
const legacyCardIds: Readonly<Record<string, string>> = {
  defense_decoy: "defense_ricochet",
  defense_fake_death: "defense_revive",
  event_high_ground: "event_scavenge"
};

export function canonicalCardId(id: string): string {
  return Object.hasOwn(legacyCardIds, id) ? legacyCardIds[id] : id;
}
