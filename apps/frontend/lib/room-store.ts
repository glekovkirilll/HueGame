"use client";

import { create } from "zustand";

import type { RoomRoleSnapshot } from "@huegame/contracts";

import {
  sampleActivePlayerSnapshot,
  sampleHostSnapshot,
  sampleJoinedWaitingSnapshot,
  samplePlayerSnapshot
} from "./sample-data";
import { emitSocket } from "./socket-client";

type DemoRole = "host" | "player" | "active-player" | "joined-waiting";

type RoomStore = {
  snapshot: RoomRoleSnapshot;
  loading: boolean;
  error: string | null;
  status: string;
  setDemoRole: (role: DemoRole) => void;
  runCommand: <TResponse extends RoomRoleSnapshot | { roomCode: string; disconnected?: boolean }>(
    event: string,
    payload?: unknown
  ) => Promise<TResponse | null>;
};

const demoSnapshots: Record<DemoRole, RoomRoleSnapshot> = {
  host: sampleHostSnapshot,
  player: samplePlayerSnapshot,
  "active-player": sampleActivePlayerSnapshot,
  "joined-waiting": sampleJoinedWaitingSnapshot
};

export const useRoomStore = create<RoomStore>((set) => ({
  snapshot: sampleHostSnapshot,
  loading: false,
  error: null,
  status: "Idle",
  setDemoRole: (role) => {
    set({
      snapshot: demoSnapshots[role],
      error: null,
      status: `Loaded ${role} demo snapshot`
    });
  },
  runCommand: async (event, payload) => {
    set({ loading: true, error: null, status: `Sending ${event}` });

    try {
      const response = await emitSocket<RoomRoleSnapshot | { roomCode: string; disconnected?: boolean }>(
        event,
        payload
      );

      if ("role" in response) {
        set({
          snapshot: response,
          loading: false,
          status: `Received ${response.role} snapshot from ${event}`
        });
      } else {
        set({
          loading: false,
          status: `Completed ${event} for room ${response.roomCode}`
        });
      }

      return response as TResponse;
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Unknown realtime error",
        status: `Failed ${event}`
      });
      return null;
    }
  }
}));
