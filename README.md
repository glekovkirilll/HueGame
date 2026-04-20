# HueGame

Project documentation entry points:

- [Architecture V2](docs/architecture-v2.md)
- [Database Design Package](packages/database/README.md)

## Workspace Status

The repository now includes:

- `pnpm` workspace configuration;
- `turbo` root task runner configuration;
- a runnable `@huegame/database` package;
- shared `@huegame/contracts` and `@huegame/domain` package skeletons;
- a Next.js frontend scaffold in `apps/frontend`;
- Prisma seed files and an initial SQL migration scaffold;
- a NestJS backend scaffold in `apps/backend` with realtime room/game flows.

## Quick Start

1. Install dependencies with `pnpm install`.
2. Copy `packages/database/.env.example` to `packages/database/.env` and set `DATABASE_URL`.
3. Run `pnpm db:generate`.
4. Run `pnpm db:migrate:deploy`.
5. Run `pnpm db:seed`.
6. Run `pnpm backend:dev`.
7. Run `pnpm frontend:dev`.

In this workspace session, the remaining work is mostly runtime validation, tests, deployment hardening, and final product polish rather than first-pass architecture scaffolding.

## Backend Entry Point

The backend scaffold now lives in `apps/backend` and includes:

- `AppModule` with the architecture V2 module split;
- a Socket.IO gateway with `room.create`, `room.join`, `host.reconnect`, `room.reconnect`, `host.disconnect`, `room.disconnect`, `game.start`, `round.advance`, voting commands, and `system.tick`;
- Prisma-backed room creation, player join/reconnect, and game-start orchestration;
- role-aware reconnect snapshots for host, active player, normal player, and joined-waiting player;
- reveal/result-aware snapshots that can include persisted round summaries when phase visibility allows it;
- deterministic palette seed/target-cell helpers for the first persisted round;
- persisted transitions from `PREPARE_ROUND` to `CLUE_VISIBLE` and `VOTING_OPEN`;
- persisted betting commands for `placeChip`, `removeChip`, `confirmBet`, and `unconfirmBet`;
- persisted round lifecycle through voting close, reveal, result application, and next-round preparation;
- disconnect handling and deadline-driven round advancement hooks for server automation;
- an in-process round deadline runner that advances due rooms automatically on an interval.

Once dependencies are installed, the intended local command is `pnpm backend:dev`.

## Frontend Entry Point

The frontend scaffold now lives in `apps/frontend` and includes:

- a landing page and role-specific routes for host, player, active player, and joined-waiting flows;
- shared sample snapshots that mirror backend contracts;
- a minimal Socket.IO client helper for wiring real commands to the Nest backend;
- a client-side room store for demo snapshots and live websocket command execution;
- interactive host/player control panels for create, reconnect, start, advance, voting, and disconnect flows.

Once dependencies are installed, the intended local command is `pnpm frontend:dev`.

## Local Infra

For a one-command local stack, use `infra/docker/docker-compose.yml`.
It starts:

- PostgreSQL
- a one-shot backend init container that applies Prisma migrations and seeds categories;
- the Nest backend
- the Next.js frontend

Use `.env.example` as the starting point for local environment variables outside Docker.

To start the full stack with Docker Compose:

1. Run `docker compose -f infra/docker/docker-compose.yml up --build`.
2. Open `http://localhost:3000` for the frontend.
3. The backend websocket/API entry point will be available at `http://localhost:3001`.
4. PostgreSQL will be exposed on `localhost:5432`.

Notes:

- the Docker stack does not rely on bind-mounts and installs the workspace inside the image;
- `backend-init` runs `prisma migrate deploy` and `prisma db seed` before the backend starts;
- frontend and backend currently run in workspace dev-runtime inside containers because shared packages are still source-first workspace packages rather than separately built production libraries.

## Current Gaps

The core monorepo structure, contracts, domain logic, Prisma package, backend orchestration, and frontend realtime shells are now in place.
What still needs to be completed for a production-ready system:

- install dependencies and run the workspace end-to-end locally;
- add automated tests for domain rules, repositories, and websocket flows;
- finalize Prisma migrations against a real PostgreSQL instance;
- connect frontend screens to richer room/game visualizations beyond the operator consoles;
- add auth/session hardening, observability, and deployment configuration.
