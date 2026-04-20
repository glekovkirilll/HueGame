"use client";

import { useState } from "react";

import { useRoomStore } from "@/lib/room-store";

export function HostConsole() {
  const { snapshot, status, error, loading, setDemoRole, runCommand } = useRoomStore();
  const [hostName, setHostName] = useState("Host");
  const [roomCode, setRoomCode] = useState(snapshot.roomCode);
  const [sessionToken, setSessionToken] = useState("");

  return (
    <div className="grid two">
      <section className="panel">
        <h2>Host Controls</h2>
        <div className="actions">
          <button className="button secondary" onClick={() => setDemoRole("host")} type="button">Demo Host</button>
          <button className="button" onClick={() => void runCommand("system.tick")} type="button">Run Tick</button>
        </div>
        <div className="kv" style={{ marginTop: 16 }}>
          <label>
            <span className="label">Host name</span>
            <input value={hostName} onChange={(event) => setHostName(event.target.value)} />
          </label>
          <label>
            <span className="label">Room code</span>
            <input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} />
          </label>
          <label>
            <span className="label">Session token</span>
            <input value={sessionToken} onChange={(event) => setSessionToken(event.target.value)} />
          </label>
        </div>
        <div className="actions" style={{ marginTop: 16 }}>
          <button
            className="button"
            disabled={loading}
            onClick={async () => {
              const response = await runCommand<{ roomCode: string; hostSessionToken?: string }>("room.create", {
                hostName
              });
              if (response && "hostSessionToken" in response && response.hostSessionToken) {
                setRoomCode(response.roomCode);
                setSessionToken(response.hostSessionToken);
              }
            }}
            type="button"
          >
            Create Room
          </button>
          <button className="button secondary" disabled={loading} onClick={() => void runCommand("host.reconnect", { roomCode, sessionToken })} type="button">
            Reconnect Host
          </button>
          <button className="button secondary" disabled={loading} onClick={() => void runCommand("game.start", { roomCode, sessionToken })} type="button">
            Start Game
          </button>
          <button className="button secondary" disabled={loading} onClick={() => void runCommand("round.advance", { roomCode, sessionToken })} type="button">
            Advance Round
          </button>
          <button className="button secondary" disabled={loading} onClick={() => void runCommand("host.disconnect", { roomCode, sessionToken })} type="button">
            Disconnect
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Live Snapshot</h2>
        <div className="kv">
          <div className="kv-row"><span>Status</span><strong>{status}</strong></div>
          <div className="kv-row"><span>Active player</span><strong>{"activePlayerName" in snapshot ? (snapshot.activePlayerName ?? "n/a") : "n/a"}</strong></div>
          <div className="kv-row"><span>Category</span><strong>{snapshot.categoryName ?? "n/a"}</strong></div>
          <div className="kv-row"><span>Summary</span><strong>{"roundSummary" in snapshot && snapshot.roundSummary ? "visible" : "hidden"}</strong></div>
        </div>
        {error ? <p className="status-warn">{error}</p> : null}
      </section>
    </div>
  );
}
