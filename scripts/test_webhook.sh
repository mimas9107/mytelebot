#!/usr/bin/env bash

set -euo pipefail

STATE_FILE="${STATE_FILE:-/tmp/mytelebot-webhook-update-id}"
WEBHOOK_URL="${WEBHOOK_URL:-${APP_URL:-http://127.0.0.1:3000}/api/telegram/webhook}"
WEBHOOK_SECRET="${TELEGRAM_WEBHOOK_SECRET:-${WEBHOOK_SECRET:-}}"
CHAT_ID="${TELEGRAM_TEST_CHAT_ID:-8270697521}"
FROM_ID="${TELEGRAM_TEST_FROM_ID:-$CHAT_ID}"
FIRST_NAME="${TELEGRAM_TEST_FIRST_NAME:-Test}"
MESSAGE_TEXT="${1:-把light_01打開}"
FORCE_UPDATE_ID="${UPDATE_ID:-}"

if [[ -z "$WEBHOOK_SECRET" ]]; then
  echo "Missing TELEGRAM_WEBHOOK_SECRET or WEBHOOK_SECRET." >&2
  exit 1
fi

if [[ -n "$FORCE_UPDATE_ID" ]]; then
  UPDATE_ID_VALUE="$FORCE_UPDATE_ID"
elif [[ -f "$STATE_FILE" ]]; then
  LAST_UPDATE_ID="$(cat "$STATE_FILE")"
  UPDATE_ID_VALUE="$((LAST_UPDATE_ID + 1))"
else
  UPDATE_ID_VALUE="1000"
fi

printf '%s\n' "$UPDATE_ID_VALUE" > "$STATE_FILE"

escape_json() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  value="${value//$'\t'/\\t}"
  printf '%s' "$value"
}

MESSAGE_TEXT_JSON="$(escape_json "$MESSAGE_TEXT")"
FIRST_NAME_JSON="$(escape_json "$FIRST_NAME")"

PAYLOAD="$(cat <<EOF
{
  "update_id": $UPDATE_ID_VALUE,
  "message": {
    "message_id": 10,
    "date": 1710000001,
    "text": "$MESSAGE_TEXT_JSON",
    "chat": { "id": $CHAT_ID, "type": "private" },
    "from": { "id": $FROM_ID, "is_bot": false, "first_name": "$FIRST_NAME_JSON" }
  }
}
EOF
)"

echo "POST $WEBHOOK_URL"
echo "update_id=$UPDATE_ID_VALUE"
echo "text=$MESSAGE_TEXT"

curl -sS -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-telegram-bot-api-secret-token: $WEBHOOK_SECRET" \
  -d "$PAYLOAD"

echo
