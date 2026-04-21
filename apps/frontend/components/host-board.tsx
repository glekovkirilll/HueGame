"use client";

import type { HostSnapshot, PlacementResolution } from "@huegame/contracts";

import {
  columns,
  findPaletteHex,
  getPlacementTone,
  isInsideRevealZone,
  parseCellCode,
  rows,
  shouldRevealPlacements,
  shouldRevealZone,
  toCellCode
} from "@/lib/board";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";

type HostBoardProps = {
  snapshot: HostSnapshot;
  locale: Locale;
};

function groupPlacements(placements: PlacementResolution[] | undefined) {
  const grouped = new Map<string, PlacementResolution[]>();

  for (const placement of placements ?? []) {
    const code = toCellCode(placement.x, placement.y);
    grouped.set(code, [...(grouped.get(code) ?? []), placement]);
  }

  return grouped;
}

export function HostBoard({ snapshot, locale }: HostBoardProps) {
  const copy = getCopy(locale);
  const target = parseCellCode(snapshot.roundSummary?.targetCellCode);
  const revealPlacements = shouldRevealPlacements(snapshot.roundState);
  const revealZone = shouldRevealZone(snapshot.roundState);
  const groupedPlacements = revealPlacements
    ? groupPlacements(snapshot.roundSummary?.placements)
    : new Map<string, PlacementResolution[]>();

  return (
    <section className="board-stage" aria-label={copy.host.board}>
      <div className="surface-title-row board-heading">
        <div>
          <h2>{copy.host.board}</h2>
          <span className="muted">
            {revealZone ? copy.host.zoneOpen : revealPlacements ? copy.host.revealOpen : copy.host.revealLocked}
          </span>
        </div>
        <div className="board-legend">
          <span><i className="legend-dot center" />x3</span>
          <span><i className="legend-dot near" />x2</span>
          <span><i className="legend-dot edge" />x1</span>
          <span><i className="legend-dot miss" />0</span>
        </div>
      </div>

      <div className="axis top-axis" aria-hidden="true">
        {columns.map((x) => (
          <span key={x}>{x}</span>
        ))}
      </div>

      <div className="host-board-wrap">
        <div className="axis left-axis" aria-hidden="true">
          {rows.map((y) => (
            <span key={y}>{toCellCode(1, y).slice(0, 1)}</span>
          ))}
        </div>
        <div className="host-board">
          {rows.flatMap((y) =>
            columns.map((x) => {
              const code = toCellCode(x, y);
              const placements = groupedPlacements.get(code) ?? [];
              const placementTone = placements.length > 0 ? getPlacementTone(placements) : null;
              const inZone = revealZone && isInsideRevealZone(x, y, target);
              const isTarget = target?.x === x && target.y === y;
              const hex = findPaletteHex(snapshot.paletteCells, x, y) ?? "#d7dde5";
              const title = placements.length > 0
                ? `${code}: ${placements.map((placement) => placement.playerName ?? placement.playerId ?? "?").join(", ")}`
                : code;

              return (
                <div
                  className={[
                    "host-cell",
                    inZone ? "in-zone" : "",
                    isTarget ? "is-target" : "",
                    placementTone ? `has-placement tone-${placementTone}` : ""
                  ].join(" ")}
                  key={code}
                  style={{ backgroundColor: hex }}
                  title={title}
                >
                  {placements.length > 0 ? <span>{placements.length}</span> : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
