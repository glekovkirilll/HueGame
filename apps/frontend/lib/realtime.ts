import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

function resolveBackendUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  if (configuredUrl && !configuredUrl.includes("localhost")) {
    return configuredUrl;
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  return configuredUrl ?? "http://localhost:3001";
}

export function getRealtimeSocket() {
  if (!socket) {
    socket = io(resolveBackendUrl(), {
      autoConnect: false,
      transports: ["websocket"]
    });
  }

  return socket;
}
