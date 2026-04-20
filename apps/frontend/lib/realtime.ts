import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getRealtimeSocket() {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001", {
      autoConnect: false,
      transports: ["websocket"]
    });
  }

  return socket;
}
