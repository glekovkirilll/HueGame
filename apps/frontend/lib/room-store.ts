"use client";

import { create } from "zustand";

import type { RoomRoleSnapshot } from "@huegame/contracts";

import type { Locale } from "./i18n";
import {
  sampleActivePlayerSnapshot,
  sampleHostSnapshot,
  sampleJoinedWaitingSnapshot,
  samplePlayerSnapshot
} from "./sample-data";
import { emitSocket, subscribeToRoomDeleted, subscribeToSnapshots } from "./socket-client";

type DemoRole = "host" | "player" | "active-player" | "joined-waiting";

type CreateRoomResponse = {
  roomCode: string;
  hostSessionToken?: string;
  hostName?: string;
};

type JoinRoomResponse = {
  roomCode: string;
  playerName: string;
  sessionToken?: string;
};

type DisconnectResponse = {
  roomCode: string;
  disconnected?: boolean;
};

type DeleteRoomResponse = {
  roomCode: string;
  deleted?: boolean;
};

export type SavedHostRoom = {
  roomCode: string;
  sessionToken: string;
};

type SocketResponse = RoomRoleSnapshot | CreateRoomResponse | JoinRoomResponse | DisconnectResponse | DeleteRoomResponse;

type LiveSession =
  | {
      role: "host";
      roomCode: string;
      sessionToken: string;
    }
  | {
      role: "player";
      roomCode: string;
      playerName: string;
      sessionToken: string;
    };

type RoomStore = {
  snapshot: RoomRoleSnapshot | null;
  loading: boolean;
  error: string | null;
  status: string;
  locale: Locale;
  liveSession: LiveSession | null;
  ensureRealtime: () => void;
  setLocale: (locale: Locale) => void;
  setDemoRole: (role: DemoRole) => void;
  clearSnapshot: () => void;
  runCommand: <TResponse extends SocketResponse>(event: string, payload?: unknown) => Promise<TResponse | null>;
};

const demoSnapshots: Record<DemoRole, RoomRoleSnapshot> = {
  host: sampleHostSnapshot,
  player: samplePlayerSnapshot,
  "active-player": sampleActivePlayerSnapshot,
  "joined-waiting": sampleJoinedWaitingSnapshot
};

let snapshotUnsubscribe: (() => void) | null = null;
let roomDeletedUnsubscribe: (() => void) | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function saveSession(response: SocketResponse) {
  if (!isBrowser()) {
    return;
  }

  if ("hostSessionToken" in response && response.hostSessionToken) {
    window.localStorage.setItem(`huegame:host:${response.roomCode}`, response.hostSessionToken);
  }

  if ("sessionToken" in response && response.sessionToken && "playerName" in response) {
    window.localStorage.setItem(
      `huegame:player:${response.roomCode}:${response.playerName}`,
      response.sessionToken
    );
  }
}

function clearRefreshTimer() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function readLocaleFromSnapshot(snapshot: RoomRoleSnapshot): Locale | null {
  if (snapshot.role === "host") {
    return snapshot.settings.defaultLocale;
  }

  return null;
}

function readLiveSession(event: string, payload: unknown, response: SocketResponse): LiveSession | null {
  if (event === "host.reconnect" || event === "game.start") {
    const input = payload as { roomCode?: unknown; sessionToken?: unknown };

    if (typeof input.roomCode === "string" && typeof input.sessionToken === "string") {
      return {
        role: "host",
        roomCode: input.roomCode.toUpperCase(),
        sessionToken: input.sessionToken
      };
    }
  }

  if ("hostSessionToken" in response && response.hostSessionToken) {
    return {
      role: "host",
      roomCode: response.roomCode.toUpperCase(),
      sessionToken: response.hostSessionToken
    };
  }

  if (event === "room.reconnect" || event.startsWith("vote.")) {
    const input = payload as { roomCode?: unknown; playerName?: unknown; sessionToken?: unknown };

    if (
      typeof input.roomCode === "string" &&
      typeof input.playerName === "string" &&
      typeof input.sessionToken === "string"
    ) {
      return {
        role: "player",
        roomCode: input.roomCode.toUpperCase(),
        playerName: input.playerName,
        sessionToken: input.sessionToken
      };
    }
  }

  if ("sessionToken" in response && response.sessionToken && "playerName" in response) {
    return {
      role: "player",
      roomCode: response.roomCode.toUpperCase(),
      playerName: response.playerName,
      sessionToken: response.sessionToken
    };
  }

  return null;
}

async function refreshLiveSession(session: LiveSession): Promise<RoomRoleSnapshot | null> {
  const socketSnapshot = await emitSocket<RoomRoleSnapshot | null>("client.snapshot");

  if (socketSnapshot) {
    return socketSnapshot;
  }

  if (session.role === "host") {
    return emitSocket<RoomRoleSnapshot>("host.reconnect", {
      roomCode: session.roomCode,
      sessionToken: session.sessionToken
    });
  }

  return emitSocket<RoomRoleSnapshot>("room.reconnect", {
    roomCode: session.roomCode,
    playerName: session.playerName,
    sessionToken: session.sessionToken
  });
}

