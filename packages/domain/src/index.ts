import {
  type ActivePlayerSnapshot,
  BOARD_HEIGHT,
  BOARD_ROW_LABELS,
  BOARD_WIDTH,
  DEFAULT_ROOM_SETTINGS,
  GameStatus,
  type HostSnapshot,
  type JoinedWaitingSnapshot,
  PaletteAccessMode,
  PlacementStatus,
  type PlacementDraft,
  type PlacementResolution,
  PlayerConnectionState,
  PlayerLifecycleState,
  type PlayerSnapshot,
  type PlayerRoundOutcome,
  type RoundSummary,
  type RoundActionPermissions,
  RoundRole,
  RoundState,
  RoomStatus,
  type ScoreboardEntry
} from "@huegame/contracts";
import type { PaletteCell } from "@huegame/contracts";

export type QueuePlayer = {
  id: string;
  joinOrder: number;
  connectionState: PlayerConnectionState;
  lifecycleState: PlayerLifecycleState;
  canParticipateNextRound: boolean;
};

export type ParticipantConfirmationState = {
  reservedChips: number;
  placementVersion: number;
  confirmVersion: number | null;
};

export function isValidCellCoordinate(x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 1 && x <= BOARD_WIDTH && y >= 1 && y <= BOARD_HEIGHT;
}

export function toCellCode(x: number, y: number): string {
  if (!isValidCellCoordinate(x, y)) {
    throw new Error(`Invalid cell coordinate: (${x}, ${y}).`);
  }

  return `${BOARD_ROW_LABELS[y - 1]}${x}`;
}

export function normalizePlayerName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");
}

export function sanitizeDisplayName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function calculateAvailableChips(resolvedChips: number, reservedChips: number): number {
  return resolvedChips - reservedChips;
}

export function canConfirmBet(state: ParticipantConfirmationState): boolean {
  return state.reservedChips >= 1;
}

export function isParticipantConfirmed(state: ParticipantConfirmationState): boolean {
  return state.reservedChips >= 1 && state.confirmVersion !== null && state.confirmVersion === state.placementVersion;
}

export function nextPlacementVersion(currentPlacementVersion: number): number {
  return currentPlacementVersion + 1;
}

export function selectNextActivePlayer(players: QueuePlayer[], lastActiveJoinOrder: number | null): QueuePlayer | null {
  const eligiblePlayers = players
    .filter((player) => player.lifecycleState === PlayerLifecycleState.ACTIVE && player.canParticipateNextRound)
    .sort((left, right) => left.joinOrder - right.joinOrder);

  const roundReadyPlayers = eligiblePlayers.filter(
    (player) => player.connectionState === PlayerConnectionState.CONNECTED
  );

  if (roundReadyPlayers.length < 2) {
    return null;
  }

  if (eligiblePlayers.length === 0) {
    return null;
  }

  const startIndex =
    lastActiveJoinOrder === null
      ? 0
      : eligiblePlayers.findIndex((player) => player.joinOrder > lastActiveJoinOrder);

  const normalizedStartIndex = startIndex === -1 ? 0 : startIndex;

  for (let offset = 0; offset < eligiblePlayers.length; offset += 1) {
    const candidate = eligiblePlayers[(normalizedStartIndex + offset) % eligiblePlayers.length];

    if (candidate.connectionState === PlayerConnectionState.CONNECTED) {
      return candidate;
    }
  }

  return null;
}

export function createRoomSettingsDefaults() {
  return { ...DEFAULT_ROOM_SETTINGS };
}

function buildActionPermissions(roundState: RoundState | null, isWaiting: boolean): RoundActionPermissions {
  const votingOpen = roundState === RoundState.VOTING_OPEN && !isWaiting;

  return {
    canPlaceChip: votingOpen,
    canRemoveChip: votingOpen,
    canConfirmBet: votingOpen,
    canUnconfirmBet: votingOpen
  };
}

export function buildScoreboardEntries(
  players: Array<{
    id: string;
    name: string;
    joinOrder: number;
    chips: number;
    connectionState: PlayerConnectionState;
    lifecycleState: PlayerLifecycleState;
  }>
): ScoreboardEntry[] {
  return [...players]
    .sort((left, right) => left.joinOrder - right.joinOrder)
    .map((player) => ({
      playerId: player.id,
      playerName: player.name,
      joinOrder: player.joinOrder,
      chips: player.chips,
      isConnected: player.connectionState === PlayerConnectionState.CONNECTED,
      isEliminated: player.lifecycleState === PlayerLifecycleState.ELIMINATED
    }));
}

