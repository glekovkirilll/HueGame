import { getRealtimeSocket } from "./realtime";

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
