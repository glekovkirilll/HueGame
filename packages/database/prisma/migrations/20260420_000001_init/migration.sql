CREATE TYPE "RoomStatus" AS ENUM ('LOBBY', 'STARTING', 'IN_GAME', 'FINISHED', 'ARCHIVED');
CREATE TYPE "GameStatus" AS ENUM ('PENDING', 'ACTIVE', 'FINISHED');
CREATE TYPE "RoundState" AS ENUM (
  'PREPARE_ROUND',
  'CLUE_VISIBLE',
  'VOTING_OPEN',
  'ALL_CONFIRMED_PENDING_FINALIZE',
  'REVEAL_VOTES',
  'REVEAL_ZONE',
  'ROUND_RESULTS',
  'ROUND_TRANSITION',
  'GAME_FINISHED'
);
CREATE TYPE "PlayerConnectionState" AS ENUM ('CONNECTED', 'DISCONNECTED');
CREATE TYPE "PlayerLifecycleState" AS ENUM ('ACTIVE', 'ELIMINATED');
CREATE TYPE "RoundRole" AS ENUM ('ACTIVE_PLAYER', 'VOTER');
CREATE TYPE "PlacementStatus" AS ENUM ('DRAFT', 'LOCKED', 'MISS', 'EDGE', 'NEAR', 'CENTER');
CREATE TYPE "SkippedReason" AS ENUM ('ACTIVE_PLAYER', 'DISCONNECTED_DURING_VOTING', 'NO_PLACEMENTS_AT_CLOSE');
CREATE TYPE "PaletteAccessMode" AS ENUM ('STRICT', 'RELAXED');
CREATE TYPE "QuorumStatus" AS ENUM ('NOT_REQUIRED', 'BLOCKING', 'SATISFIED', 'EXCLUDED');
CREATE TYPE "SessionActorType" AS ENUM ('HOST', 'PLAYER');
CREATE TYPE "SessionAuditEventType" AS ENUM (
  'ROOM_CREATED',
  'ROOM_JOINED',
  'RECONNECT_ACCEPTED',
  'RECONNECT_REJECTED',
  'SOCKET_CONNECTED',
  'SOCKET_DISCONNECTED',
  'SESSION_RESTORED',
  'NAME_CONFLICT_REJECTED'
);

CREATE TABLE "Room" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(12) NOT NULL,
  "status" "RoomStatus" NOT NULL DEFAULT 'LOBBY',
  "stateRevision" INTEGER NOT NULL DEFAULT 0,
  "currentGameId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomSettings" (
  "roomId" TEXT NOT NULL,
  "roundsCount" INTEGER NOT NULL DEFAULT 10,
  "startChips" INTEGER NOT NULL DEFAULT 10,
  "showCellCodeToActivePlayer" BOOLEAN NOT NULL DEFAULT true,
  "allowCategoryRepeats" BOOLEAN NOT NULL DEFAULT false,
  "defaultLocale" VARCHAR(8) NOT NULL DEFAULT 'ru',
  "paletteSeed" VARCHAR(128),
  "playerPaletteAccessMode" "PaletteAccessMode" NOT NULL DEFAULT 'STRICT',
  "allConfirmedWindowMs" INTEGER NOT NULL DEFAULT 10000,
  "hardVotingDeadlineMs" INTEGER,
  "revealVotesMs" INTEGER NOT NULL DEFAULT 3500,
  "revealZoneMs" INTEGER NOT NULL DEFAULT 3500,
  "roundResultsMs" INTEGER NOT NULL DEFAULT 4500,
  "roundTransitionMs" INTEGER NOT NULL DEFAULT 2500,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomSettings_pkey" PRIMARY KEY ("roomId")
);

