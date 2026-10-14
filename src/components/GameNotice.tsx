import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import "./DecisionControls.css";

export function GameNotice({ className, children }: { className: string; children: ReactNode }) {
  return <div className={`game-notice ${className}`} role="status"><CircleAlert size={17} aria-hidden="true" /><p>{children}</p></div>;
}
