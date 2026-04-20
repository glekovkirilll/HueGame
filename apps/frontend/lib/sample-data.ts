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
  PaletteAccessMode,
  RoundState,
  RoomStatus
} from "@huegame/contracts";

const summary: RoundSummary = {
  roundNumber: 3,
  targetCellCode: "G14",
  categoryName: "Море и океан",
  outcomes: [
    {
      playerId: "p1",
      playerName: "Anna",
      stake: 2,
      payout: 3,
      newChips: 9,
      eliminated: false
    },
    {
      playerId: "p2",
      playerName: "Maks",
      stake: 1,
      payout: 0,
      newChips: 4,
      eliminated: false
    }
  ],
  placements: [
    {
      x: 14,
      y: 7,
      status: "CENTER" as PlacementStatus,
      multiplier: 3
    },
    {
      x: 12,
      y: 7,
      status: "EDGE" as PlacementStatus,
      multiplier: 1
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
      chips: 9,
      isConnected: true,
      isEliminated: false
    },
    {
      playerId: "p2",
      playerName: "Maks",
      joinOrder: 2,
      chips: 4,
      isConnected: true,
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
    startChips: 10,
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
  roundStartBlockedAt: null,
  roundSummary: summary
};

export const samplePlayerSnapshot: PlayerSnapshot = {
  ...base,
  role: "player",
  playerId: "p2",
  playerName: "Maks",
  joinOrder: 2,
  chips: 4,
  reservedChips: 1,
  availableChips: 3,
  placementVersion: 5,
  confirmVersion: 5,
  isConfirmed: true,
  placements: [{ x: 12, y: 7 }],
  canParticipateNextRound: true,
  isConnected: true,
  isEliminated: false,
  actionPermissions: {
    canPlaceChip: true,
    canRemoveChip: true,
    canConfirmBet: true,
    canUnconfirmBet: true
  },
  roundSummary: summary
};

export const sampleActivePlayerSnapshot: ActivePlayerSnapshot = {
  ...base,
  role: "active-player",
  playerId: "p1",
  playerName: "Anna",
  joinOrder: 1,
  chips: 9,
  targetCellCode: "G14",
  categoryName: "Море и океан",
  canRevealCellCode: true,
  roundSummary: summary
};

export const sampleJoinedWaitingSnapshot: JoinedWaitingSnapshot = {
  ...base,
  role: "joined-waiting",
  playerId: "p3",
  playerName: "Roma",
  joinOrder: 3,
  chips: 10,
  reservedChips: 0,
  availableChips: 10,
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
  roundSummary: summary
};
