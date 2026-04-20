# HueGame Architecture V2

This document is the accepted baseline architecture for the HueGame project.
It is intended to be enough context to resume work on another PC without relying on prior chat history.

## Current Status

- Architecture V2 is accepted as the baseline design.
- Database design package is already prepared in:
  - `packages/database/prisma/schema.prisma`
  - `packages/database/README.md`
- Backend code and frontend code are not started yet.
- Prisma migrations and seed files are not created yet.

## Product Goal

HueGame is a production-like multiplayer browser game inspired by the board game "Ia tak vizhu".

Core constraints:

- one central server;
- multiple independent rooms;
- one host per room;
- host usually uses desktop/TV;
- players usually use mobile browsers;
- real-time gameplay;
- server-authoritative game state;
- reconnect must be reliable;
- host always sees the board, players do not.

## Core Game Rules

- Board size: `30 x 15`
- X axis: `1..30`
- Y axis: `A..O`
- Each cell maps to one color in a harmonious palette.
- Palette is deterministic from a seed and must stay stable during a game.
- Active player gets:
  - category
  - target cell
  - target color
  - cell code if room settings allow it
- Active player gives the clue orally.
- The clue is never typed into the system.
- Non-active players see only the category and place chips on coordinates.
- One player can place at most one chip per cell.
- Players may place chips on multiple cells.
- Players may keep part of their bank unspent.
- A player with `0` chips becomes eliminated.

## Recommended Stack

### Backend

- NestJS
- WebSocket Gateway
- PostgreSQL
- Prisma

### Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Framer Motion
- next-intl
- Zustand
- zod

### Infra

- Docker Compose
- Optional nginx reverse proxy

## Monorepo Shape

```text
apps/
  backend/
  frontend/
packages/
  contracts/
  domain/
  database/
  palette/
  i18n/
  ui/
  config/
  testing/
docs/
  architecture-v2.md
infra/
  docker/
  nginx/
```

Recommended package manager: `pnpm`  
Recommended task runner: `turbo`

## Backend Principles

- The server is the only source of truth.
- Clients never calculate round outcomes.
- Clients never own phase transitions.
- All important transitions happen on the server and are persisted.
- Real-time commands are validated before mutation.
- Business logic is separated from transport.
- Room state must survive reconnects and server restarts.

## Main Backend Modules

- `AuthSessionModule`
- `RoomsModule`
- `HostModule`
- `PlayersModule`
- `GameModule`
- `RoundsModule`
- `VotingModule`
- `CategoriesModule`
- `PaletteModule`
- `RealtimeGatewayModule`
- `I18nModule`
- `PersistenceModule`

Additional internal services:

- `RoomCommandSerializer`
- `ProjectionBuilder`
- `RecoveryService`

## Room and Game Lifecycle

### Room states

- `LOBBY`
- `STARTING`
- `IN_GAME`
- `FINISHED`
- `ARCHIVED`

### Game states

- `PENDING`
- `ACTIVE`
- `FINISHED`

### Round states

- `PREPARE_ROUND`
- `CLUE_VISIBLE`
- `VOTING_OPEN`
- `ALL_CONFIRMED_PENDING_FINALIZE`
- `REVEAL_VOTES`
- `REVEAL_ZONE`
- `ROUND_RESULTS`
- `ROUND_TRANSITION`
- `GAME_FINISHED`

## Palette Security Model

Two modes were considered:

### `STRICT`

- players never receive arbitrary cell colors before reveal;
- no `previewCell` for players during active play;
- mobile UI is coordinate-first, not board-first.

Pros:

- preserves fairness;
- prevents palette enumeration;
- better for production.

Cons:

- weaker mobile UX;
- less visual assistance while selecting coordinates.

### `RELAXED`

- players may request preview for a selected cell;
- server may rate-limit requests;
- enumeration risk is accepted.

Pros:

- better UX on mobile;
- easier onboarding for casual games.

Cons:

- modified clients can enumerate the whole palette;
- fairness is weaker.

### Chosen production default

- `playerPaletteAccessMode = STRICT`

`RELAXED` may exist as an explicit room option or feature flag, but should not be the default.

