#!/bin/sh
set -eu

cd /workspace

: "${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in infra/docker/.env.vps}"

encoded_user=$(node -e 'process.stdout.write(encodeURIComponent(process.env.POSTGRES_USER || "huegame"))')
encoded_password=$(node -e 'process.stdout.write(encodeURIComponent(process.env.POSTGRES_PASSWORD || ""))')
encoded_database=$(node -e 'process.stdout.write(encodeURIComponent(process.env.POSTGRES_DB || "huegame"))')
export DATABASE_URL="postgresql://${encoded_user}:${encoded_password}@postgres:5432/${encoded_database}?schema=public"

pnpm db:generate
pnpm db:migrate:deploy
pnpm db:seed

exec pnpm backend:dev
