#!/bin/sh
set -eu

cd /workspace

exec pnpm --filter @huegame/frontend exec next dev --hostname 0.0.0.0 --port 3000
