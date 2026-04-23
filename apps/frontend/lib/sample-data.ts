import type {
  ActivePlayerSnapshot,
  HostSnapshot,
  JoinedWaitingSnapshot,
  PlacementStatus,
  PlayerSnapshot,
  RoundSummary
} from "@huegame/contracts";
import {
  GameStatus,
  MAX_PLACEMENT_CHIPS_PER_ROUND,
  PaletteAccessMode,
  RoundState,
  RoomStatus
} from "@huegame/contracts";

import { buildDemoPalette, findPaletteHex } from "./board";

const paletteCells = buildDemoPalette("demo:HUE123:game:1");
const target = { x: 14, y: 7 };
const targetColorHex = findPaletteHex(paletteCells, target.x, target.y);

const summary: RoundSummary = {
  roundNumber: 3,
  targetCellCode: "G14",
  categoryName: "Море и океан",
  outcomes: [
    {
      playerId: "p1",
      playerName: "Anna",
      stake: 0,
      payout: 12,
      newChips: 12,
      eliminated: false
    },
    {
      playerId: "p2",
      playerName: "Maks",
      stake: 2,
      payout: 24,
      newChips: 36,
      eliminated: false
    },
    {
      playerId: "p3",
      playerName: "Roma",
      stake: 1,
      payout: 0,
      newChips: 8,
      eliminated: false
    }
  ],
  placements: [
    {
      playerId: "p2",
      playerName: "Maks",
      x: 14,
      y: 7,
      status: "CENTER" as PlacementStatus,
      multiplier: 3
    },
    {
      playerId: "p2",
      playerName: "Maks",
      x: 12,
      y: 7,
      status: "EDGE" as PlacementStatus,
      multiplier: 1
    },
    {
      playerId: "p3",
      playerName: "Roma",
      x: 3,
      y: 13,
      status: "MISS" as PlacementStatus,
      multiplier: 0
    }
  ]
};

const base = {
  roomCode: "HUE123",
  roomStatus: RoomStatus.IN_GAME,
  gameStatus: GameStatus.ACTIVE,
  currentRoundNumber: 4,
  roundState: RoundState.VOTING_OPEN,
  roundStateEnteredAt: new Date().toISOString(),
  roundDeadlineAt: new Date(Date.now() + 10000).toISOString(),
  categoryName: "Море и океан",
  paletteAccessMode: PaletteAccessMode.STRICT,
  scoreboard: [
    {
      playerId: "p1",
      playerName: "Anna",
      joinOrder: 1,
      chips: 12,
      isConnected: true,
      isEliminated: false
    },
    {
      playerId: "p2",
      playerName: "Maks",
      joinOrder: 2,
      chips: 36,
      isConnected: true,
      isEliminated: false
    },
    {
      playerId: "p3",
      playerName: "Roma",
      joinOrder: 3,
      chips: 8,
      isConnected: false,
      isEliminated: false
    }
  ]
};

export const sampleHostSnapshot: HostSnapshot = {
  ...base,
  role: "host",
  hostConnected: true,
  settings: {
    roundsCount: 10,
    startChips: 0,
    showCellCodeToActivePlayer: true,
    allowCategoryRepeats: false,
    defaultLocale: "ru",
    playerPaletteAccessMode: PaletteAccessMode.STRICT,
    allConfirmedWindowMs: 10000,
    revealVotesMs: 3500,
    revealZoneMs: 3500,
    roundResultsMs: 4500,
    roundTransitionMs: 2500
  },
  activePlayerName: "Anna",
  paletteCells,
  roundStartBlockedAt: null,
  roundSummary: summary
};

export const samplePlayerSnapshot: PlayerSnapshot = {
  ...base,
  role: "player",
  playerId: "p2",
  playerName: "Maks",
  joinOrder: 2,
  chips: 36,
  paletteCells,
  reservedChips: 2,
  availableChips: MAX_PLACEMENT_CHIPS_PER_ROUND - 2,
  placementVersion: 5,
  confirmVersion: 5,
  isConfirmed: true,
  placements: [
    { x: 14, y: 7 },
    { x: 12, y: 7 }
  ],
  canParticipateNextRound: true,
  isConnected: true,
  isEliminated: false,
  actionPermissions: {
    canPlaceChip: true,
    canRemoveChip: true,
    canConfirmBet: true,
    canUnconfirmBet: true
  },
  roundSummary: null
};

export const sampleActivePlayerSnapshot: ActivePlayerSnapshot = {
  ...base,
  role: "active-player",
  playerId: "p1",
  playerName: "Anna",
  joinOrder: 1,
  chips: 12,
  targetCellCode: "G14",
  targetColorHex,
  categoryName: "Море и океан",
  canRevealCellCode: true,
  roundSummary: null
};

export const sampleJoinedWaitingSnapshot: JoinedWaitingSnapshot = {
  ...base,
  role: "joined-waiting",
  playerId: "p4",
  playerName: "Lena",
  joinOrder: 4,
  chips: 0,
  paletteCells,
  reservedChips: 0,
  availableChips: MAX_PLACEMENT_CHIPS_PER_ROUND,
  placementVersion: null,
  confirmVersion: null,
  isConfirmed: false,
  placements: [],
  waitingForRoundNumber: 5,
  actionPermissions: {
    canPlaceChip: false,
    canRemoveChip: false,
    canConfirmBet: false,
    canUnconfirmBet: false
  },
  roundSummary: null
};
