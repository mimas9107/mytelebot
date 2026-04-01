#!/usr/bin/env python3
import json
import os
import signal
import sqlite3
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
APP_PORT = int(os.environ.get("MESSAGE_FLOW_APP_PORT", "3301"))
APP_BASE_URL = f"http://127.0.0.1:{APP_PORT}"
WEBHOOK_URL = f"{APP_BASE_URL}/api/telegram/webhook"
HEALTH_URL = f"{APP_BASE_URL}/api/health"
WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "integration-secret")
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "integration-token")
TELEGRAM_API_BASE_URL = os.environ.get("TELEGRAM_API_BASE_URL", "http://127.0.0.1:19000")
CHAT_ID = os.environ.get("TELEGRAM_TEST_CHAT_ID", "990000001")
FROM_ID = os.environ.get("TELEGRAM_TEST_FROM_ID", CHAT_ID)
FIRST_NAME = os.environ.get("TELEGRAM_TEST_FIRST_NAME", "MessageFlowTest")
SQLITE_FILE_PATH = Path(os.environ.get("SQLITE_FILE_PATH", str(WORKSPACE_ROOT / "data" / "mytelebot.sqlite")))
MOCK_LLM_PORT = int(os.environ.get("MOCK_LLM_PORT", "11435"))
MOCK_DEVICE_PORT = int(os.environ.get("MOCK_DEVICE_PORT", "18000"))
MOCK_TELEGRAM_PORT = int(os.environ.get("MOCK_TELEGRAM_PORT", "19000"))
FIXTURE_PROVIDER_ID = "message-flow-provider-id"
FIXTURE_PROVIDER_KEY = "message-flow-provider"
FIXTURE_TARGET_ID = "message-flow-target-id"
FIXTURE_TARGET_KEY = "integration-home"
FIXTURE_DEVICE_ID = "message-flow-device-id"
FIXTURE_COMMAND_ID = "message-flow-command-id"
FIXTURE_TELEGRAM_ACCOUNT_ID = "message-flow-telegram-account-id"
FIXTURE_UPDATE_BASE = int(os.environ.get("MESSAGE_FLOW_UPDATE_BASE", "9800"))


def fail(message):
    print(f"FAIL: {message}", file=sys.stderr)
    sys.exit(1)