## Betting Economy

Definitions:

- `resolvedChips` = player's persisted bank after the last completed round
- `reservedChips` = count of the player's placements in the current round
- `availableChips = resolvedChips - reservedChips`

Rules:

1. A chip becomes reserved immediately after a successful `placeChip`.
2. Removing a placement releases the reservation immediately.
3. `confirmBet` is allowed only when `reservedChips >= 1`.
4. Confirm does not permanently lock the set of placements.
5. Each placement change increments `placementVersion`.
6. Confirm stores `confirmVersion = placementVersion`.
7. A participant is considered confirmed only when:
   - `confirmVersion == placementVersion`
   - `reservedChips >= 1`
8. If all blocking voters are confirmed, server writes `allConfirmedAt`.
9. Server then sets `phaseDeadlineAt = allConfirmedAt + 10s`.
10. This 10-second timer does not reset after later edits.
11. If a player reaches voting close with placements but without a valid confirm, the draft placements still become final.
12. If a player reaches voting close with `0` placements, the turn is treated as skipped.
13. Result application formula:
   - `newChips = resolvedChips - roundStake + roundPayout`
14. A player with `newChips = 0` becomes eliminated before the next round.

## Active Player Selection Algorithm

Queue rules:

- queue order is always `joinOrder ASC`;
- reconnect never changes `joinOrder`;
- new players joining mid-game receive the next max `joinOrder`;
- mid-game joiners get `canParticipateNextRound = false` until the next round transition.

Selection algorithm for each new round:

1. Build `eligibleQueue` from players where:
   - `lifecycleState = ACTIVE`
   - `canParticipateNextRound = true`
2. Count `round-ready` players:
   - eligible and `connectionState = CONNECTED`
3. If fewer than 2 round-ready players exist:
   - do not auto-finish the game;
   - set `Game.roundStartBlockedAt` if not already set;
   - keep `Game.status = ACTIVE`;
   - wait for reconnect or eventual room archival policy.
4. Otherwise scan circularly from the first `joinOrder > lastActiveJoinOrder`.
5. First connected eligible player becomes the new active player.
6. Disconnected players are skipped only for that selection cycle.
7. When selected, write `Game.lastActiveJoinOrder = activePlayer.joinOrder`.

Important consequences:

- eliminated players never return to the queue;
- reconnect restores future eligibility only;
- a skipped turn is not retroactively restored.

## Round Participation Rules

At `PREPARE_ROUND`, the server freezes the participant set for that round in `RoundParticipant`.

Participant roles:

- `ACTIVE_PLAYER`
- `VOTER`

Round composition rules:

- active player is included as `ACTIVE_PLAYER`;
- eligible non-active participants are included as `VOTER`;
- players who join during an active round are not added to the current round;
- they use `JoinedWaitingSnapshot` until the next round;
- if a voter disconnects during `VOTING_OPEN`, quorum logic may exclude them from blocking confirmation if needed to avoid hanging the round.

## Quorum Model

`RoundParticipant.quorumStatus` values:

- `NOT_REQUIRED`
- `BLOCKING`
- `SATISFIED`
- `EXCLUDED`

Meaning:

- `NOT_REQUIRED`: active player or a participant that does not block voting close
- `BLOCKING`: this participant currently blocks `allConfirmedAt`
- `SATISFIED`: confirmed and currently counted as complete
- `EXCLUDED`: temporarily excluded from the blocking quorum, for example due to disconnect

## Detailed Phase Machine

### `PREPARE_ROUND`

Allowed client commands:

- reconnect commands
- join commands
- ping

Forbidden gameplay commands:

- `placeChip`
- `removeChip`
- `confirmBet`
- `unconfirmBet`

Server work:

- choose active player
- freeze participants
- choose category
- choose target cell
- bind palette snapshot

Persisted timing field:

- `stateEnteredAt`

### `CLUE_VISIBLE`

Allowed:

- reconnect commands
- join commands
- ping

Forbidden:

- all voting commands

Server work:

- send active player private card
- send public round data to host and voters
- transition immediately to `VOTING_OPEN`

Persisted timing field:

- `stateEnteredAt`

