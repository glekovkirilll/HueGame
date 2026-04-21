FROM node:22-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /workspace

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json .npmrc ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/database/prisma/schema.prisma packages/database/prisma/schema.prisma
COPY packages/domain/package.json packages/domain/package.json

RUN pnpm install --no-frozen-lockfile

COPY . .

RUN pnpm db:generate

