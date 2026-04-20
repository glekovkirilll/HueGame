type PlainObject = Record<string, unknown>;
type RoomCodePayload = {
  roomCode: string;
  playerName?: string;
  sessionToken?: string;
};

type CreateRoomPayload = {
  hostName: string;
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
    hostName: readString(payload, "hostName")
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
