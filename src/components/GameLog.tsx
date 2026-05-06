import type { LogEntry } from "../game/types";
import { getCardDefinitionById } from "../game/rules";

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
    </aside>
  );
}
