"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  DEFAULT_ROOM_SETTINGS,
  PaletteAccessMode,
  RoomStatus,
  type HostSnapshot,
  type RoomSettingsDefaults
} from "@huegame/contracts";

import { HostBoard } from "@/components/host-board";
import { PhaseStrip } from "@/components/phase-strip";
import { Scoreboard } from "@/components/scoreboard";
import { getCopy, phaseLabel } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getSavedHostToken, useRoomStore } from "@/lib/room-store";

type CreateRoomResponse = {
  roomCode: string;
  hostSessionToken?: string;
};

type DeleteRoomResponse = {
  roomCode: string;
  deleted?: boolean;
};

function isHostSnapshot(snapshot: unknown): snapshot is HostSnapshot {
  return typeof snapshot === "object" && snapshot !== null && "role" in snapshot && snapshot.role === "host";
}

function formatSeconds(deadline: string | null) {
  if (!deadline) {
    return null;
  }

  const remaining = Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
  return remaining;
}

function HostResults({ snapshot, locale }: { snapshot: HostSnapshot; locale: Locale }) {
  const copy = getCopy(locale);
  const summary = snapshot.roundSummary;

  if (!summary) {
    return null;
  }

  return (
    <section className="surface results-surface">
      <div className="surface-title-row">
        <h2>{copy.common.placements}</h2>
        <span className="state-pill">{summary.targetCellCode}</span>
      </div>
      <div className="result-grid">
        {summary.outcomes.map((outcome) => (
          <article className="result-row" key={outcome.playerId}>
            <strong>{outcome.playerName}</strong>
            <span>{copy.result.stake}: {outcome.stake}</span>
            <span>{copy.result.payout}: {outcome.payout}</span>
            <b>{copy.result.total}: {outcome.newChips}</b>
          </article>
        ))}
      </div>
    </section>
  );
}

