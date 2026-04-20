#!/bin/sh
set -eu

cd /workspace

pnpm db:migrate:deploy
pnpm db:seed
