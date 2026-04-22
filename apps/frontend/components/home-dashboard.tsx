"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { getCopy } from "@/lib/i18n";
import { getSavedHostRooms, type SavedHostRoom, useRoomStore } from "@/lib/room-store";

type DeleteRoomResponse = {
  roomCode: string;
  deleted?: boolean;
};

export function HomeDashboard() {
  const { locale, setLocale, setDemoRole, runCommand, loading, error } = useRoomStore();
  const copy = getCopy(locale);
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [hostRooms, setHostRooms] = useState<SavedHostRoom[]>([]);

  useEffect(() => {
    const refreshHostRooms = () => setHostRooms(getSavedHostRooms());

    refreshHostRooms();
    window.addEventListener("focus", refreshHostRooms);
    window.addEventListener("storage", refreshHostRooms);

    return () => {
      window.removeEventListener("focus", refreshHostRooms);
      window.removeEventListener("storage", refreshHostRooms);
    };
  }, []);

  async function deleteHostRoom(room: SavedHostRoom) {
    const response = await runCommand<DeleteRoomResponse>("room.delete", {
      roomCode: room.roomCode,
      sessionToken: room.sessionToken
    });

    if (response?.deleted) {
      setHostRooms(getSavedHostRooms());
    }
  }

  function joinPlayerRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedRoomCode = roomCode.trim().toUpperCase();
    const normalizedPlayerName = playerName.trim();

    if (!normalizedRoomCode || !normalizedPlayerName) {
      return;
    }

    const params = new URLSearchParams({
      room: normalizedRoomCode,
      name: normalizedPlayerName
    });

    router.push(`/player?${params.toString()}`);
  }

  return (
    <main className="app-page entry-page">
      <header className="topbar">
        <Link className="brand" href="/">
          {copy.common.appName}
        </Link>
        <div className="segmented" role="group" aria-label={copy.common.language}>
          <button className={locale === "ru" ? "is-active" : ""} onClick={() => setLocale("ru")} type="button">
            RU
          </button>
          <button className={locale === "en" ? "is-active" : ""} onClick={() => setLocale("en")} type="button">
            EN
          </button>
        </div>
      </header>

      <section className="entry-grid">
        <article className="entry-panel host-entry">
          <div>
            <span className="kicker">{copy.common.host}</span>
            <h1>{copy.home.hostTitle}</h1>
          </div>
          <div className="entry-actions">
            <Link className="primary-button" href="/host">
              {copy.home.hostAction}
            </Link>
            <Link className="ghost-button" href="/host" onClick={() => setDemoRole("host")}>
              {copy.home.demoHost}
            </Link>
          </div>
          <div className="active-rooms">
            <div className="active-rooms-heading">
              <strong>{copy.home.activeRooms}</strong>
              <span>{hostRooms.length}</span>
            </div>
            {hostRooms.length > 0 ? (
              <div className="active-room-list">
                {hostRooms.map((room) => (
                  <div className="active-room-row" key={room.roomCode}>
                    <strong>{room.roomCode}</strong>
                    <div className="active-room-actions">
                      <Link className="ghost-button compact-button" href={`/host?room=${room.roomCode}`}>
                        {copy.common.open}
                      </Link>
                      <button
                        className="ghost-button compact-button danger-button"
                        disabled={loading}
                        onClick={() => void deleteHostRoom(room)}
                        type="button"
                      >
                        {copy.common.deleteRoom}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">{copy.home.noActiveRooms}</p>
            )}
            {error ? <b className="error-text">{error}</b> : null}
          </div>
        </article>

        <article className="entry-panel player-entry">
          <div>
            <span className="kicker">{copy.common.player}</span>
            <h1>{copy.home.playerTitle}</h1>
          </div>
          <form className="entry-form" onSubmit={joinPlayerRoom}>
            <label className="field">
              <span>{copy.common.roomCode}</span>
              <input
                maxLength={6}
                onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                placeholder={copy.home.roomCodePlaceholder}
                value={roomCode}
              />
            </label>
            <label className="field">
              <span>{copy.common.name}</span>
              <input
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder={copy.home.playerNamePlaceholder}
                value={playerName}
              />
            </label>
            <div className="entry-actions">
              <button className="primary-button" disabled={!roomCode.trim() || !playerName.trim()} type="submit">
                {copy.home.playerAction}
              </button>
              <Link className="ghost-button" href="/player" onClick={() => setDemoRole("player")}>
                {copy.home.demoPlayer}
              </Link>
            </div>
          </form>
        </article>
      </section>
    </main>
  );
}
