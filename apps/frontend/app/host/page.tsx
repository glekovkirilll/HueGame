"use client";

import { HostConsole } from "@/components/host-console";
import { RoomShell } from "@/components/room-shell";
import { useRoomStore } from "@/lib/room-store";

export default function HostPage() {
  const { snapshot, status, error, loading } = useRoomStore();

  return (
    <RoomShell
      title={`Room ${snapshot.roomCode}`}
      subtitle="Host-facing orchestration surface with realtime controls for room creation, reconnect, round control, and diagnostics."
      snapshot={snapshot}
      status={status}
      error={error}
      loading={loading}
    >
      <HostConsole />
    </RoomShell>
  );
}