type SnapshotRoomShape = {
  code: string;
  status: RoomStatus;
  settings: {
    roundsCount: number;
    startChips: number;
    showCellCodeToActivePlayer: boolean;
    allowCategoryRepeats: boolean;
    defaultLocale: "ru" | "en" | string;
    playerPaletteAccessMode: PaletteAccessMode;
    allConfirmedWindowMs: number;
    revealVotesMs: number;
    revealZoneMs: number;
    roundResultsMs: number;
    roundTransitionMs: number;
  } | null;
  players: Array<{
    id: string;
    name: string;
    joinOrder: number;
    chips: number;
    canParticipateNextRound: boolean;
    connectionState: PlayerConnectionState;
    lifecycleState: PlayerLifecycleState;
    placements: Array<{
      roundId: string;
      x: number;
      y: number;
      status: string;
    }>;
  }>;
  currentGame: {
    status: GameStatus;
    currentRoundNumber: number;
    roundStartBlockedAt: Date | null;
    rounds: Array<{
      id: string;
      activePlayerId: string;
      state: RoundState;
      stateEnteredAt: Date;
      phaseDeadlineAt: Date | null;
      targetCellX: number;
      targetCellY: number;
      summaryJson: unknown;
      participants: Array<{
        playerId: string;
        role: RoundRole;
        placementVersion: number;
        confirmVersion: number | null;
      }>;
      category: {
        nameRu: string;
        nameEn: string;
      };
      activePlayer: {
        name: string;
      };
    }>;
  } | null;
  hostSession: {
    connectionState: PlayerConnectionState;
  } | null;
};

function toIsoStringOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function getCurrentRound(room: SnapshotRoomShape) {
  return room.currentGame?.rounds[0] ?? null;
}

function canRevealRoundSummary(room: SnapshotRoomShape): boolean {
  const currentRound = getCurrentRound(room);

  if (!currentRound) {
    return false;
  }

  return [
    RoundState.REVEAL_ZONE,
    RoundState.ROUND_RESULTS,
    RoundState.ROUND_TRANSITION,
    RoundState.GAME_FINISHED
  ].includes(currentRound.state) || room.status === RoomStatus.FINISHED;
}

function getRoundSummary(room: SnapshotRoomShape, visible: boolean): RoundSummary | null {
  const currentRound = getCurrentRound(room);

  if (!currentRound?.summaryJson || !visible) {
    return null;
  }

  return currentRound.summaryJson as RoundSummary;
}

function getParticipantState(room: SnapshotRoomShape, playerId: string) {
  const currentRound = getCurrentRound(room);
  return currentRound?.participants.find((participant) => participant.playerId === playerId) ?? null;
}

function getPlayerPlacements(room: SnapshotRoomShape, playerId: string): PlacementDraft[] {
  const currentRound = getCurrentRound(room);

  if (!currentRound) {
    return [];
  }

  const player = room.players.find((candidate) => candidate.id === playerId);
  const placements =
    player?.placements.filter(
      (placement) => placement.roundId === currentRound.id && placement.status === "DRAFT"
    ) ?? [];

  return placements.map((placement) => ({
    x: placement.x,
    y: placement.y
  }));
}

function getCategoryName(
  room: SnapshotRoomShape,
  currentRound: NonNullable<ReturnType<typeof getCurrentRound>>
): string {
  const locale = room.settings?.defaultLocale === "en" ? "en" : "ru";

  return locale === "en" ? currentRound.category.nameEn : currentRound.category.nameRu;
}

