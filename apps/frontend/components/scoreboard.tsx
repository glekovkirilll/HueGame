"use client";

import type { ScoreboardEntry } from "@huegame/contracts";

import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";

type ScoreboardProps = {
  entries: ScoreboardEntry[];
  locale: Locale;
};

export function Scoreboard({ entries, locale }: ScoreboardProps) {
  const copy = getCopy(locale);
  const sorted = [...entries].sort((left, right) => right.chips - left.chips || left.joinOrder - right.joinOrder);

  return (
    <section className="surface compact-surface" aria-label={copy.common.leaderboard}>
      <div className="surface-title-row">
        <h2>{copy.common.leaderboard}</h2>
        <span className="muted">{entries.length}/15</span>
      </div>
      <div className="score-list">
        {sorted.map((entry, index) => (
          <article className="score-row" key={entry.playerId}>
            <span className="rank">{index + 1}</span>
            <div>
              <strong>{entry.playerName}</strong>
              <span className="muted">
                {entry.isEliminated
                  ? copy.common.eliminated
                  : entry.isConnected
                    ? copy.common.connected
                    : copy.common.disconnected}
              </span>
            </div>
            <b>{entry.chips}</b>
          </article>
        ))}
      </div>
    </section>
  );
}
