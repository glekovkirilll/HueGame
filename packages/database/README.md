# Database Design Package

This package locks the baseline database design for Architecture V2 and prepares the next step: Prisma migrations, seed data, and backend database integration.

## Files

- `prisma/schema.prisma` - main PostgreSQL + Prisma schema
- `prisma/migrations/20260420_000001_init/migration.sql` - initial SQL migration scaffold
- `prisma/seed.ts` - Prisma seed entrypoint
- `prisma/categories.seed.ts` - production-like RU/EN category dataset
- `.env.example` - local database connection template

## Package Scripts

Run from the repo root or from `packages/database`:

- `pnpm db:generate` - generate Prisma client
- `pnpm db:migrate:dev` - create/apply development migration
- `pnpm db:migrate:deploy` - apply committed migrations
- `pnpm db:seed` - populate categories catalog

## Model overview

- `Room` - room lifecycle and pointer to the current game.
- `RoomSettings` - strongly typed room settings without a JSON blob.
- `HostSession` - dedicated host session, separate from players.
- `Player` - room player with stable identity via `sessionTokenHash`.
- `Game` - one match inside a room, including queue cursor and blocked-start marker.
- `Category` - RU/EN category catalog.
- `PaletteSnapshot` - deterministic palette snapshot for a game.
- `Round` - server-side round state, deadlines, secret target, and materialized summary.
- `RoundParticipant` - locked participant list for a round, including role, quorum state, and bet versions.
- `Placement` - one chip from one player in one cell.
- `SessionAuditEvent` - append-only audit log for join/connect/reconnect flows.

## Why the schema looks like this

- `Room.language` and `Room.hostSessionId` are intentionally not duplicated.
  Locale lives in `RoomSettings.defaultLocale`, and the host is linked one-to-one through `HostSession.roomId`.
- `GameStatus` does not include a dedicated `BLOCKED` value.
  A blocked round start is an operational condition inside `Game.status=ACTIVE`, so `roundStartBlockedAt` is enough.
- `Round.summaryJson` is stored on purpose.
  It is a denormalized projection, not the source of truth. It makes `FinishedSnapshot`, audit, and result replay much simpler.
- `Player.nameNormalized` is stored separately.
  This gives case-insensitive uniqueness without depending on `citext`.

## Columns vs JSON

Keep as columns:

- statuses and enums;
- room timing settings;
- `chips`, `joinOrder`, `placementVersion`, `confirmVersion`;
- `targetCellX` and `targetCellY`;
- localized category fields `nameRu` and `nameEn`.

Keep as JSON:

- `PaletteSnapshot.cellsJson` - full 30x15 palette snapshot;
- `Round.summaryJson` - materialized resolved round summary;
- `SessionAuditEvent.metadata` - extra audit context without bloating the core schema.

## Tradeoffs

- `SessionAuditEvent` is included in the base schema.
  This increases write volume, but it gives production-grade auditability for reconnect and name-conflict incidents.
- Full placement edit history is not stored.
  The schema keeps the current placement state, not full event sourcing.
- Coordinate range checks (`x 1..30`, `y 1..15`) are not expressible in Prisma alone.
  Add them later with a raw SQL migration and mirror them in domain validation.

## Seed strategy

### 1. Categories RU/EN

Seed must populate `Category` with a production-like dataset, not a tiny test set.

Recommended approach:

- 60-100 categories at the first stage;
- each entry contains `slug`, `nameRu`, `nameEn`, `isActive=true`, `sortOrder`;
- use upsert by `slug` so the seed stays idempotent;
- store the source dataset in `categories.seed.ts` as a typed array;
- separate the seed into a base pack and optional theme packs.

Current implementation:

- base pack contains 70 bilingual categories;
- seed uses Prisma `upsert` to stay idempotent;
- current scope covers the minimum starting groups from the architecture document.

Minimum starting groups:

- food and drinks;
- clothing and fabrics;
- nature, sky, sea, seasons, weather;
- interior, furniture, household items;
- transport, sport, technology;
- art, music, cinema, emotions;
- cosmetic shades, skin tones, stones, metals;
- retro, vintage, childhood, school, travel.

### 2. Initial system defaults

The base version does not need a dedicated DB seed table for global settings.
Initial defaults should live in code and environment configuration:

- `roundsCount=10`
- `startChips=10`
- `showCellCodeToActivePlayer=true`
- `defaultLocale=ru`
- `playerPaletteAccessMode=STRICT`
- `allConfirmedWindowMs=10000`

If an admin panel for changing global defaults without redeploy is needed later, add a separate table such as `SystemConfig`.

## Clarifications for the four open questions

### 1. What if `roundStartBlocked` lasts too long

- The game should not auto-finish only because the next round cannot start.
- Base behavior: `Game.status` stays `ACTIVE`, and `Game.roundStartBlockedAt` stores the time when blocking started.
- Cleanup should be driven by a room inactivity policy. If a room has no host/player activity for a long time, it can be moved to `ARCHIVED`.

### 2. Is join allowed in `finished`

- No. In the base production schema, join into `Room.status=FINISHED` is rejected.
- `finished` is read-only for results and reconnect of already known participants.
- A new match should use a new room, or a future explicit rematch/reset operation.

### 3. Do we need reconnect audit trail

- Yes. This version includes it through `SessionAuditEvent`.
- It is useful for investigating reconnect complaints, name conflicts, and general connection stability.

### 4. Should we store last-round summary for `FinishedSnapshot`

- Yes. Store a materialized `Round.summaryJson`.
- The source of truth remains normalized: `Round + RoundParticipant + Placement`.
- But `summaryJson` makes final screens, replay, and fast result fetches much simpler.

## Implementation Notes

- The committed SQL migration mirrors the current Prisma schema and also adds raw SQL coordinate checks for `Round.targetCellX`, `Round.targetCellY`, `Placement.x`, and `Placement.y`.
- `@updatedAt` behavior is still modeled in Prisma; regular app writes through Prisma will keep `updatedAt` correct.
- The next recommended code step after database bootstrap is adding shared `contracts` and `domain` packages for room lifecycle and round-state invariants.