function restartRefreshTimer(getSession: () => LiveSession | null, applySnapshot: (snapshot: RoomRoleSnapshot) => void) {
  clearRefreshTimer();

  refreshTimer = setInterval(() => {
    const session = getSession();

    if (!session) {
      return;
    }

    void refreshLiveSession(session)
      .then((snapshot) => {
        if (snapshot) {
          applySnapshot(snapshot);
        }
      })
      .catch(() => {
        // A quiet refresh should not disrupt a user action. Explicit commands still surface errors.
      });
  }, 1500);
}

export function getSavedHostToken(roomCode: string): string {
  if (!isBrowser()) {
    return "";
  }

  return window.localStorage.getItem(`huegame:host:${roomCode.toUpperCase()}`) ?? "";
}

export function getSavedHostRooms(): SavedHostRoom[] {
  if (!isBrowser()) {
    return [];
  }

  const rooms: SavedHostRoom[] = [];
  const prefix = "huegame:host:";

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (!key?.startsWith(prefix)) {
      continue;
    }

    const sessionToken = window.localStorage.getItem(key);
    const roomCode = key.slice(prefix.length).toUpperCase();

    if (roomCode && sessionToken) {
      rooms.push({ roomCode, sessionToken });
    }
  }

  return rooms.sort((left, right) => left.roomCode.localeCompare(right.roomCode));
}

export function removeSavedHostToken(roomCode: string) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(`huegame:host:${roomCode.toUpperCase()}`);
}

export function removeSavedPlayerTokens(roomCode: string) {
  if (!isBrowser()) {
    return;
  }

  const normalizedRoomCode = roomCode.toUpperCase();
  const prefix = `huegame:player:${normalizedRoomCode}:`;
  const keysToRemove: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (key?.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    window.localStorage.removeItem(key);
  }
}

export function removeSavedRoomTokens(roomCode: string) {
  removeSavedHostToken(roomCode);
  removeSavedPlayerTokens(roomCode);
}

export function getSavedPlayerToken(roomCode: string, playerName: string): string {
  if (!isBrowser()) {
    return "";
  }

  return window.localStorage.getItem(`huegame:player:${roomCode.toUpperCase()}:${playerName}`) ?? "";
}

export const useRoomStore = create<RoomStore>((set, get) => {
  const applySnapshot = (snapshot: RoomRoleSnapshot, status = "snapshot.updated") => {
    const snapshotLocale = readLocaleFromSnapshot(snapshot);

    set((state) => ({
      snapshot,
      locale: snapshotLocale ?? state.locale,
      loading: false,
      error: null,
      status
    }));
  };

  return {
    snapshot: null,
    loading: false,
    error: null,
    status: "Not connected",
    locale: "ru",
    liveSession: null,
    ensureRealtime: () => {
      if (!isBrowser() || snapshotUnsubscribe) {
        return;
      }

      snapshotUnsubscribe = subscribeToSnapshots((snapshot) => {
        applySnapshot(snapshot);
      });
      roomDeletedUnsubscribe = subscribeToRoomDeleted((payload) => {
        removeSavedRoomTokens(payload.roomCode);
        clearRefreshTimer();
        set({
          snapshot: null,
          liveSession: null,
          loading: false,
          error: null,
          status: `room.deleted: ${payload.roomCode}`
        });
      });
    },
    setLocale: (locale) => set({ locale }),
    setDemoRole: (role) => {
      const snapshot = demoSnapshots[role];
      const snapshotLocale = readLocaleFromSnapshot(snapshot);

      clearRefreshTimer();

      set({
        snapshot,
        liveSession: null,
        locale: snapshotLocale ?? "ru",
        error: null,
        status: `Demo ${role}`
      });
    },
    clearSnapshot: () => {
      clearRefreshTimer();

      set({
        snapshot: null,
        liveSession: null,
        error: null,
        status: "Not connected"
      });
    },
    runCommand: async <TResponse extends SocketResponse>(event: string, payload?: unknown) => {
      get().ensureRealtime();
      set({ loading: true, error: null, status: event });

      try {
        const response = await emitSocket<SocketResponse>(event, payload);
        saveSession(response);

        const liveSession = readLiveSession(event, payload, response);

        if (liveSession) {
          set({ liveSession });
          restartRefreshTimer(() => get().liveSession, (snapshot) => applySnapshot(snapshot, "refresh"));
        }

        if ("role" in response) {
          applySnapshot(response, `${event}: ${response.role}`);
        } else {
          set({
            loading: false,
            status: `${event}: ${response.roomCode}`
          });
        }

        if ("disconnected" in response && response.disconnected) {
          clearRefreshTimer();
          set({
            snapshot: null,
            liveSession: null,
            loading: false,
            status: `${event}: ${response.roomCode}`
          });
        }

        if ("deleted" in response && response.deleted) {
          removeSavedRoomTokens(response.roomCode);
          clearRefreshTimer();
          set({
            snapshot: null,
            liveSession: null,
            loading: false,
            status: `${event}: ${response.roomCode}`
          });
        }

        return response as TResponse;
      } catch (error) {
        set({
          loading: false,
          error: error instanceof Error ? error.message : "Unknown realtime error",
          status: `${event}: failed`
        });
        return null;
      }
    }
  };
});
