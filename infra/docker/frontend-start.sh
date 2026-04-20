#!/bin/sh
set -eu

cd /workspace

exec pnpm --filter @huegame/frontend dev -- --hostname 0.0.0.0 --port 3000
