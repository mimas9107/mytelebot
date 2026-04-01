#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPORT_DATE="${REPORT_DATE:-$(date +%Y%m%d)}"
RAW_DIR="$ROOT_DIR/reports/raw"
FLOW_LOG="$RAW_DIR/TEST-${REPORT_DATE}-message-flow.log"

mkdir -p "$RAW_DIR"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
. "$NVM_DIR/nvm.sh"
nvm use "${NODE_VERSION:-$(cat "$ROOT_DIR/.nvmrc")}" >/dev/null

cd "$ROOT_DIR"
python3 scripts/test_message_flow_integration.py 2>&1 | tee "$FLOW_LOG"
printf 'Raw log saved:\n- %s\n' "$FLOW_LOG"
