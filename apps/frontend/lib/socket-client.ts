import { getRealtimeSocket } from "./realtime";
import type { RoomRoleSnapshot } from "@huegame/contracts";

export async function emitSocket<TResponse>(event: string, payload?: unknown) {
  const socket = getRealtimeSocket();

  if (!socket.connected) {
    socket.connect();
  }

  return new Promise<TResponse>((resolve, reject) => {
    socket.timeout(10_000).emit(event, payload, (error: Error | null, response: TResponse) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(response);
    });
  });
}

export function subscribeToSnapshots(callback: (snapshot: RoomRoleSnapshot) => void) {
  const socket = getRealtimeSocket();

  socket.on("snapshot.updated", callback);

  if (!socket.connected) {
    socket.connect();
  }

  return () => {
    socket.off("snapshot.updated", callback);
  };
}

export function subscribeToRoomDeleted(callback: (payload: { roomCode: string }) => void) {
  const socket = getRealtimeSocket();

  socket.on("room.deleted", callback);

  if (!socket.connected) {
    socket.connect();
  }

  return () => {
    socket.off("room.deleted", callback);
  };
}