### `VOTING_OPEN`

Allowed:

- `placeChip`
- `removeChip`
- `confirmBet`
- `unconfirmBet`
- optional palette preview only in `RELAXED`

Forbidden:

- any reveal or finalize command from clients

Transition forward happens when:

- all blocking voters are confirmed and `phaseDeadlineAt` expires
- or optional `hardVotingDeadlineAt` expires

Persisted timing fields:

- `stateEnteredAt`
- `allConfirmedAt`
- `phaseDeadlineAt`
- `hardVotingDeadlineAt`

### `ALL_CONFIRMED_PENDING_FINALIZE`

Allowed:

- reconnect commands
- join commands
- ping

Forbidden:

- all voting commands

Server work:

- atomically close voting
- convert current draft set into final placements for scoring

Persisted timing fields:

- `stateEnteredAt`
- `votingClosedAt`

### `REVEAL_VOTES`

Allowed:

- reconnect commands
- join commands
- ping

Forbidden:

- all voting commands

Server work:

- reveal all final placements to host
- optionally reveal limited result status to players

Persisted timing field:

- `phaseDeadlineAt`

### `REVEAL_ZONE`

Allowed:

- reconnect commands
- join commands
- ping

Forbidden:

- all voting commands

Server work:

- show 5x5 zone around target
- classify each placement as `MISS`, `EDGE`, `NEAR`, or `CENTER`

Persisted timing field:

- `phaseDeadlineAt`

### `ROUND_RESULTS`

Allowed:

- reconnect commands
- join commands
- ping

Forbidden:

- all voting commands

Server work:

- apply multipliers
- update player banks
- mark eliminated players
- store round summary

Persisted timing fields:

- `phaseDeadlineAt`
- `resolvedAt`

### `ROUND_TRANSITION`

Allowed:

- reconnect commands
- join commands
- ping

Forbidden:

- all voting commands

Server work:

- enable `canParticipateNextRound = true` for waiting joiners
- either start the next round or finish the game

Persisted timing field:

- `phaseDeadlineAt`

### `GAME_FINISHED`

Allowed:

- reconnect commands for existing room participants
- ping

Forbidden:

- new gameplay commands
- new player join

Server work:

- finalize scoreboard
- mark room and game as finished

Persisted timing fields:

- `finishedAt`

## Role-Based Projections

The server never sends one universal game snapshot.
It sends role-specific projections.

### `HostSnapshot`

Includes:

- room public state
- room settings
- game progress
- round number, phase, timer
- active player name
- category
- full palette
- scoreboard
- reveal data when phase allows it
- `roundStartBlocked` information

Hides:

- player and host session token hashes
- target cell before reveal
- player placements before `REVEAL_VOTES`

Used in:

- host lobby
- host game screen
- finished screen for host

### `PlayerSnapshot`

Includes:

- room public state
- game public state
- round number, phase, timer
- category
- self bank information
- self placements
- self confirmation state
- action permissions

Hides:

- full palette in `STRICT`
- target color
- target cell
- other players' placements before allowed reveal

Used in:

- normal voter flow

### `ActivePlayerSnapshot`

Includes:

- public round info
- self info
- private card:
  - category
  - target color
  - target cell code if allowed
- lightweight scoreboard

Hides:

- full palette
- other players' placements
- other players' confirmation details

Used in:

- active player mobile screen

### `JoinedWaitingSnapshot`

Includes:

- room public state
- game public state
- round public state
- self bank
- join order
- explicit waiting flag for next round

Hides:

- private card
- betting controls
- other players' placements
- full palette

Used in:

- player joined while a round was already in progress

### `FinishedSnapshot`

Includes:

- finished room state
- final leaderboard
- self summary
- last round summary

Hides:

- session token hashes
- internal-only service fields

Used in:

- room finished state for host and existing players

## Reconnect Model

### Host reconnect

Flow:

1. client sends `host.reconnect(roomCode, sessionToken)`
2. server validates `sessionTokenHash`
3. server marks host as connected
4. server attaches socket to host room channel
5. server returns fresh `HostSnapshot`

### Active player reconnect

Flow:

