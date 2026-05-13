import { X } from "lucide-react";
import { useMemo, useState } from "react";
import type { LogEntry } from "../game/types";
import { getCardDefinitionById } from "../game/rules";

const maxRenderedLogEntries = 250;

type GameLogProps = {
  entries: LogEntry[];
  players: Array<{ id: string; name: string }>;
};

export function GameLog({ entries, players }: GameLogProps) {
  const [playerFilter, setPlayerFilter] = useState("");
  const [textFilter, setTextFilter] = useState("");
  const hasFilter = Boolean(playerFilter || textFilter.trim());
  const filteredEntries = useMemo(() => {
    const normalizedText = textFilter.trim().toLowerCase();
    const selectedPlayerName = players.find((player) => player.id === playerFilter)?.name.toLowerCase() ?? "";
    const sourceEntries = hasFilter ? entries : entries.slice(-maxRenderedLogEntries);

    return sourceEntries.filter((entry) => {
      const message = entry.message.toLowerCase();
      const matchesPlayer = !selectedPlayerName || message.includes(selectedPlayerName);
      const matchesText = !normalizedText || message.includes(normalizedText);
      return matchesPlayer && matchesText;
    });
  }, [entries, hasFilter, playerFilter, players, textFilter]);
  const visibleEntries = hasFilter ? filteredEntries.slice(-maxRenderedLogEntries).reverse() : [...filteredEntries].reverse();

  return (
    <aside className="game-log">
      <div className="game-log__header">
        <h2>Log</h2>
        <span>
          {filteredEntries.length}/{entries.length}
        </span>
      </div>
      <div className="log-filter" aria-label="Log filters">
        <label>
          <span>Player</span>
          <select value={playerFilter} onChange={(event) => setPlayerFilter(event.target.value)}>
            <option value="">All players</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Search</span>
          <input value={textFilter} onChange={(event) => setTextFilter(event.target.value)} placeholder="damage, stole, revive..." />
        </label>
        {hasFilter && (
          <button
            className="log-filter__clear"
            type="button"
            onClick={() => {
              setPlayerFilter("");
              setTextFilter("");
            }}
            aria-label="Clear log filters"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <ol>
        {visibleEntries.map((entry) => (
            <li key={entry.id}>
              <div>
                <span>R{entry.round}</span>
                {entry.message}
              </div>
              {entry.handSnapshots.length > 0 && (
                <details className="log-hands">
                  <summary>Hands at this moment</summary>
                  <div className="log-hands__grid">
                    {entry.handSnapshots.map((snapshot) => (
                      <section className="log-hand" key={snapshot.playerId}>
                        <h3>
                          {snapshot.playerName}
                          <span>{snapshot.health} HP</span>
                        </h3>
                        <p>
                          {snapshot.cards.length > 0
                            ? snapshot.cards.map((card) => getCardDefinitionById(card.definitionId)?.name ?? "Unknown").join(", ")
                            : "No cards"}
                        </p>
                      </section>
                    ))}
                  </div>
                </details>
              )}
            </li>
          ))}
      </ol>
      {hasFilter && filteredEntries.length > maxRenderedLogEntries && (
        <p className="log-empty">Showing latest {maxRenderedLogEntries} matching entries. Use filters to narrow the log.</p>
      )}
      {filteredEntries.length === 0 && <p className="log-empty">No log entries match these filters.</p>}
    </aside>
  );
}
