import { PaletteAccessMode, type RoomSettingsDefaults } from "@huegame/contracts";

type PlainObject = Record<string, unknown>;
type RoomCodePayload = {
  roomCode: string;
  playerName?: string;
  sessionToken?: string;
};

type CreateRoomPayload = {
  hostName: string;
  settings?: Partial<RoomSettingsDefaults>;
};

type PlaceChipPayload = {
  roomCode: string;
  playerName: string;
  sessionToken: string;
  x: number;
  y: number;
};

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === "object" && value !== null;
}

function readString(payload: PlainObject, key: string): string {
  const value = payload[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Field "${key}" must be a non-empty string.`);
  }

  return value;
}

function readNumber(payload: PlainObject, key: string): number {
  const value = payload[key];

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Field "${key}" must be a valid number.`);
  }

  return value;
}

function readOptionalPositiveInteger(payload: PlainObject, key: string, min: number, max: number): number | undefined {
  const value = payload[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Field "${key}" must be an integer from ${min} to ${max}.`);
  }

  return value;
}

function readOptionalBoolean(payload: PlainObject, key: string): boolean | undefined {
  const value = payload[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`Field "${key}" must be a boolean.`);
  }

  return value;
}

function validateCreateRoomSettings(payload: unknown): Partial<RoomSettingsDefaults> | undefined {
  if (payload === undefined) {
    return undefined;
  }

  if (!isPlainObject(payload)) {
    throw new Error('Field "settings" must be an object.');
  }

  const settings: Partial<RoomSettingsDefaults> = {};
  const roundsCount = readOptionalPositiveInteger(payload, "roundsCount", 1, 50);
  const allConfirmedWindowMs = readOptionalPositiveInteger(payload, "allConfirmedWindowMs", 3_000, 60_000);

  if (roundsCount !== undefined) {
    settings.roundsCount = roundsCount;
  }

  if (payload.startChips !== undefined) {
    if (payload.startChips !== 0) {
      throw new Error('Field "startChips" must be 0 in the current scoring mode.');
    }

    settings.startChips = 0;
  }

  const showCellCodeToActivePlayer = readOptionalBoolean(payload, "showCellCodeToActivePlayer");
  const allowCategoryRepeats = readOptionalBoolean(payload, "allowCategoryRepeats");

  if (showCellCodeToActivePlayer !== undefined) {
    settings.showCellCodeToActivePlayer = showCellCodeToActivePlayer;
  }

  if (allowCategoryRepeats !== undefined) {
    settings.allowCategoryRepeats = allowCategoryRepeats;
  }

  if (payload.defaultLocale !== undefined) {
    if (payload.defaultLocale !== "ru" && payload.defaultLocale !== "en") {
      throw new Error('Field "defaultLocale" must be "ru" or "en".');
    }

    settings.defaultLocale = payload.defaultLocale;
  }

  if (payload.playerPaletteAccessMode !== undefined) {
    if (
      payload.playerPaletteAccessMode !== PaletteAccessMode.STRICT &&
      payload.playerPaletteAccessMode !== PaletteAccessMode.RELAXED
    ) {
      throw new Error('Field "playerPaletteAccessMode" must be "STRICT" or "RELAXED".');
    }

    settings.playerPaletteAccessMode = payload.playerPaletteAccessMode;
  }

  if (allConfirmedWindowMs !== undefined) {
    settings.allConfirmedWindowMs = allConfirmedWindowMs;
  }

  return Object.keys(settings).length > 0 ? settings : undefined;
}

export function validateRoomCodePayload(
  payload: unknown,
  requiresPlayerName = false,
  requiresSessionToken = false
): RoomCodePayload {
  if (!isPlainObject(payload)) {
    throw new Error("Payload must be an object.");
  }

  const roomCode = readString(payload, "roomCode");
  const result: RoomCodePayload = { roomCode };

  if (requiresPlayerName) {
    result.playerName = readString(payload, "playerName");
  }

  if (requiresSessionToken) {
    result.sessionToken = readString(payload, "sessionToken");
  }

  return result;
}

export function validateCreateRoomPayload(payload: unknown) {
  if (!isPlainObject(payload)) {
    throw new Error("Payload must be an object.");
  }

  return {
    hostName: readString(payload, "hostName"),
    settings: validateCreateRoomSettings(payload.settings)
  } satisfies CreateRoomPayload;
}

export function validatePlaceChipPayload(payload: unknown): PlaceChipPayload {
  if (!isPlainObject(payload)) {
    throw new Error("Payload must be an object.");
  }

  const validated = validateRoomCodePayload(payload, true, true);

  if (!validated.playerName || !validated.sessionToken) {
    throw new Error('Fields "playerName" and "sessionToken" are required.');
  }

  return {
    roomCode: validated.roomCode,
    playerName: validated.playerName,
    sessionToken: validated.sessionToken,
    x: readNumber(payload, "x"),
    y: readNumber(payload, "y")
  };
}