export function buildHostSnapshotFromRoom(room: SnapshotRoomShape): HostSnapshot {
  const currentRound = getCurrentRound(room);
  const settings = room.settings ?? createRoomSettingsDefaults();
  const categoryName = currentRound ? getCategoryName(room, currentRound) : null;
  const roundSummary = getRoundSummary(room, true);

  return {
    role: "host",
    roomCode: room.code,
    roomStatus: room.status,
    gameStatus: room.currentGame?.status ?? null,
    currentRoundNumber: room.currentGame?.currentRoundNumber ?? 0,
    roundState: currentRound?.state ?? null,
    roundStateEnteredAt: toIsoStringOrNull(currentRound?.stateEnteredAt),
    roundDeadlineAt: toIsoStringOrNull(currentRound?.phaseDeadlineAt),
    categoryName,
    paletteAccessMode: settings.playerPaletteAccessMode,
    scoreboard: buildScoreboardEntries(room.players),
    hostConnected: room.hostSession?.connectionState === PlayerConnectionState.CONNECTED,
    settings: {
      roundsCount: settings.roundsCount,
      startChips: settings.startChips,
      showCellCodeToActivePlayer: settings.showCellCodeToActivePlayer,
      allowCategoryRepeats: settings.allowCategoryRepeats,
      defaultLocale: settings.defaultLocale === "en" ? "en" : "ru",
      playerPaletteAccessMode: settings.playerPaletteAccessMode,
      allConfirmedWindowMs: settings.allConfirmedWindowMs,
      revealVotesMs: settings.revealVotesMs,
      revealZoneMs: settings.revealZoneMs,
      roundResultsMs: settings.roundResultsMs,
      roundTransitionMs: settings.roundTransitionMs
    },
    activePlayerName: currentRound?.activePlayer.name ?? null,
    roundStartBlockedAt: toIsoStringOrNull(room.currentGame?.roundStartBlockedAt),
    roundSummary
  };
}

export function buildPlayerSnapshotFromRoom(
  room: SnapshotRoomShape,
  player: {
    id: string;
    name: string;
    joinOrder: number;
    chips: number;
    canParticipateNextRound: boolean;
    connectionState: PlayerConnectionState;
    lifecycleState: PlayerLifecycleState;
  }
): PlayerSnapshot {
  const currentRound = getCurrentRound(room);
  const settings = room.settings ?? createRoomSettingsDefaults();
  const categoryName = currentRound ? getCategoryName(room, currentRound) : null;
  const participant = getParticipantState(room, player.id);
  const placements = getPlayerPlacements(room, player.id);
  const reservedChips = placements.length;
  const availableChips = calculateAvailableChips(player.chips, reservedChips);
  const confirmationState: ParticipantConfirmationState = {
    reservedChips,
    placementVersion: participant?.placementVersion ?? 0,
    confirmVersion: participant?.confirmVersion ?? null
  };
  const roundSummary = getRoundSummary(room, canRevealRoundSummary(room));

  return {
    role: "player",
    roomCode: room.code,
    roomStatus: room.status,
    gameStatus: room.currentGame?.status ?? null,
    currentRoundNumber: room.currentGame?.currentRoundNumber ?? 0,
    roundState: currentRound?.state ?? null,
    roundStateEnteredAt: toIsoStringOrNull(currentRound?.stateEnteredAt),
    roundDeadlineAt: toIsoStringOrNull(currentRound?.phaseDeadlineAt),
    categoryName,
    paletteAccessMode: settings.playerPaletteAccessMode,
    scoreboard: buildScoreboardEntries(room.players),
    playerId: player.id,
    playerName: player.name,
    joinOrder: player.joinOrder,
    chips: player.chips,
    reservedChips,
    availableChips,
    placementVersion: participant?.placementVersion ?? null,
    confirmVersion: participant?.confirmVersion ?? null,
    isConfirmed: isParticipantConfirmed(confirmationState),
    placements,
    canParticipateNextRound: player.canParticipateNextRound,
    isConnected: player.connectionState === PlayerConnectionState.CONNECTED,
    isEliminated: player.lifecycleState === PlayerLifecycleState.ELIMINATED,
    actionPermissions: buildActionPermissions(currentRound?.state ?? null, false),
    roundSummary
  };
}