1. client sends `room.reconnect(roomCode, playerName, sessionToken)` or equivalent player reconnect payload
2. server validates token ownership
3. server recomputes the current role
4. if player is still the active player of the current round:
   - send `ActivePlayerSnapshot`
   - do not restart the round
   - do not reset any timer

### Inactive player reconnect

Flow:

1. validate token
2. restore player connection state
3. return `PlayerSnapshot`
4. restore own draft placements from DB
5. if the 10-second window already started, player may still edit until close, but timer is unchanged

### Joined-waiting reconnect

Flow:

1. validate token
2. return `JoinedWaitingSnapshot`
3. keep `canParticipateNextRound = false` until round transition

General reconnect rules:

- reconnect never changes `joinOrder`
- reconnect never rewinds state
- reconnect returns a full fresh snapshot, not event replay
- if a name is occupied but the token matches, treat it as reconnect
- if a name is occupied and token does not match, reject the request

## Acceptance and Edge Cases

The following scenarios must be supported:

1. Default room creation uses required default settings.
2. Room code is unique and short.
3. Identical palette seed always generates identical palette.
4. In `STRICT`, players cannot enumerate the palette.
5. Duplicate player name without valid token is rejected.
6. Duplicate player name with valid token restores the same player.
7. Game start is blocked if fewer than two round-ready players exist.
8. Active player selection follows `joinOrder` with wrap-around.
9. Mid-game join receives a new max `joinOrder`.
10. Mid-game join does not enter the current round.
11. Reconnect never changes queue order.
12. A player cannot place two chips in the same cell in one round.
13. `reservedChips` updates immediately on placement add/remove.
14. `confirmBet` with zero placements is rejected.
15. Any placement change invalidates confirm until reconfirmed.
16. `allConfirmedAt` is written once and is not reset by later edits.
17. The 10-second timer never restarts after it has begun.
18. Disconnected voters must not hang the round forever.
19. Host does not see placements before `REVEAL_VOTES`.
20. Non-active players do not see others' placements before allowed reveal.
21. Multipliers are applied per placement, not per player total.
22. Players with zero chips after results become eliminated.
23. Backend restart must allow state recovery from persisted deadlines.
24. Join into `FINISHED` is rejected.
25. Existing participants may reconnect into `FINISHED` and see results.

## Database Baseline

The current accepted database design already exists in `packages/database`.

Main persisted entities:

- `Room`
- `RoomSettings`
- `HostSession`
- `Player`
- `Game`
- `Category`
- `PaletteSnapshot`
- `Round`
- `RoundParticipant`
- `Placement`
- `SessionAuditEvent`

Important schema additions from V2:

- `RoomSettings.playerPaletteAccessMode`
- `Round.stateEnteredAt`
- `Round.hardVotingDeadlineAt`
- `RoundParticipant.placementVersion`
- `RoundParticipant.confirmVersion`
- `RoundParticipant.quorumStatus`

## Explicit Assumptions

These assumptions are intentional and should stay visible:

1. One backend instance is enough for the initial production target.
2. Horizontal scaling is not in scope yet.
3. There is only one host session per room.
4. Full placement edit history is not stored as event sourcing.
5. `STRICT` palette mode is the default production mode.
6. Join in `FINISHED` is rejected.
7. Long `roundStartBlocked` does not auto-finish the game.
8. Room archival is driven by inactivity policy, not by a blocked round alone.
9. `Round.summaryJson` is stored as a denormalized convenience projection.
10. Reconnect audit trail is stored in the database.

## Next Recommended Steps

The next implementation steps should happen in this order:

1. add `pnpm` workspace and package manifests;
2. add Prisma migration scaffold and seed files in `packages/database`;
3. add shared `contracts` and `domain` packages;
4. create NestJS backend skeleton;
5. create Next.js frontend skeleton;
6. implement room/game/round orchestration;
7. implement WebSocket projections and reconnect flows.

## Resume Checklist For Another PC

When resuming work on a new machine:

1. read this file first;
2. read `packages/database/prisma/schema.prisma`;
3. read `packages/database/README.md`;
4. continue with Prisma migrations and seed implementation;
5. only then move on to backend skeleton.
