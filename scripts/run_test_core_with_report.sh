#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPORT_DATE="${REPORT_DATE:-$(date +%Y%m%d)}"
RAW_DIR="$ROOT_DIR/reports/raw"
TEST_LOG="$RAW_DIR/TEST-${REPORT_DATE}-test-core.log"
BUILD_LOG="$RAW_DIR/TEST-${REPORT_DATE}-build.log"

mkdir -p "$RAW_DIR"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
. "$NVM_DIR/nvm.sh"
nvm use "${NODE_VERSION:-$(cat "$ROOT_DIR/.nvmrc")}" >/dev/null

cd "$ROOT_DIR"

npm run test:core 2>&1 | tee "$TEST_LOG"
npm run build 2>&1 | tee "$BUILD_LOG"

printf 'Raw logs saved:\n- %s\n- %s\n' "$TEST_LOG" "$BUILD_LOG"
