#!/bin/sh
set -eu

cd /workspace

pnpm db:generate
pnpm db:migrate:deploy
pnpm db:seed

exec pnpm backend:dev
