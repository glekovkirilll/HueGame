"use client";

import { PlayerConsole } from "@/components/player-console";
import { RoomShell } from "@/components/room-shell";
import { useRoomStore } from "@/lib/room-store";

export default function WaitingPage() {
  const { snapshot, status, error, loading } = useRoomStore();

  return (
    <RoomShell
      title="Joined Waiting"
      subtitle="Waiting-state shell for late joiners who will enter on the next round transition."
      snapshot={snapshot}
      status={status}
      error={error}
      loading={loading}
    >
      <PlayerConsole demoRole="joined-waiting" />
    </RoomShell>
  );
}
