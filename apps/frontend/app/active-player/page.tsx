"use client";

import { PlayerConsole } from "@/components/player-console";
import { RoomShell } from "@/components/room-shell";
import { useRoomStore } from "@/lib/room-store";

export default function ActivePlayerPage() {
  const { snapshot, status, error, loading } = useRoomStore();

  return (
    <RoomShell
      title="Active Player Card"
      subtitle="Private-card shell for the active player, ready for reconnect and live snapshot hydration."
      snapshot={snapshot}
      status={status}
      error={error}
      loading={loading}
    >
      <PlayerConsole demoRole="active-player" />
    </RoomShell>
  );
}
