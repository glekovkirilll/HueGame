export type CreateRoomPayload = {
  hostName: string;
};

export type HostAuthPayload = {
  roomCode: string;
  sessionToken: string;
};

export type JoinRoomPayload = {
  roomCode: string;
  playerName: string;
  sessionToken?: string;
};

export type PlayerAuthPayload = {
  roomCode: string;
  playerName: string;
  sessionToken: string;
};

export type PlaceChipPayload = PlayerAuthPayload & {
  x: number;
  y: number;
};