export function HostConsole() {
  const { snapshot, status, error, loading, locale, ensureRealtime, setLocale, runCommand, setDemoRole } = useRoomStore();
  const copy = getCopy(locale);
  const hostSnapshot = isHostSnapshot(snapshot) ? snapshot : null;
  const [hostName, setHostName] = useState("Host");
  const [roomCode, setRoomCode] = useState(hostSnapshot?.roomCode ?? "");
  const [sessionToken, setSessionToken] = useState("");
  const [origin, setOrigin] = useState("");
  const [settings, setSettings] = useState<RoomSettingsDefaults>({
    ...DEFAULT_ROOM_SETTINGS
  });

  useEffect(() => {
    ensureRealtime();
    setOrigin(window.location.origin);

    const queryRoomCode = new URLSearchParams(window.location.search).get("room")?.toUpperCase();

    if (!queryRoomCode) {
      return;
    }

    const savedToken = getSavedHostToken(queryRoomCode);
    setRoomCode(queryRoomCode);
    setSessionToken(savedToken);

    if (savedToken) {
      void runCommand("host.reconnect", {
        roomCode: queryRoomCode,
        sessionToken: savedToken
      });
    }
  }, [ensureRealtime, runCommand]);

  useEffect(() => {
    if (hostSnapshot) {
      setRoomCode(hostSnapshot.roomCode);
      setSettings(hostSnapshot.settings);
      setSessionToken((current) => current || getSavedHostToken(hostSnapshot.roomCode));
    }
  }, [hostSnapshot]);

  const joinUrl = useMemo(() => {
    if (!origin || !roomCode) {
      return "";
    }

    return `${origin}/player?room=${roomCode}`;
  }, [origin, roomCode]);

  const qrUrl = joinUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(joinUrl)}`
    : "";
  const timer = formatSeconds(hostSnapshot?.roundDeadlineAt ?? null);
  const canStart = hostSnapshot?.roomStatus === RoomStatus.LOBBY && hostSnapshot.scoreboard.length >= 2;
  const activeRoomCode = hostSnapshot?.roomCode ?? roomCode;
  const activeSessionToken = sessionToken || (activeRoomCode ? getSavedHostToken(activeRoomCode) : "");
  const isGameScreen = hostSnapshot?.roomStatus === RoomStatus.IN_GAME || hostSnapshot?.roomStatus === RoomStatus.FINISHED;

  async function exitRoom() {
    if (!activeRoomCode || !activeSessionToken) {
      return;
    }

    await runCommand("host.disconnect", {
      roomCode: activeRoomCode,
      sessionToken: activeSessionToken
    });
  }

  async function deleteRoom() {
    if (!activeRoomCode || !activeSessionToken) {
      return;
    }

    const response = await runCommand<DeleteRoomResponse>("room.delete", {
      roomCode: activeRoomCode,
      sessionToken: activeSessionToken
    });

    if (response?.deleted) {
      setRoomCode("");
      setSessionToken("");
    }
  }

  return (
    <main className="app-page host-page">
      <header className="topbar">
        <Link className="brand" href="/">
          {copy.common.appName}
        </Link>
        <nav className="topnav" aria-label="Host">
          <Link href="/player">{copy.common.player}</Link>
          {hostSnapshot ? (
            <>
              <button className="text-button" disabled={loading || !activeSessionToken} onClick={exitRoom} type="button">
                {copy.common.exitRoom}
              </button>
              <button
                className="text-button danger-text"
                disabled={loading || !activeSessionToken}
                onClick={deleteRoom}
                type="button"
              >
                {copy.common.deleteRoom}
              </button>
            </>
          ) : null}
          <button className="text-button" onClick={() => setDemoRole("host")} type="button">
            Demo
          </button>
        </nav>
        <div className="segmented" role="group" aria-label={copy.common.language}>
          <button className={locale === "ru" ? "is-active" : ""} onClick={() => setLocale("ru")} type="button">
            RU
          </button>
          <button className={locale === "en" ? "is-active" : ""} onClick={() => setLocale("en")} type="button">
            EN
          </button>
        </div>
      </header>

      <section className={isGameScreen ? "host-layout is-game" : "host-layout"}>
        {!isGameScreen ? (
          <aside className="surface control-surface">
          <div className="surface-title-row">
            <div>
              <span className="kicker">{copy.common.host}</span>
              <h1>{copy.host.title}</h1>
            </div>
            <span className={hostSnapshot?.hostConnected ? "state-pill good" : "state-pill warn"}>
              {hostSnapshot?.hostConnected ? copy.common.connected : copy.common.disconnected}
            </span>
          </div>

          <label className="field">
            <span>{copy.common.name}</span>
            <input value={hostName} onChange={(event) => setHostName(event.target.value)} />
          </label>
          <label className="field">
            <span>{copy.common.roomCode}</span>
            <input
              maxLength={6}
              value={roomCode}
              onChange={(event) => {
                const nextCode = event.target.value.toUpperCase();
                setRoomCode(nextCode);
                setSessionToken(getSavedHostToken(nextCode));
              }}
            />
          </label>

          <div className="settings-grid">
            <label className="field">
              <span>{copy.host.roundsCount}</span>
              <input
                min={1}
                max={50}
                type="number"
                value={settings.roundsCount}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, roundsCount: Number(event.target.value) }))
                }
              />
            </label>
          </div>

          <label className="toggle-row">
            <input
              checked={settings.showCellCodeToActivePlayer}
              onChange={(event) =>
                setSettings((current) => ({ ...current, showCellCodeToActivePlayer: event.target.checked }))
              }
              type="checkbox"
            />
            <span>{copy.host.showCellCode}</span>
          </label>
          <label className="toggle-row">
            <input
              checked={settings.allowCategoryRepeats}
              onChange={(event) =>
                setSettings((current) => ({ ...current, allowCategoryRepeats: event.target.checked }))
              }
              type="checkbox"
            />
            <span>{copy.host.allowRepeats}</span>
          </label>

          <div className="segmented full" role="group" aria-label={copy.host.paletteMode}>
            <button
              className={settings.playerPaletteAccessMode === PaletteAccessMode.STRICT ? "is-active" : ""}
              onClick={() =>
                setSettings((current) => ({ ...current, playerPaletteAccessMode: PaletteAccessMode.STRICT }))
              }
              type="button"
            >
              STRICT
            </button>
            <button
              className={settings.playerPaletteAccessMode === PaletteAccessMode.RELAXED ? "is-active" : ""}
              onClick={() =>
                setSettings((current) => ({ ...current, playerPaletteAccessMode: PaletteAccessMode.RELAXED }))
              }
              type="button"
            >
              RELAXED
            </button>
          </div>

          <div className="action-stack">
            <button
              className="primary-button wide"
              disabled={loading}
              onClick={async () => {
                const response = await runCommand<CreateRoomResponse>("room.create", {
                  hostName,
                  settings: {
                    roundsCount: settings.roundsCount,
                    showCellCodeToActivePlayer: settings.showCellCodeToActivePlayer,
                    allowCategoryRepeats: settings.allowCategoryRepeats,
                    defaultLocale: locale,
                    playerPaletteAccessMode: settings.playerPaletteAccessMode,
                    allConfirmedWindowMs: settings.allConfirmedWindowMs
                  }
                });

                if (response?.hostSessionToken) {
                  setRoomCode(response.roomCode);
                  setSessionToken(response.hostSessionToken);
                  await runCommand("host.reconnect", {
                    roomCode: response.roomCode,
                    sessionToken: response.hostSessionToken
                  });
                }
              }}
              type="button"
            >
              {copy.host.createRoom}
            </button>
            <button
              className="ghost-button wide"
              disabled={loading || !activeRoomCode || !activeSessionToken}
              onClick={() => void runCommand("host.reconnect", { roomCode: activeRoomCode, sessionToken: activeSessionToken })}
              type="button"
            >
              {copy.host.reconnectHost}
            </button>
            <button
              className="primary-button wide"
              disabled={loading || !canStart || !activeSessionToken}
              onClick={() => void runCommand("game.start", { roomCode: activeRoomCode, sessionToken: activeSessionToken })}
              type="button"
            >
              {copy.host.startGame}
            </button>
            <button
              className="ghost-button wide"
              disabled={loading || !activeRoomCode || !activeSessionToken}
              onClick={exitRoom}
              type="button"
            >
              {copy.common.exitRoom}
            </button>
            <button
              className="ghost-button wide danger-button"
              disabled={loading || !activeRoomCode || !activeSessionToken}
              onClick={deleteRoom}
              type="button"
            >
              {copy.common.deleteRoom}
            </button>
          </div>

          <div className="status-box">
            <strong>{copy.common.status}</strong>
            <span>{status}</span>
            {error ? <b className="error-text">{error}</b> : null}
          </div>
          </aside>
        ) : null}

        <section className="host-main">
          <div className="host-overview">
            <article>
              <span>{copy.common.room}</span>
              <strong>{hostSnapshot?.roomCode ?? "------"}</strong>
            </article>
            <article>
              <span>{copy.common.round}</span>
              <strong>{hostSnapshot?.currentRoundNumber ?? 0}/{hostSnapshot?.settings.roundsCount ?? settings.roundsCount}</strong>
            </article>
            <article>
              <span>{copy.common.phase}</span>
              <strong>{phaseLabel(locale, hostSnapshot?.roundState ?? null)}</strong>
            </article>
            <article>
              <span>{copy.common.timer}</span>
              <strong>{timer === null ? "n/a" : `${timer}${copy.common.secondsShort}`}</strong>
            </article>
          </div>

          {hostSnapshot ? (
            <>
              <div className="round-banner">
                <div>
                  <span>{copy.common.category}</span>
                  <strong>{hostSnapshot.categoryName ?? "n/a"}</strong>
                </div>
                <div>
                  <span>{copy.common.activePlayer}</span>
                  <strong>{hostSnapshot.activePlayerName ?? "n/a"}</strong>
                </div>
              </div>
              <PhaseStrip locale={locale} state={hostSnapshot.roundState} />
              <HostBoard locale={locale} snapshot={hostSnapshot} />
              <HostResults locale={locale} snapshot={hostSnapshot} />
            </>
          ) : (
            <section className="surface empty-state">
              <h2>{copy.host.noRoom}</h2>
              <p>{copy.host.waitingForPlayers}</p>
            </section>
          )}
        </section>

        <aside className="host-side">
          {hostSnapshot ? (
            <>
              <section className="surface join-surface">
                <div className="surface-title-row">
                  <h2>{copy.host.lobby}</h2>
                  <span className="state-pill">{hostSnapshot.roomStatus}</span>
                </div>
                <div className="room-code-display">{hostSnapshot.roomCode}</div>
                {qrUrl ? <img alt={copy.host.qr} className="qr-image" src={qrUrl} /> : null}
                {joinUrl ? <a className="join-link" href={joinUrl}>{joinUrl}</a> : null}
              </section>
              <Scoreboard entries={hostSnapshot.scoreboard} locale={locale} />
            </>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
