import {
  BOARD_HEIGHT,
  BOARD_ROW_LABELS,
  BOARD_WIDTH,
  RoundState,
  type PaletteCell,
  type PlacementResolution
} from "@huegame/contracts";

export const columns = Array.from({ length: BOARD_WIDTH }, (_, index) => index + 1);
export const rows = Array.from({ length: BOARD_HEIGHT }, (_, index) => index + 1);

export function toCellCode(x: number, y: number): string {
  return `${BOARD_ROW_LABELS[y - 1] ?? "?"}${x}`;
}

export function parseCellCode(code: string | null | undefined): { x: number; y: number } | null {
  if (!code) {
    return null;
  }

  const row = code.slice(0, 1).toUpperCase();
  const x = Number(code.slice(1));
  const y = BOARD_ROW_LABELS.findIndex((label) => label === row) + 1;

  if (!Number.isInteger(x) || x < 1 || x > BOARD_WIDTH || y < 1 || y > BOARD_HEIGHT) {
    return null;
  }

  return { x, y };
}

export function findPaletteHex(cells: PaletteCell[], x: number, y: number): string | null {
  return cells.find((cell) => cell.x === x && cell.y === y)?.hex ?? null;
}

export function shouldRevealPlacements(state: RoundState | null): boolean {
  return (
    state === RoundState.REVEAL_VOTES ||
    state === RoundState.REVEAL_ZONE ||
    state === RoundState.ROUND_RESULTS ||
    state === RoundState.ROUND_TRANSITION ||
    state === RoundState.GAME_FINISHED
  );
}

export function shouldRevealZone(state: RoundState | null): boolean {
  return (
    state === RoundState.REVEAL_ZONE ||
    state === RoundState.ROUND_RESULTS ||
    state === RoundState.ROUND_TRANSITION ||
    state === RoundState.GAME_FINISHED
  );
}

export function isInsideRevealZone(x: number, y: number, target: { x: number; y: number } | null): boolean {
  if (!target) {
    return false;
  }

  return Math.max(Math.abs(x - target.x), Math.abs(y - target.y)) <= 2;
}

export function getPlacementTone(placements: PlacementResolution[]): string {
  if (placements.some((placement) => placement.status === "CENTER")) {
    return "center";
  }

  if (placements.some((placement) => placement.status === "NEAR")) {
    return "near";
  }

  if (placements.some((placement) => placement.status === "EDGE")) {
    return "edge";
  }

  return "miss";
}

function toHex(channel: number): string {
  return channel.toString(16).padStart(2, "0");
}

function rgbToHex(color: { red: number; green: number; blue: number }): string {
  return `#${toHex(Math.round(color.red))}${toHex(Math.round(color.green))}${toHex(Math.round(color.blue))}`;
}

function interpolateColor(
  left: { red: number; green: number; blue: number },
  right: { red: number; green: number; blue: number },
  ratio: number
) {
  return {
    red: left.red + (right.red - left.red) * ratio,
    green: left.green + (right.green - left.green) * ratio,
    blue: left.blue + (right.blue - left.blue) * ratio
  };
}

export function buildDemoPalette(seed: string): PaletteCell[] {
  void seed;
  const topLeft = { red: 225, green: 48, blue: 58 };
  const topRight = { red: 246, green: 214, blue: 57 };
  const bottomLeft = { red: 37, green: 91, blue: 216 };
  const bottomRight = { red: 28, green: 172, blue: 93 };

  return rows.flatMap((y) =>
    columns.map((x) => {
      const columnRatio = (x - 1) / (BOARD_WIDTH - 1);
      const rowRatio = (y - 1) / (BOARD_HEIGHT - 1);
      const top = interpolateColor(topLeft, topRight, columnRatio);
      const bottom = interpolateColor(bottomLeft, bottomRight, columnRatio);

      return {
        x,
        y,
        hex: rgbToHex(interpolateColor(top, bottom, rowRatio))
      };
    })
  );
}
