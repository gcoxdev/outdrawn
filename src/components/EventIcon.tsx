import { createLucideIcon } from "lucide-react";

/** The hexagonal warning emblem printed on event cards. */
export const EventIcon = createLucideIcon("EventIcon", [
  ["polygon", { points: "12 2 21 7 21 17 12 22 3 17 3 7", key: "hexagon" }],
  ["path", { d: "M12 7v6", key: "exclamation" }],
  ["path", { d: "M12 17h.01", key: "dot" }]
]);
