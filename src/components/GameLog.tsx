import type { LogEntry } from "../game/types";

export function GameLog({ entries }: { entries: LogEntry[] }) {
  return (
    <aside className="game-log">
      <h2>Log</h2>
      <ol>
        {entries
          .slice()
          .reverse()
          .map((entry) => (
            <li key={entry.id}>
              <span>R{entry.round}</span>
              {entry.message}
            </li>
          ))}
      </ol>
    </aside>
  );
}