CREATE TABLE "HostSession" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "sessionTokenHash" VARCHAR(255) NOT NULL,
  "connectionState" "PlayerConnectionState" NOT NULL DEFAULT 'CONNECTED',
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HostSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Player" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "name" VARCHAR(64) NOT NULL,
  "nameNormalized" VARCHAR(64) NOT NULL,
  "sessionTokenHash" VARCHAR(255) NOT NULL,
  "connectionState" "PlayerConnectionState" NOT NULL DEFAULT 'CONNECTED',
  "lifecycleState" "PlayerLifecycleState" NOT NULL DEFAULT 'ACTIVE',
  "chips" INTEGER NOT NULL DEFAULT 0,
  "joinOrder" INTEGER NOT NULL,
  "canParticipateNextRound" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Game" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "status" "GameStatus" NOT NULL DEFAULT 'PENDING',
  "roundsPlanned" INTEGER NOT NULL,
  "currentRoundNumber" INTEGER NOT NULL DEFAULT 0,
  "lastActiveJoinOrder" INTEGER,
  "roundStartBlockedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "slug" VARCHAR(128) NOT NULL,
  "nameRu" VARCHAR(128) NOT NULL,
  "nameEn" VARCHAR(128) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaletteSnapshot" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "seed" VARCHAR(128) NOT NULL,
  "generatorKey" VARCHAR(32) NOT NULL DEFAULT 'oklch-v1',
  "cellsJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaletteSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Round" (
  "id" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "state" "RoundState" NOT NULL DEFAULT 'PREPARE_ROUND',
  "stateRevision" INTEGER NOT NULL DEFAULT 0,
  "stateEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activePlayerId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "targetCellX" SMALLINT NOT NULL,
  "targetCellY" SMALLINT NOT NULL,
  "paletteSnapshotId" TEXT NOT NULL,
  "allConfirmedAt" TIMESTAMP(3),
  "phaseDeadlineAt" TIMESTAMP(3),
  "hardVotingDeadlineAt" TIMESTAMP(3),
  "votingClosedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "summaryJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Round_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Round_targetCellX_check" CHECK ("targetCellX" BETWEEN 1 AND 30),
  CONSTRAINT "Round_targetCellY_check" CHECK ("targetCellY" BETWEEN 1 AND 15)
);

CREATE TABLE "RoundParticipant" (
  "roundId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "role" "RoundRole" NOT NULL,
  "mustBet" BOOLEAN NOT NULL DEFAULT false,
  "chipsAtRoundStart" INTEGER NOT NULL,
  "placementVersion" INTEGER NOT NULL DEFAULT 0,
  "confirmVersion" INTEGER,
  "confirmedAt" TIMESTAMP(3),
  "quorumStatus" "QuorumStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "skippedReason" "SkippedReason",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoundParticipant_pkey" PRIMARY KEY ("roundId", "playerId")
);

CREATE TABLE "Placement" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "x" SMALLINT NOT NULL,
  "y" SMALLINT NOT NULL,
  "status" "PlacementStatus" NOT NULL DEFAULT 'DRAFT',
  "multiplier" SMALLINT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "Placement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Placement_x_check" CHECK ("x" BETWEEN 1 AND 30),
  CONSTRAINT "Placement_y_check" CHECK ("y" BETWEEN 1 AND 15)
);

CREATE TABLE "SessionAuditEvent" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "playerId" TEXT,
  "hostSessionId" TEXT,
  "actorType" "SessionActorType" NOT NULL,
  "eventType" "SessionAuditEventType" NOT NULL,
  "ipHash" VARCHAR(128),
  "userAgent" VARCHAR(255),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Room_code_key" ON "Room"("code");
CREATE UNIQUE INDEX "Room_currentGameId_key" ON "Room"("currentGameId");
CREATE INDEX "Room_status_createdAt_idx" ON "Room"("status", "createdAt");
CREATE INDEX "Room_status_updatedAt_idx" ON "Room"("status", "updatedAt");

CREATE UNIQUE INDEX "HostSession_roomId_key" ON "HostSession"("roomId");
CREATE UNIQUE INDEX "HostSession_sessionTokenHash_key" ON "HostSession"("sessionTokenHash");
CREATE INDEX "HostSession_connectionState_lastSeenAt_idx" ON "HostSession"("connectionState", "lastSeenAt");

CREATE UNIQUE INDEX "Player_sessionTokenHash_key" ON "Player"("sessionTokenHash");
CREATE UNIQUE INDEX "Player_roomId_nameNormalized_key" ON "Player"("roomId", "nameNormalized");
CREATE UNIQUE INDEX "Player_roomId_joinOrder_key" ON "Player"("roomId", "joinOrder");
CREATE INDEX "Player_roomId_lifecycleState_connectionState_idx" ON "Player"("roomId", "lifecycleState", "connectionState");
CREATE INDEX "Player_roomId_canParticipateNextRound_joinOrder_idx" ON "Player"("roomId", "canParticipateNextRound", "joinOrder");
CREATE INDEX "Player_roomId_lastSeenAt_idx" ON "Player"("roomId", "lastSeenAt");

CREATE INDEX "Game_roomId_status_createdAt_idx" ON "Game"("roomId", "status", "createdAt");
CREATE INDEX "Game_status_roundStartBlockedAt_idx" ON "Game"("status", "roundStartBlockedAt");

CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_isActive_sortOrder_idx" ON "Category"("isActive", "sortOrder");

CREATE UNIQUE INDEX "PaletteSnapshot_gameId_key" ON "PaletteSnapshot"("gameId");
CREATE INDEX "PaletteSnapshot_roomId_createdAt_idx" ON "PaletteSnapshot"("roomId", "createdAt");

CREATE UNIQUE INDEX "Round_gameId_number_key" ON "Round"("gameId", "number");
CREATE INDEX "Round_gameId_state_number_idx" ON "Round"("gameId", "state", "number");
CREATE INDEX "Round_activePlayerId_state_idx" ON "Round"("activePlayerId", "state");
CREATE INDEX "Round_state_phaseDeadlineAt_idx" ON "Round"("state", "phaseDeadlineAt");
CREATE INDEX "Round_state_hardVotingDeadlineAt_idx" ON "Round"("state", "hardVotingDeadlineAt");

CREATE INDEX "RoundParticipant_roundId_role_idx" ON "RoundParticipant"("roundId", "role");
CREATE INDEX "RoundParticipant_roundId_quorumStatus_idx" ON "RoundParticipant"("roundId", "quorumStatus");
CREATE INDEX "RoundParticipant_playerId_roundId_idx" ON "RoundParticipant"("playerId", "roundId");

CREATE UNIQUE INDEX "Placement_roundId_playerId_x_y_key" ON "Placement"("roundId", "playerId", "x", "y");
CREATE INDEX "Placement_roundId_status_idx" ON "Placement"("roundId", "status");
CREATE INDEX "Placement_playerId_roundId_idx" ON "Placement"("playerId", "roundId");
CREATE INDEX "Placement_roundId_x_y_idx" ON "Placement"("roundId", "x", "y");

CREATE INDEX "SessionAuditEvent_roomId_createdAt_idx" ON "SessionAuditEvent"("roomId", "createdAt");
CREATE INDEX "SessionAuditEvent_playerId_createdAt_idx" ON "SessionAuditEvent"("playerId", "createdAt");
CREATE INDEX "SessionAuditEvent_hostSessionId_createdAt_idx" ON "SessionAuditEvent"("hostSessionId", "createdAt");
CREATE INDEX "SessionAuditEvent_actorType_eventType_createdAt_idx" ON "SessionAuditEvent"("actorType", "eventType", "createdAt");

ALTER TABLE "RoomSettings"
  ADD CONSTRAINT "RoomSettings_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HostSession"
  ADD CONSTRAINT "HostSession_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Player"
  ADD CONSTRAINT "Player_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Game"
  ADD CONSTRAINT "Game_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaletteSnapshot"
  ADD CONSTRAINT "PaletteSnapshot_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaletteSnapshot"
  ADD CONSTRAINT "PaletteSnapshot_gameId_fkey"
  FOREIGN KEY ("gameId") REFERENCES "Game"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Round"
  ADD CONSTRAINT "Round_gameId_fkey"
  FOREIGN KEY ("gameId") REFERENCES "Game"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Round"
  ADD CONSTRAINT "Round_activePlayerId_fkey"
  FOREIGN KEY ("activePlayerId") REFERENCES "Player"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Round"
  ADD CONSTRAINT "Round_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Round"
  ADD CONSTRAINT "Round_paletteSnapshotId_fkey"
  FOREIGN KEY ("paletteSnapshotId") REFERENCES "PaletteSnapshot"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoundParticipant"
  ADD CONSTRAINT "RoundParticipant_roundId_fkey"
  FOREIGN KEY ("roundId") REFERENCES "Round"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoundParticipant"
  ADD CONSTRAINT "RoundParticipant_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "Player"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Placement"
  ADD CONSTRAINT "Placement_roundId_fkey"
  FOREIGN KEY ("roundId") REFERENCES "Round"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Placement"
  ADD CONSTRAINT "Placement_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "Player"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionAuditEvent"
  ADD CONSTRAINT "SessionAuditEvent_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionAuditEvent"
  ADD CONSTRAINT "SessionAuditEvent_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "Player"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SessionAuditEvent"
  ADD CONSTRAINT "SessionAuditEvent_hostSessionId_fkey"
  FOREIGN KEY ("hostSessionId") REFERENCES "HostSession"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Room"
  ADD CONSTRAINT "Room_currentGameId_fkey"
  FOREIGN KEY ("currentGameId") REFERENCES "Game"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
