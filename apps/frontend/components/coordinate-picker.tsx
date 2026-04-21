"use client";

import { useMemo, useState } from "react";

import type { PlacementDraft, RoundActionPermissions } from "@huegame/contracts";

import { columns, rows, toCellCode } from "@/lib/board";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";

type CoordinatePickerProps = {
  locale: Locale;
  placements: PlacementDraft[];
  availableChips: number;
  reservedChips: number;
  permissions: RoundActionPermissions;
  loading: boolean;
  onPlace: (x: number, y: number) => void;
  onRemove: (x: number, y: number) => void;
  onConfirm: () => void;
  onUnconfirm: () => void;
  isConfirmed: boolean;
};

export function CoordinatePicker({
  locale,
  placements,
  availableChips,
  reservedChips,
  permissions,
  loading,
  onPlace,
  onRemove,
  onConfirm,
  onUnconfirm,
  isConfirmed
}: CoordinatePickerProps) {
  const copy = getCopy(locale);
  const [selected, setSelected] = useState({ x: 14, y: 7 });
  const placementCodes = useMemo(
    () => new Set(placements.map((placement) => toCellCode(placement.x, placement.y))),
    [placements]
  );
  const selectedCode = toCellCode(selected.x, selected.y);
  const selectedAlreadyPlaced = placementCodes.has(selectedCode);
  const canPlace = permissions.canPlaceChip && !selectedAlreadyPlaced && availableChips > 0;
  const canRemove = permissions.canRemoveChip && selectedAlreadyPlaced;
  const canConfirm = permissions.canConfirmBet && placements.length > 0;

  return (
    <section className="mobile-play-surface">
      <div className="surface-title-row">
        <div>
          <h2>{copy.player.chooseCell}</h2>
          <span className="muted">{copy.player.noFullBoard}</span>
        </div>
        <span className={isConfirmed ? "state-pill good" : "state-pill warn"}>
          {isConfirmed ? copy.player.confirmed : copy.player.notConfirmed}
        </span>
      </div>

      <div className="chip-economy">
        <div>
          <span>{copy.common.available}</span>
          <strong>{availableChips}</strong>
        </div>
        <div>
          <span>{copy.common.reserved}</span>
          <strong>{reservedChips}</strong>
        </div>
        <div>
          <span>{copy.common.selected}</span>
          <strong>{selectedCode}</strong>
        </div>
      </div>

      <div className="coordinate-controls" aria-label={copy.player.chooseCell}>
        <div className="coordinate-row x-row">
          {columns.map((x) => (
            <button
              className={selected.x === x ? "coordinate-button is-selected" : "coordinate-button"}
              key={x}
              onClick={() => setSelected((current) => ({ ...current, x }))}
              type="button"
            >
              {x}
            </button>
          ))}
        </div>
        <div className="coordinate-row y-row">
          {rows.map((y) => (
            <button
              className={selected.y === y ? "coordinate-button is-selected" : "coordinate-button"}
              key={y}
              onClick={() => setSelected((current) => ({ ...current, y }))}
              type="button"
            >
              {toCellCode(1, y).slice(0, 1)}
            </button>
          ))}
        </div>
      </div>

      <div className="mini-coordinate-grid">
        {rows.flatMap((y) =>
          columns.map((x) => {
            const code = toCellCode(x, y);
            const isPlaced = placementCodes.has(code);
            const isSelected = selected.x === x && selected.y === y;

            return (
              <button
                aria-label={code}
                className={[
                  "mini-cell",
                  isPlaced ? "is-placed" : "",
                  isSelected ? "is-selected" : ""
                ].join(" ")}
                key={code}
                onClick={() => setSelected({ x, y })}
                type="button"
              >
                {isPlaced ? "•" : ""}
              </button>
            );
          })
        )}
      </div>

      <div className="action-row">
        <button className="primary-button" disabled={loading || !canPlace} onClick={() => onPlace(selected.x, selected.y)} type="button">
          {copy.common.add}
        </button>
        <button className="ghost-button" disabled={loading || !canRemove} onClick={() => onRemove(selected.x, selected.y)} type="button">
          {copy.common.remove}
        </button>
      </div>

      <div className="selected-list" aria-label={copy.common.placements}>
        {placements.length === 0 ? (
          <span className="muted">{copy.player.cannotBet}</span>
        ) : (
          placements.map((placement) => (
            <button
              className="placement-token"
              key={toCellCode(placement.x, placement.y)}
              onClick={() => setSelected({ x: placement.x, y: placement.y })}
              type="button"
            >
              {toCellCode(placement.x, placement.y)}
            </button>
          ))
        )}
      </div>

      <div className="action-row">
        <button className="primary-button wide" disabled={loading || !canConfirm} onClick={onConfirm} type="button">
          {copy.common.confirm}
        </button>
        <button className="ghost-button wide" disabled={loading || !permissions.canUnconfirmBet} onClick={onUnconfirm} type="button">
          {copy.common.unconfirm}
        </button>
      </div>
      <p className="fine-print">{copy.player.confirmHint}</p>
    </section>
  );
}