def http_json(method, url, payload=None, headers=None, timeout=30):
    body = None
    request_headers = headers or {}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        request_headers = {"Content-Type": "application/json", **request_headers}

    request = urllib.request.Request(url, method=method, data=body, headers=request_headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def wait_for_json(url, attempts=60, delay=0.5):
    last_error = None
    for _ in range(attempts):
        try:
            return http_json("GET", url)
        except Exception as error:  # noqa: BLE001
            last_error = error
            time.sleep(delay)
    fail(f"Service did not become ready: {url} ({last_error})")


def start_process(command, env):
    return subprocess.Popen(
        command,
        cwd=str(WORKSPACE_ROOT),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )


def stop_process(process):
    if process is None or process.poll() is not None:
        return

    process.send_signal(signal.SIGTERM)
    try:
        process.wait(timeout=8)
    except subprocess.TimeoutExpired:
        process.kill()


def assert_equal(actual, expected, message):
    if actual != expected:
        fail(f"{message}: expected {expected!r}, got {actual!r}")


def send_webhook(update_id, text):
    payload = {
        "update_id": update_id,
        "message": {
            "message_id": 10,
            "date": 1710000001,
            "text": text,
            "chat": {"id": int(CHAT_ID), "type": "private"},
            "from": {"id": int(FROM_ID), "is_bot": False, "first_name": FIRST_NAME},
        },
    }
    return http_json(
        "POST",
        WEBHOOK_URL,
        payload,
        headers={"x-telegram-bot-api-secret-token": WEBHOOK_SECRET},
    )


def seed_fixture():
    connection = sqlite3.connect(str(SQLITE_FILE_PATH))
    connection.row_factory = sqlite3.Row
    previous_providers = connection.execute("SELECT id, isDefault, status FROM LlmProvider").fetchall()
    now = time.strftime("%Y-%m-%d %H:%M:%S")

    try:
        for update_id in range(FIXTURE_UPDATE_BASE, FIXTURE_UPDATE_BASE + 10):
            connection.execute("DELETE FROM TelegramUpdate WHERE telegramUpdateId = ?", (str(update_id),))
        connection.execute("DELETE FROM PendingTelegramAction WHERE commandId = ? AND telegramUserId = ?", (FIXTURE_COMMAND_ID, FROM_ID))
        connection.execute("DELETE FROM CommandExecution WHERE commandId = ? AND actorId = ?", (FIXTURE_COMMAND_ID, FROM_ID))
        connection.execute("DELETE FROM AuditLog WHERE actorType = 'telegram' AND actorId = ?", (FROM_ID,))
        connection.execute("UPDATE LlmProvider SET isDefault = 0")
        connection.execute(
            """
            INSERT INTO LlmProvider (
              id, providerKey, name, baseUrl, model, extraHeadersJson,
              capabilitiesJson, apiKeySecretId, status, isDefault, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              providerKey=excluded.providerKey,
              name=excluded.name,
              baseUrl=excluded.baseUrl,
              model=excluded.model,
              extraHeadersJson=excluded.extraHeadersJson,
              capabilitiesJson=excluded.capabilitiesJson,
              status=excluded.status,
              isDefault=excluded.isDefault,
              updatedAt=excluded.updatedAt
            """,
            (
                FIXTURE_PROVIDER_ID,
                FIXTURE_PROVIDER_KEY,
                "Message Flow Provider",
                f"http://127.0.0.1:{MOCK_LLM_PORT}/v1",
                "mock-home-automation",
                None,
                json.dumps({
                    "capability_profile": "openai_compatible",
                    "json_output_mode": "json_object",
                    "json_strict": True,
                }),
                "active",
                1,
                now,
                now,
            ),
        )
        connection.execute(
            """
            INSERT INTO Target (
              id, targetKey, name, baseUrl, authType, authSecretId, timeoutMs, status, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              targetKey=excluded.targetKey,
              name=excluded.name,
              baseUrl=excluded.baseUrl,
              authType=excluded.authType,
              timeoutMs=excluded.timeoutMs,
              status=excluded.status,
              updatedAt=excluded.updatedAt
            """,
            (
                FIXTURE_TARGET_ID,
                FIXTURE_TARGET_KEY,
                "Message Flow Home",
                f"http://127.0.0.1:{MOCK_DEVICE_PORT}",
                "none",
                8000,
                "active",
                now,
                now,
            ),
        )
        connection.execute(
            """
            INSERT INTO Device (
              id, deviceKey, targetId, name, aliasesJson, type, description, status, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              deviceKey=excluded.deviceKey,
              targetId=excluded.targetId,
              name=excluded.name,
              aliasesJson=excluded.aliasesJson,
              type=excluded.type,
              description=excluded.description,
              status=excluded.status,
              updatedAt=excluded.updatedAt
            """,
            (
                FIXTURE_DEVICE_ID,
                "light_01",
                FIXTURE_TARGET_ID,
                "light",
                json.dumps(["燈", "電燈", "light"]),
                "relay_set",
                "Message flow fixture light",
                "active",
                now,
                now,
            ),
        )
        connection.execute(
            """
            INSERT INTO DeviceCommand (
              id, deviceId, commandKey, aliasesJson, label, method, path,
              payloadTemplateJson, argsSchemaJson, confirmationRequired,
              cooldownSeconds, status, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 30, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              deviceId=excluded.deviceId,
              commandKey=excluded.commandKey,
              aliasesJson=excluded.aliasesJson,
              label=excluded.label,
              method=excluded.method,
              path=excluded.path,
              payloadTemplateJson=excluded.payloadTemplateJson,
              argsSchemaJson=excluded.argsSchemaJson,
              confirmationRequired=excluded.confirmationRequired,
              cooldownSeconds=excluded.cooldownSeconds,
              status=excluded.status,
              updatedAt=excluded.updatedAt
            """,
            (
                FIXTURE_COMMAND_ID,
                FIXTURE_DEVICE_ID,
                "lightcommands",
                json.dumps(["打開", "關掉", "開燈", "關燈"]),
                "lightcommands",
                "POST",
                "/device/light_01",
                json.dumps({"state": "{{state}}"}),
                json.dumps({
                    "type": "object",
                    "properties": {"state": {"type": "string", "enum": ["ON", "OFF"]}},
                    "required": ["state"],
                }),
                "active",
                now,
                now,
            ),
        )
        connection.execute(
            """
            INSERT INTO TelegramAccount (
              id, userId, telegramUserId, username, displayName, status, createdAt, updatedAt
            ) VALUES (?, NULL, ?, NULL, ?, ?, ?, ?)
            ON CONFLICT(telegramUserId) DO UPDATE SET
              displayName=excluded.displayName,
              status=excluded.status,
              updatedAt=excluded.updatedAt
            """,
            (
                FIXTURE_TELEGRAM_ACCOUNT_ID,
                FROM_ID,
                FIRST_NAME,
                "active",
                now,
                now,
            ),
        )
        connection.commit()
    finally:
        connection.close()

    return previous_providers


def restore_provider_defaults(previous_rows):
    connection = sqlite3.connect(str(SQLITE_FILE_PATH))
    try:
        connection.execute("UPDATE LlmProvider SET isDefault = 0 WHERE id = ?", (FIXTURE_PROVIDER_ID,))
        for row in previous_rows:
            connection.execute(
                "UPDATE LlmProvider SET isDefault = ?, status = ? WHERE id = ?",
                (row["isDefault"], row["status"], row["id"]),
            )
        connection.commit()
    finally:
        connection.close()


def query_one(sql, params=()):
    connection = sqlite3.connect(str(SQLITE_FILE_PATH))
    connection.row_factory = sqlite3.Row
    try:
        return connection.execute(sql, params).fetchone()
    finally:
        connection.close()


def query_all(sql, params=()):
    connection = sqlite3.connect(str(SQLITE_FILE_PATH))
    connection.row_factory = sqlite3.Row
    try:
        return connection.execute(sql, params).fetchall()
    finally:
        connection.close()


def last_mock_message():
    payload = http_json("GET", f"http://127.0.0.1:{MOCK_TELEGRAM_PORT}/messages")
    messages = payload.get("messages", [])
    if not messages:
        fail("mock telegram did not record any outbound message")
    return messages[-1]


def main():
    if not SQLITE_FILE_PATH.exists():
        fail(f"SQLite file not found: {SQLITE_FILE_PATH}")

    base_env = os.environ.copy()
    llm_env = {**base_env, "MOCK_LLM_PORT": str(MOCK_LLM_PORT)}
    device_env = {**base_env, "MOCK_DEVICE_PORT": str(MOCK_DEVICE_PORT), "MOCK_DEVICE_AUTH_TYPE": "none"}
    telegram_env = {**base_env, "MOCK_TELEGRAM_PORT": str(MOCK_TELEGRAM_PORT)}
    app_env = {
        **base_env,
        "PORT": str(APP_PORT),
        "TELEGRAM_TOKEN": TELEGRAM_TOKEN,
        "TELEGRAM_WEBHOOK_SECRET": WEBHOOK_SECRET,
        "TELEGRAM_API_BASE_URL": TELEGRAM_API_BASE_URL,
    }

    llm_process = device_process = telegram_process = app_process = None
    previous_providers = []

    try:
        llm_process = start_process(["python3", "scripts/mock_llm_server.py"], llm_env)
        device_process = start_process(["python3", "scripts/mock_device_server.py"], device_env)
        telegram_process = start_process(["python3", "scripts/mock_telegram_server.py"], telegram_env)
        app_process = start_process(["npm", "run", "dev"], app_env)

        wait_for_json(f"http://127.0.0.1:{MOCK_LLM_PORT}/health")
        wait_for_json(f"http://127.0.0.1:{MOCK_DEVICE_PORT}/health")
        wait_for_json(f"http://127.0.0.1:{MOCK_TELEGRAM_PORT}/health")
        wait_for_json(HEALTH_URL, attempts=120, delay=0.5)
        http_json("POST", f"http://127.0.0.1:{MOCK_TELEGRAM_PORT}/reset", {})
        previous_providers = seed_fixture()

        pending_1 = send_webhook(FIXTURE_UPDATE_BASE, "把燈打開")
        assert_equal(pending_1["status"], "confirmation_pending", "confirmation pending status mismatch")
        assert_equal(pending_1["reasonCode"], "confirmation_required", "confirmation pending reason mismatch")
        token_1 = pending_1.get("pendingToken")
        if not token_1:
            fail("confirmation pending token missing")
        pending_row = query_one(
            "SELECT status, rawInput FROM PendingTelegramAction WHERE token = ? AND telegramUserId = ?",
            (token_1, FROM_ID),
        )
        assert_equal(pending_row["status"], "pending", "pending action row status mismatch")
        assert_equal(pending_row["rawInput"], "把燈打開", "pending raw input mismatch")
        outbound_1 = last_mock_message()
        if token_1 not in str(outbound_1.get("text", "")):
            fail("mock telegram confirmation message does not contain pending token")

        cancelled = send_webhook(FIXTURE_UPDATE_BASE + 1, f"cancel {token_1}")
        assert_equal(cancelled["status"], "confirmation_cancelled", "cancel status mismatch")
        cancelled_row = query_one(
            "SELECT status, cancelledAt FROM PendingTelegramAction WHERE token = ?",
            (token_1,),
        )
        assert_equal(cancelled_row["status"], "cancelled", "pending action cancel state mismatch")
        if not cancelled_row["cancelledAt"]:
            fail("cancelled pending action is missing cancelledAt")

        pending_2 = send_webhook(FIXTURE_UPDATE_BASE + 2, "把電燈打開")
        assert_equal(pending_2["status"], "confirmation_pending", "second confirmation pending status mismatch")
        token_2 = pending_2.get("pendingToken")
        if not token_2:
            fail("second confirmation token missing")

        confirmed = send_webhook(FIXTURE_UPDATE_BASE + 3, f"confirm {token_2}")
        assert_equal(confirmed["status"], "dispatch_success", "confirm dispatch status mismatch")
        assert_equal(confirmed["reasonCode"], "dispatch_success", "confirm dispatch reason mismatch")
        executed_row = query_one(
            "SELECT status, confirmedAt, executedAt FROM PendingTelegramAction WHERE token = ?",
            (token_2,),
        )
        assert_equal(executed_row["status"], "executed", "pending action executed state mismatch")
        if not executed_row["confirmedAt"] or not executed_row["executedAt"]:
            fail("executed pending action missing confirmedAt/executedAt")
        execution_count = query_one(
            "SELECT COUNT(*) AS count FROM CommandExecution WHERE commandId = ? AND actorId = ? AND status = 'dispatch_success'",
            (FIXTURE_COMMAND_ID, FROM_ID),
        )
        assert_equal(execution_count["count"], 1, "command execution count mismatch")
        device_health = http_json("GET", f"http://127.0.0.1:{MOCK_DEVICE_PORT}/health")
        device_state = device_health.get("devices", {}).get("light_01", {})
        assert_equal(device_state.get("state"), "ON", "device state mismatch after confirm dispatch")
        dispatch_audit = query_one(
            "SELECT executionStatus, rawInput FROM AuditLog WHERE actorType = 'telegram' AND actorId = ? AND executionStatus = 'dispatch_success' ORDER BY createdAt DESC LIMIT 1",
            (FROM_ID,),
        )
        assert_equal(dispatch_audit["rawInput"], f"confirm {token_2}", "dispatch audit rawInput mismatch")

        cooldown = send_webhook(FIXTURE_UPDATE_BASE + 4, "把燈打開")
        assert_equal(cooldown["status"], "command_on_cooldown", "cooldown status mismatch")
        assert_equal(cooldown["reasonCode"], "command_on_cooldown", "cooldown reason mismatch")
        pending_count = query_one(
            "SELECT COUNT(*) AS count FROM PendingTelegramAction WHERE commandId = ? AND telegramUserId = ?",
            (FIXTURE_COMMAND_ID, FROM_ID),
        )
        assert_equal(pending_count["count"], 2, "cooldown should not create new pending action")

        validation_failure = send_webhook(FIXTURE_UPDATE_BASE + 5, "把風扇打開")
        assert_equal(validation_failure["status"], "validation_failed", "validation status mismatch")
        assert_equal(validation_failure["reasonCode"], "device_not_found", "validation reason mismatch")

        audit_summary = query_all(
            "SELECT executionStatus FROM AuditLog WHERE actorType = 'telegram' AND actorId = ? ORDER BY createdAt ASC",
            (FROM_ID,),
        )
        audit_statuses = [row["executionStatus"] for row in audit_summary]
        for expected in ["received", "parsed_valid", "dispatch_success", "command_on_cooldown", "validation_failed"]:
            if expected not in audit_statuses:
                fail(f"missing expected audit status: {expected}")

        outbound_messages = http_json("GET", f"http://127.0.0.1:{MOCK_TELEGRAM_PORT}/messages").get("messages", [])
        if len(outbound_messages) < 5:
            fail(f"expected at least 5 outbound telegram messages, got {len(outbound_messages)}")

        print(
            json.dumps(
                {
                    "ok": True,
                    "checks": [
                        "confirmation_pending",
                        "confirmation_cancelled",
                        "confirm_dispatch_success",
                        "command_on_cooldown",
                        "validation_failed/device_not_found",
                        "audit_log_side_effects",
                        "pending_action_state_transitions",
                        "command_execution_recorded",
                        "mock_telegram_outbound_messages",
                    ],
                    "pendingTokens": [token_1, token_2],
                    "auditStatuses": audit_statuses,
                    "outboundMessages": len(outbound_messages),
                },
                ensure_ascii=False,
            )
        )
    finally:
        if previous_providers:
            restore_provider_defaults(previous_providers)
        stop_process(app_process)
        stop_process(telegram_process)
        stop_process(device_process)
        stop_process(llm_process)


if __name__ == "__main__":
    main()
