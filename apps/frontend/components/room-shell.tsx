"use client";

import type { RoomRoleSnapshot } from "@huegame/contracts";

type RoomShellProps = {
  title: string;
  subtitle: string;
  snapshot: RoomRoleSnapshot;
  status: string;
  error: string | null;
  loading: boolean;
  children: React.ReactNode;
};

export function RoomShell({ title, subtitle, snapshot, status, error, loading, children }: RoomShellProps) {
  return (
    <main className="shell">
      <section className="hero">
        <span className="pill">{snapshot.role}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <div className="stats">
          <div className="stat">
            <span className="label">Room</span>
            <strong>{snapshot.roomCode}</strong>
          </div>
          <div className="stat">
            <span className="label">Round</span>
            <strong>{snapshot.currentRoundNumber}</strong>
          </div>
          <div className="stat">
            <span className="label">State</span>
            <strong>{snapshot.roundState ?? "n/a"}</strong>
          </div>
        </div>
        <div className="panel" style={{ padding: 16 }}>
          <strong>{loading ? "Working..." : status}</strong>
          {error ? <p className="status-warn">{error}</p> : null}
        </div>
      </section>
      {children}
    </main>
  );
}
