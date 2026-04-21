"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  ActivePlayerSnapshot,
  JoinedWaitingSnapshot,
  PlayerSnapshot,
  RoomRoleSnapshot
} from "@huegame/contracts";
import { RoomStatus } from "@huegame/contracts";

import { CoordinatePicker } from "@/components/coordinate-picker";
import { Scoreboard } from "@/components/scoreboard";
import { getCopy, phaseLabel } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getSavedPlayerToken, useRoomStore } from "@/lib/room-store";

type PlayerConsoleProps = {
  demoRole: "player" | "active-player" | "joined-waiting";
};

type JoinRoomResponse = {
  roomCode: string;
  playerName: string;
  sessionToken?: string;
};

function isPlayerSnapshot(snapshot: RoomRoleSnapshot | null): snapshot is PlayerSnapshot {
  return snapshot?.role === "player";
}

function isActiveSnapshot(snapshot: RoomRoleSnapshot | null): snapshot is ActivePlayerSnapshot {
  return snapshot?.role === "active-player";
}

function isWaitingSnapshot(snapshot: RoomRoleSnapshot | null): snapshot is JoinedWaitingSnapshot {
  return snapshot?.role === "joined-waiting";
}

function PlayerTopStats({ snapshot, locale }: { snapshot: RoomRoleSnapshot; locale: Locale }) {
  const copy = getCopy(locale);
  const chips = "chips" in snapshot ? snapshot.chips : 0;

  return (
    <div className="mobile-stats">
      <article>
        <span>{copy.common.room}</span>
        <strong>{snapshot.roomCode}</strong>
      </article>
      <article>
        <span>{copy.common.round}</span>
        <strong>{snapshot.currentRoundNumber}</strong>
      </article>
      <article>
        <span>{copy.common.phase}</span>
        <strong>{phaseLabel(locale, snapshot.roundState)}</strong>
      </article>
      <article>
        <span>{copy.common.bank}</span>
        <strong>{chips}</strong>
      </article>
    </div>
  );
}

function ActiveCard({ snapshot, locale }: { snapshot: ActivePlayerSnapshot; locale: Locale }) {
  const copy = getCopy(locale);

  return (
    <section className="active-card-surface">
      <div className="surface-title-row">
        <div>
          <span className="kicker">{copy.common.activePlayer}</span>
          <h1>{copy.player.activeTitle}</h1>
        </div>
        <span className="state-pill good">{copy.player.oralClue}</span>
      </div>
      <div className="private-color-card" style={{ backgroundColor: snapshot.targetColorHex ?? "#d7dde5" }}>
        <span>{copy.player.color}</span>
        <strong>{snapshot.targetColorHex ?? "n/a"}</strong>
      </div>
      <div className="private-card-grid">
        <article>
          <span>{copy.common.category}</span>
          <strong>{snapshot.categoryName ?? "n/a"}</strong>
        </article>
        <article>
          <span>{copy.player.coordinate}</span>
          <strong>{snapshot.canRevealCellCode ? snapshot.targetCellCode ?? "n/a" : copy.player.coordinateHidden}</strong>
        </article>
      </div>
    </section>
  );
}

function WaitingCard({ snapshot, locale }: { snapshot: JoinedWaitingSnapshot; locale: Locale }) {
  const copy = getCopy(locale);

  return (
    <section className="surface waiting-surface">
      <span className="kicker">{copy.common.waiting}</span>
      <h1>{copy.player.waitingTitle}</h1>
      <p>{copy.player.waitingText}</p>
      <div className="private-card-grid">
        <article>
          <span>{copy.common.round}</span>
          <strong>{snapshot.waitingForRoundNumber}</strong>
        </article>
        <article>
          <span>{copy.common.bank}</span>
          <strong>{snapshot.chips}</strong>
        </article>
      </div>
    </section>
  );
}