export function buildActivePlayerSnapshotFromRoom(
  room: SnapshotRoomShape,
  player: {
    id: string;
    name: string;
    joinOrder: number;
    chips: number;
  }
): ActivePlayerSnapshot {
  const currentRound = getCurrentRound(room);
  const settings = room.settings ?? createRoomSettingsDefaults();
  const roundSummary = getRoundSummary(room, canRevealRoundSummary(room));

  return {
    role: "active-player",
    roomCode: room.code,
    roomStatus: room.status,
    gameStatus: room.currentGame?.status ?? null,
    currentRoundNumber: room.currentGame?.currentRoundNumber ?? 0,
    roundState: currentRound?.state ?? null,
    roundStateEnteredAt: toIsoStringOrNull(currentRound?.stateEnteredAt),
    roundDeadlineAt: toIsoStringOrNull(currentRound?.phaseDeadlineAt),
    categoryName: currentRound ? getCategoryName(room, currentRound) : null,
    paletteAccessMode: settings.playerPaletteAccessMode,
    scoreboard: buildScoreboardEntries(room.players),
    playerId: player.id,
    playerName: player.name,
    joinOrder: player.joinOrder,
    chips: player.chips,
    targetCellCode:
      currentRound && settings.showCellCodeToActivePlayer
        ? toCellCode(currentRound.targetCellX, currentRound.targetCellY)
        : null,
    canRevealCellCode: settings.showCellCodeToActivePlayer,
    roundSummary
  };
}

export function buildJoinedWaitingSnapshotFromRoom(
  room: SnapshotRoomShape,
  player: {
    id: string;
    name: string;
    joinOrder: number;
    chips: number;
  }
): JoinedWaitingSnapshot {
  const currentRound = getCurrentRound(room);
  const settings = room.settings ?? createRoomSettingsDefaults();
  const categoryName = currentRound ? getCategoryName(room, currentRound) : null;
  const participant = getParticipantState(room, player.id);
  const placements = getPlayerPlacements(room, player.id);
  const reservedChips = placements.length;
  const availableChips = calculateAvailableChips(player.chips, reservedChips);
  const confirmationState: ParticipantConfirmationState = {
    reservedChips,
    placementVersion: participant?.placementVersion ?? 0,
    confirmVersion: participant?.confirmVersion ?? null
  };
  const roundSummary = getRoundSummary(room, canRevealRoundSummary(room));

  return {
    role: "joined-waiting",
    roomCode: room.code,
    roomStatus: room.status,
    gameStatus: room.currentGame?.status ?? null,
    currentRoundNumber: room.currentGame?.currentRoundNumber ?? 0,
    roundState: currentRound?.state ?? null,
    roundStateEnteredAt: toIsoStringOrNull(currentRound?.stateEnteredAt),
    roundDeadlineAt: toIsoStringOrNull(currentRound?.phaseDeadlineAt),
    categoryName,
    paletteAccessMode: settings.playerPaletteAccessMode,
    scoreboard: buildScoreboardEntries(room.players),
    playerId: player.id,
    playerName: player.name,
    joinOrder: player.joinOrder,
    chips: player.chips,
    reservedChips,
    availableChips,
    placementVersion: participant?.placementVersion ?? null,
    confirmVersion: participant?.confirmVersion ?? null,
    isConfirmed: isParticipantConfirmed(confirmationState),
    placements,
    waitingForRoundNumber: (room.currentGame?.currentRoundNumber ?? 0) + 1,
    actionPermissions: buildActionPermissions(currentRound?.state ?? null, true),
    roundSummary
  };
}

export function resolvePlayerRoundRole(
  room: SnapshotRoomShape,
  player: {
    id: string;
    canParticipateNextRound: boolean;
  }
): "active-player" | "joined-waiting" | "player" {
  const currentRound = getCurrentRound(room);

  if (!player.canParticipateNextRound && room.status === RoomStatus.IN_GAME) {
    return "joined-waiting";
  }

  if (currentRound?.activePlayerId === player.id) {
    return "active-player";
  }

  return "player";
}

