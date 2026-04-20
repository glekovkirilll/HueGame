"use client";

import { PlayerConsole } from "@/components/player-console";
import { RoomShell } from "@/components/room-shell";
import { useRoomStore } from "@/lib/room-store";

export default function PlayerPage() {
  const { snapshot, status, error, loading } = useRoomStore();

  return (
    <RoomShell
      title="Player Surface"
      subtitle="Join, reconnect, place chips, and confirm bets against the websocket backend from a single client shell."
      snapshot={snapshot}
      status={status}
      error={error}
      loading={loading}
    >
      <PlayerConsole demoRole="player" />
    </RoomShell>
  );
}
