export const BOARD_WIDTH = 30;
export const BOARD_HEIGHT = 15;
export const BOARD_ROW_LABELS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O"
] as const;

export enum RoomStatus {
  LOBBY = "LOBBY",
  STARTING = "STARTING",
  IN_GAME = "IN_GAME",
  FINISHED = "FINISHED",
  ARCHIVED = "ARCHIVED"
}

export enum GameStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED"
}

export enum RoundState {
  PREPARE_ROUND = "PREPARE_ROUND",
  CLUE_VISIBLE = "CLUE_VISIBLE",
  VOTING_OPEN = "VOTING_OPEN",
  ALL_CONFIRMED_PENDING_FINALIZE = "ALL_CONFIRMED_PENDING_FINALIZE",
  REVEAL_VOTES = "REVEAL_VOTES",
  REVEAL_ZONE = "REVEAL_ZONE",
  ROUND_RESULTS = "ROUND_RESULTS",
  ROUND_TRANSITION = "ROUND_TRANSITION",
  GAME_FINISHED = "GAME_FINISHED"
}

export enum PlayerConnectionState {
  CONNECTED = "CONNECTED",
  DISCONNECTED = "DISCONNECTED"
}

export enum PlayerLifecycleState {
  ACTIVE = "ACTIVE",
  ELIMINATED = "ELIMINATED"
}

export enum RoundRole {
  ACTIVE_PLAYER = "ACTIVE_PLAYER",
  VOTER = "VOTER"
}

export enum PlacementStatus {
  DRAFT = "DRAFT",
  LOCKED = "LOCKED",
  MISS = "MISS",
  EDGE = "EDGE",
  NEAR = "NEAR",
  CENTER = "CENTER"
}

export enum SkippedReason {
  ACTIVE_PLAYER = "ACTIVE_PLAYER",
  DISCONNECTED_DURING_VOTING = "DISCONNECTED_DURING_VOTING",
  NO_PLACEMENTS_AT_CLOSE = "NO_PLACEMENTS_AT_CLOSE"
}

export enum PaletteAccessMode {
  STRICT = "STRICT",
  RELAXED = "RELAXED"
}

export enum QuorumStatus {
  NOT_REQUIRED = "NOT_REQUIRED",
  BLOCKING = "BLOCKING",
  SATISFIED = "SATISFIED",
  EXCLUDED = "EXCLUDED"
}

export type Coordinate = {
  x: number;
  y: number;
};

export type PlacementDraft = {
  x: number;
  y: number;
};

export type PlacementResolution = {
  x: number;
  y: number;
  status: PlacementStatus;
  multiplier: number;
};

export type PlayerRoundOutcome = {
  playerId: string;
  playerName: string;
  stake: number;
  payout: number;
  newChips: number;
  eliminated: boolean;
};

export type RoundSummary = {
  roundNumber: number;
  targetCellCode: string;
  categoryName: string | null;
  outcomes: PlayerRoundOutcome[];
  placements: PlacementResolution[];
};

export type ScoreboardEntry = {
  playerId: string;
  playerName: string;
  joinOrder: number;
  chips: number;
  isConnected: boolean;
  isEliminated: boolean;
};

export type BaseRoomSnapshot = {
  roomCode: string;
  roomStatus: RoomStatus;
  gameStatus: GameStatus | null;
  currentRoundNumber: number;
  roundState: RoundState | null;
  roundStateEnteredAt: string | null;
  roundDeadlineAt: string | null;
  categoryName: string | null;
  paletteAccessMode: PaletteAccessMode;
  scoreboard: ScoreboardEntry[];
};

export type RoundActionPermissions = {
  canPlaceChip: boolean;
  canRemoveChip: boolean;
  canConfirmBet: boolean;
  canUnconfirmBet: boolean;
};

export type HostSnapshot = BaseRoomSnapshot & {
  role: "host";
  hostConnected: boolean;
  settings: RoomSettingsDefaults;
  activePlayerName: string | null;
  roundStartBlockedAt: string | null;
  roundSummary: RoundSummary | null;
};

export type PlayerSnapshot = BaseRoomSnapshot & {
  role: "player";
  playerId: string;
  playerName: string;
  joinOrder: number;
  chips: number;
  reservedChips: number;
  availableChips: number;
  placementVersion: number | null;
  confirmVersion: number | null;
  isConfirmed: boolean;
  placements: PlacementDraft[];
  canParticipateNextRound: boolean;
  isConnected: boolean;
  isEliminated: boolean;
  actionPermissions: RoundActionPermissions;
  roundSummary: RoundSummary | null;
};

export type ActivePlayerSnapshot = BaseRoomSnapshot & {
  role: "active-player";
  playerId: string;
  playerName: string;
  joinOrder: number;
  chips: number;
  targetCellCode: string | null;
  categoryName: string | null;
  canRevealCellCode: boolean;
  roundSummary: RoundSummary | null;
};

export type JoinedWaitingSnapshot = BaseRoomSnapshot & {
  role: "joined-waiting";
  playerId: string;
  playerName: string;
  joinOrder: number;
  chips: number;
  reservedChips: number;
  availableChips: number;
  placementVersion: number | null;
  confirmVersion: number | null;
  isConfirmed: boolean;
  placements: PlacementDraft[];
  waitingForRoundNumber: number;
  actionPermissions: RoundActionPermissions;
  roundSummary: RoundSummary | null;
};

export type RoomRoleSnapshot =
  | HostSnapshot
  | PlayerSnapshot
  | ActivePlayerSnapshot
  | JoinedWaitingSnapshot;

export type PaletteCell = {
  x: number;
  y: number;
  hex: string;
};

export type RoomSettingsDefaults = {
  roundsCount: number;
  startChips: number;
  showCellCodeToActivePlayer: boolean;
  allowCategoryRepeats: boolean;
  defaultLocale: "ru" | "en";
  playerPaletteAccessMode: PaletteAccessMode;
  allConfirmedWindowMs: number;
  revealVotesMs: number;
  revealZoneMs: number;
  roundResultsMs: number;
  roundTransitionMs: number;
};

export const DEFAULT_ROOM_SETTINGS: RoomSettingsDefaults = {
  roundsCount: 10,
  startChips: 10,
  showCellCodeToActivePlayer: true,
  allowCategoryRepeats: false,
  defaultLocale: "ru",
  playerPaletteAccessMode: PaletteAccessMode.STRICT,
  allConfirmedWindowMs: 10_000,
  revealVotesMs: 3_500,
  revealZoneMs: 3_500,
  roundResultsMs: 4_500,
  roundTransitionMs: 2_500
};