function PlayerResults({ snapshot, locale }: { snapshot: PlayerSnapshot | ActivePlayerSnapshot | JoinedWaitingSnapshot; locale: Locale }) {
  const copy = getCopy(locale);

  if (!snapshot.roundSummary) {
    return null;
  }

  const ownOutcome = snapshot.roundSummary.outcomes.find((outcome) => outcome.playerId === snapshot.playerId);

  return (
    <section className="surface compact-surface">
      <div className="surface-title-row">
        <h2>{copy.player.finishedTitle}</h2>
        <span className="state-pill">{snapshot.roundSummary.targetCellCode}</span>
      </div>
      {ownOutcome ? (
        <div className="private-card-grid">
          <article>
            <span>{copy.result.stake}</span>
            <strong>{ownOutcome.stake}</strong>
          </article>
          <article>
            <span>{copy.result.payout}</span>
            <strong>{ownOutcome.payout}</strong>
          </article>
          <article>
            <span>{copy.result.total}</span>
            <strong>{ownOutcome.newChips}</strong>
          </article>
        </div>
      ) : null}
    </section>
  );
}

export function PlayerConsole({ demoRole }: PlayerConsoleProps) {
  const { snapshot, status, error, loading, locale, ensureRealtime, setLocale, setDemoRole, runCommand } = useRoomStore();
  const copy = getCopy(locale);
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("Maks");
  const [sessionToken, setSessionToken] = useState("");

  useEffect(() => {
    ensureRealtime();
    const params = new URLSearchParams(window.location.search);
    const queryRoomCode = params.get("room")?.toUpperCase();
    const queryPlayerName = params.get("name");

    if (queryRoomCode) {
      setRoomCode(queryRoomCode);
    }

    if (queryPlayerName) {
      setPlayerName(queryPlayerName);
      setSessionToken(queryRoomCode ? getSavedPlayerToken(queryRoomCode, queryPlayerName) : "");
    }

    if (!queryRoomCode) {
      setDemoRole(demoRole);
    }
  }, [demoRole, ensureRealtime, setDemoRole]);

  useEffect(() => {
    if (snapshot && "playerName" in snapshot) {
      setRoomCode(snapshot.roomCode);
      setPlayerName(snapshot.playerName);
      setSessionToken((current) => current || getSavedPlayerToken(snapshot.roomCode, snapshot.playerName));
    }
  }, [snapshot]);

  const playerLike = isPlayerSnapshot(snapshot) || isActiveSnapshot(snapshot) || isWaitingSnapshot(snapshot);
  const activeRoomCode = playerLike ? snapshot.roomCode : roomCode;
  const activePlayerName = playerLike ? snapshot.playerName : playerName;
  const activeSessionToken = sessionToken || getSavedPlayerToken(activeRoomCode, activePlayerName);
  const isGameScreen = snapshot?.roomStatus === RoomStatus.IN_GAME || snapshot?.roomStatus === RoomStatus.FINISHED;

  async function exitRoom() {
    if (!activeRoomCode || !activePlayerName || !activeSessionToken) {
      return;
    }

    await runCommand("room.disconnect", {
      roomCode: activeRoomCode,
      playerName: activePlayerName,
      sessionToken: activeSessionToken
    });
  }

  return (
    <main className="app-page player-page">
      <header className="topbar">
        <Link className="brand" href="/">
          {copy.common.appName}
        </Link>
        <nav className="topnav" aria-label="Player">
          <Link href="/host">{copy.common.host}</Link>
          {playerLike ? (
            <button className="text-button" disabled={loading || !activeSessionToken} onClick={exitRoom} type="button">
              {copy.common.exitRoom}
            </button>
          ) : null}
          <button className="text-button" onClick={() => setDemoRole(demoRole)} type="button">
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

      <section className={isGameScreen ? "player-layout is-game" : "player-layout"}>
        {!isGameScreen ? (
        <section className="surface player-login-surface">
          <div className="surface-title-row">
            <div>
              <span className="kicker">{copy.common.player}</span>
              <h1>{copy.player.title}</h1>
            </div>
            <span className="state-pill">{snapshot?.role ?? copy.common.disconnected}</span>
          </div>

          <label className="field">
            <span>{copy.common.roomCode}</span>
            <input
              maxLength={6}
              value={roomCode}
              onChange={(event) => {
                const nextRoomCode = event.target.value.toUpperCase();
                setRoomCode(nextRoomCode);
                setSessionToken(getSavedPlayerToken(nextRoomCode, playerName));
              }}
            />
          </label>
          <label className="field">
            <span>{copy.common.name}</span>
            <input
              value={playerName}
              onChange={(event) => {
                const nextName = event.target.value;
                setPlayerName(nextName);
                setSessionToken(getSavedPlayerToken(roomCode, nextName));
              }}
            />
          </label>

          <div className="action-row">
            <button
              className="primary-button"
              disabled={loading || !roomCode || !playerName}
              onClick={async () => {
                const response = await runCommand<JoinRoomResponse>("room.join", {
                  roomCode,
                  playerName,
                  sessionToken: activeSessionToken || undefined
                });

                if (response?.sessionToken) {
                  setSessionToken(response.sessionToken);
                  await runCommand("room.reconnect", {
                    roomCode: response.roomCode,
                    playerName: response.playerName,
                    sessionToken: response.sessionToken
                  });
                }
              }}
              type="button"
            >
              {copy.player.joinRoom}
            </button>
            <button
              className="ghost-button"
              disabled={loading || !activeRoomCode || !activePlayerName || !activeSessionToken}
              onClick={() =>
                void runCommand("room.reconnect", {
                  roomCode: activeRoomCode,
                  playerName: activePlayerName,
                  sessionToken: activeSessionToken
                })
              }
              type="button"
            >
              {copy.player.reconnectPlayer}
            </button>
            <button
              className="ghost-button"
              disabled={loading || !activeRoomCode || !activePlayerName || !activeSessionToken}
              onClick={exitRoom}
              type="button"
            >
              {copy.common.exitRoom}
            </button>
          </div>
          <div className="status-box">
            <strong>{copy.common.status}</strong>
            <span>{status}</span>
            {error ? <b className="error-text">{error}</b> : null}
          </div>
        </section>
        ) : null}

        <section className="player-main">
          {snapshot ? (
            <PlayerTopStats snapshot={snapshot} locale={locale} />
          ) : (
            <section className="surface empty-state">
              <h2>{copy.player.joinRoom}</h2>
              <p>{copy.player.noFullBoard}</p>
            </section>
          )}

          {isActiveSnapshot(snapshot) ? <ActiveCard snapshot={snapshot} locale={locale} /> : null}

          {isPlayerSnapshot(snapshot) ? (
            <CoordinatePicker
              availableChips={snapshot.availableChips}
              isConfirmed={snapshot.isConfirmed}
              loading={loading}
              locale={locale}
              onConfirm={() =>
                void runCommand("vote.confirmBet", {
                  roomCode: activeRoomCode,
                  playerName: activePlayerName,
                  sessionToken: activeSessionToken
                })
              }
              onPlace={(x, y) =>
                void runCommand("vote.placeChip", {
                  roomCode: activeRoomCode,
                  playerName: activePlayerName,
                  sessionToken: activeSessionToken,
                  x,
                  y
                })
              }
              onRemove={(x, y) =>
                void runCommand("vote.removeChip", {
                  roomCode: activeRoomCode,
                  playerName: activePlayerName,
                  sessionToken: activeSessionToken,
                  x,
                  y
                })
              }
              onUnconfirm={() =>
                void runCommand("vote.unconfirmBet", {
                  roomCode: activeRoomCode,
                  playerName: activePlayerName,
                  sessionToken: activeSessionToken
                })
              }
              permissions={snapshot.actionPermissions}
              placements={snapshot.placements}
              reservedChips={snapshot.reservedChips}
            />
          ) : null}

          {isWaitingSnapshot(snapshot) ? <WaitingCard snapshot={snapshot} locale={locale} /> : null}

          {playerLike ? <PlayerResults snapshot={snapshot} locale={locale} /> : null}
        </section>

        <aside className="player-side">
          {snapshot ? <Scoreboard entries={snapshot.scoreboard} locale={locale} /> : null}
        </aside>
      </section>
    </main>
  );
}
