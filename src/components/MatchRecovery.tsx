import { Component, type ReactNode } from "react";
import { SAVE_KEY } from "../game/persistence";
import "./MatchRecovery.css";

export function exportMatch(raw: string) {
  const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = "outdrawn-match-recovery.json"; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function preserveRejectedMatch(raw: string) {
  try { localStorage.setItem(`${SAVE_KEY}-recovery`, raw); } catch { /* Download remains available even when storage is full. */ }
}
export function MatchRecovery({ raw, onReset }: { raw: string | null; onReset: () => void }) {
  return <main className="match-recovery"><section>
    <img src="/optimized/branding/logos/outdrawn-logo-dark-01.webp" alt="Outdrawn" width="180" />
    <h1>This match couldn't be opened</h1>
    <p>Your saved data has been kept. Download a copy before starting fresh if you want to recover it later.</p>
    <div>{raw && <button type="button" onClick={() => exportMatch(raw)}>Download saved match</button>}<button type="button" onClick={onReset}>Start fresh</button></div>
  </section></main>;
}
export class MatchErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    let raw: string | null = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch { /* Storage may be unavailable. */ }
    return <MatchRecovery raw={raw} onReset={() => {
      if (raw) preserveRejectedMatch(raw);
      try { localStorage.removeItem(SAVE_KEY); } catch { /* Reload still offers the recovery screen if removal failed. */ }
      window.location.reload();
    }} />;
  }
}
