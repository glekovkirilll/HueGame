"use client";

import { useState } from "react";

import { useRoomStore } from "@/lib/room-store";

type PlayerConsoleProps = {
  demoRole: "player" | "active-player" | "joined-waiting";
};

export function PlayerConsole({ demoRole }: PlayerConsoleProps) {
  const { snapshot, status, error, loading, setDemoRole, runCommand } = useRoomStore();
  const [roomCode, setRoomCode] = useState(snapshot.roomCode);
  const [playerName, setPlayerName] = useState("Maks");
  const [sessionToken, setSessionToken] = useState("");
  const [x, setX] = useState("12");
  const [y, setY] = useState("7");

  return (
    <div className="grid two">
      <section className="panel">
        <h2>Realtime Controls</h2>
        <div className="actions">
          <button className="button secondary" onClick={() => setDemoRole(demoRole)} type="button">
            Demo {demoRole}
          </button>
        </div>
        <div className="kv" style={{ marginTop: 16 }}>
          <label>
            <span className="label">Room code</span>
            <input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} />
          </label>
          <label>
            <span className="label">Player name</span>
            <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} />
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
              const response = await runCommand<{ sessionToken?: string; roomCode: string }>("room.join", {
                roomCode,
                playerName,
                sessionToken: sessionToken || undefined
              });
              if (response && "sessionToken" in response && response.sessionToken) {
                setSessionToken(response.sessionToken);
              }
            }}
            type="button"
          >
            Join Room
          </button>
          <button className="button secondary" disabled={loading} onClick={() => void runCommand("room.reconnect", { roomCode, playerName, sessionToken })} type="button">
            Reconnect
          </button>
          <button className="button secondary" disabled={loading} onClick={() => void runCommand("room.disconnect", { roomCode, playerName, sessionToken })} type="button">
            Disconnect
          </button>
        </div>

        <div className="kv" style={{ marginTop: 16 }}>
          <label>
            <span className="label">X</span>
            <input value={x} onChange={(event) => setX(event.target.value)} />
          </label>
          <label>
            <span className="label">Y</span>
            <input value={y} onChange={(event) => setY(event.target.value)} />
          </label>
        </div>
        <div className="actions" style={{ marginTop: 16 }}>
          <button className="button secondary" disabled={loading} onClick={() => void runCommand("vote.placeChip", { roomCode, playerName, sessionToken, x: Number(x), y: Number(y) })} type="button">
            Place Chip
          </button>
          <button className="button secondary" disabled={loading} onClick={() => void runCommand("vote.removeChip", { roomCode, playerName, sessionToken, x: Number(x), y: Number(y) })} type="button">
            Remove Chip
          </button>
          <button className="button secondary" disabled={loading} onClick={() => void runCommand("vote.confirmBet", { roomCode, playerName, sessionToken })} type="button">
            Confirm
          </button>
          <button className="button secondary" disabled={loading} onClick={() => void runCommand("vote.unconfirmBet", { roomCode, playerName, sessionToken })} type="button">
            Unconfirm
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Snapshot View</h2>
        <div className="kv">
          <div className="kv-row"><span>Status</span><strong>{status}</strong></div>
          <div className="kv-row"><span>Role</span><strong>{snapshot.role}</strong></div>
          <div className="kv-row"><span>Category</span><strong>{snapshot.categoryName ?? "n/a"}</strong></div>
          {"placements" in snapshot ? (
            <div className="kv-row"><span>Placements</span><strong>{snapshot.placements.length}</strong></div>
          ) : null}
        </div>
        {error ? <p className="status-warn">{error}</p> : null}
      </section>
    </div>
  );
}