function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: string) {
  let state = hashSeed(seed) || 1;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function toHex(channel: number): string {
  return channel.toString(16).padStart(2, "0");
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const scaledHue = hue / 60;
  const x = chroma * (1 - Math.abs((scaledHue % 2) - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (scaledHue >= 0 && scaledHue < 1) {
    red = chroma;
    green = x;
  } else if (scaledHue < 2) {
    red = x;
    green = chroma;
  } else if (scaledHue < 3) {
    green = chroma;
    blue = x;
  } else if (scaledHue < 4) {
    green = x;
    blue = chroma;
  } else if (scaledHue < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  const match = l - chroma / 2;
  const red255 = Math.round((red + match) * 255);
  const green255 = Math.round((green + match) * 255);
  const blue255 = Math.round((blue + match) * 255);

  return `#${toHex(red255)}${toHex(green255)}${toHex(blue255)}`;
}

export function buildPaletteSeed(roomCode: string, gameOrdinal: number, customSeed?: string | null): string {
  if (customSeed && customSeed.trim().length > 0) {
    return customSeed.trim();
  }

  return `room:${roomCode}:game:${gameOrdinal}`;
}

export function buildDeterministicPaletteCells(seed: string): PaletteCell[] {
  const random = createSeededRandom(seed);
  const cells: PaletteCell[] = [];
  const baseHue = Math.floor(random() * 360);
  const hueSpread = 70 + Math.floor(random() * 60);
  const saturationBase = 58 + Math.floor(random() * 12);
  const lightnessBase = 48 + Math.floor(random() * 10);

  for (let y = 1; y <= BOARD_HEIGHT; y += 1) {
    for (let x = 1; x <= BOARD_WIDTH; x += 1) {
      const columnRatio = (x - 1) / (BOARD_WIDTH - 1);
      const rowRatio = (y - 1) / (BOARD_HEIGHT - 1);
      const hue = (baseHue + Math.round(columnRatio * hueSpread) + Math.round(random() * 10)) % 360;
      const saturation = Math.min(82, saturationBase + Math.round(rowRatio * 12) - Math.round(random() * 4));
      const lightness = Math.max(30, Math.min(78, lightnessBase + Math.round((0.5 - rowRatio) * 10) + Math.round(random() * 6)));

      cells.push({
        x,
        y,
        hex: hslToHex(hue, saturation, lightness)
      });
    }
  }

  return cells;
}

export function pickTargetCell(seed: string): { x: number; y: number } {
  const random = createSeededRandom(`${seed}:target`);

  return {
    x: 1 + Math.floor(random() * BOARD_WIDTH),
    y: 1 + Math.floor(random() * BOARD_HEIGHT)
  };
}

export function classifyPlacement(
  placement: { x: number; y: number },
  target: { x: number; y: number }
): PlacementResolution {
  const deltaX = Math.abs(placement.x - target.x);
  const deltaY = Math.abs(placement.y - target.y);
  const chebyshevDistance = Math.max(deltaX, deltaY);

  if (chebyshevDistance === 0) {
    return {
      x: placement.x,
      y: placement.y,
      status: PlacementStatus.CENTER,
      multiplier: 3
    };
  }

  if (chebyshevDistance === 1) {
    return {
      x: placement.x,
      y: placement.y,
      status: PlacementStatus.NEAR,
      multiplier: 2
    };
  }

  if (chebyshevDistance === 2) {
    return {
      x: placement.x,
      y: placement.y,
      status: PlacementStatus.EDGE,
      multiplier: 1
    };
  }

  return {
    x: placement.x,
    y: placement.y,
    status: PlacementStatus.MISS,
    multiplier: 0
  };
}

export function buildRoundOutcomes(
  players: Array<{
    id: string;
    name: string;
    chips: number;
  }>,
  placementsByPlayer: Record<string, PlacementResolution[]>
): PlayerRoundOutcome[] {
  return players.map((player) => {
    const placements = placementsByPlayer[player.id] ?? [];
    const stake = placements.length;
    const payout = placements.reduce((total, placement) => total + placement.multiplier, 0);
    const newChips = player.chips - stake + payout;

    return {
      playerId: player.id,
      playerName: player.name,
      stake,
      payout,
      newChips,
      eliminated: newChips <= 0
    };
  });
}

export function buildRoundSummary(input: {
  roundNumber: number;
  target: { x: number; y: number };
  categoryName: string | null;
  players: Array<{
    id: string;
    name: string;
    chips: number;
  }>;
  placements: Array<{
    playerId: string;
    x: number;
    y: number;
  }>;
}): RoundSummary {
  const resolvedPlacements = input.placements.map((placement) =>
    classifyPlacement(placement, input.target)
  );
  const placementsByPlayer = input.placements.reduce<Record<string, PlacementResolution[]>>((accumulator, placement, index) => {
    const resolved = resolvedPlacements[index];
    accumulator[placement.playerId] ??= [];
    accumulator[placement.playerId].push(resolved);
    return accumulator;
  }, {});

  return {
    roundNumber: input.roundNumber,
    targetCellCode: toCellCode(input.target.x, input.target.y),
    categoryName: input.categoryName,
    outcomes: buildRoundOutcomes(input.players, placementsByPlayer),
    placements: resolvedPlacements
  };
}
