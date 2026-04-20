#!/bin/sh
set -eu

cd /workspace

pnpm db:generate
exec pnpm backend:dev
