#!/usr/bin/env python3
import json
import os
import signal
import sqlite3
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
APP_BASE_URL = os.environ.get("APP_BASE_URL") or os.environ.get("APP_URL") or "http://127.0.0.1:3000"
WEBHOOK_URL = f"{APP_BASE_URL}/api/telegram/webhook"
HEALTH_URL = f"{APP_BASE_URL}/api/health"
WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET") or os.environ.get("WEBHOOK_SECRET")
CHAT_ID = os.environ.get("TELEGRAM_TEST_CHAT_ID", "8270697521")
FROM_ID = os.environ.get("TELEGRAM_TEST_FROM_ID", CHAT_ID)
FIRST_NAME = os.environ.get("TELEGRAM_TEST_FIRST_NAME", "IntegrationTest")
SQLITE_FILE_PATH = Path(
    os.environ.get("SQLITE_FILE_PATH", str(WORKSPACE_ROOT / "data" / "mytelebot.sqlite"))
)
MOCK_LLM_PORT = int(os.environ.get("MOCK_LLM_PORT", "11435"))
MOCK_DEVICE_PORT = int(os.environ.get("MOCK_DEVICE_PORT", "18000"))

FIXTURE_PROVIDER_ID = "integration-provider-id"
FIXTURE_PROVIDER_KEY = "integration-mock-provider"
FIXTURE_TARGET_ID = "integration-target-id"
FIXTURE_TARGET_KEY = "integration-home"
FIXTURE_DEVICE_ID = "integration-device-id"
FIXTURE_COMMAND_ID = "integration-command-id"
FIXTURE_TELEGRAM_ACCOUNT_ID = "integration-telegram-account-id"
FIXTURE_UPDATE_BASE = int(os.environ.get("INTEGRATION_UPDATE_BASE", "9400"))


def fail(message):
    print(f"FAIL: {message}", file=sys.stderr)
    sys.exit(1)


def require_env():
    if not WEBHOOK_SECRET:
        fail("TELEGRAM_WEBHOOK_SECRET or WEBHOOK_SECRET is required")

    if not SQLITE_FILE_PATH.exists():
        fail(f"SQLite file not found: {SQLITE_FILE_PATH}")


def http_json(method, url, payload=None, headers=None):
    body = None
    request_headers = headers or {}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        request_headers = {"Content-Type": "application/json", **request_headers}

    request = urllib.request.Request(url, method=method, data=body, headers=request_headers)
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def wait_for_json(url, attempts=30, delay=0.4):
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
    if process.poll() is not None:
        return

    process.send_signal(signal.SIGTERM)
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()


def seed_fixture():
    connection = sqlite3.connect(str(SQLITE_FILE_PATH))
    connection.row_factory = sqlite3.Row
    previous_providers = connection.execute(
        "SELECT id, isDefault, status FROM LlmProvider"
    ).fetchall()
    now = time.strftime("%Y-%m-%d %H:%M:%S")

    try:
        for update_id in range(FIXTURE_UPDATE_BASE, FIXTURE_UPDATE_BASE + 3):
            connection.execute(
                "DELETE FROM TelegramUpdate WHERE telegramUpdateId = ?",
                (str(update_id),),
            )
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
                "Integration Mock Provider",
                f"http://127.0.0.1:{MOCK_LLM_PORT}/v1",
                "mock-home-automation",
                None,
                json.dumps(
                    {
                        "capability_profile": "openai_compatible",
                        "json_output_mode": "json_object",
                        "json_strict": True,
                    }
                ),
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
                "Integration Home",
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
                "Integration fixture light",
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
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
                json.dumps(["打開", "關掉"]),
                "lightcommands",
                "POST",
                "/device/light_01",
                json.dumps({"state": "{{state}}"}),
                json.dumps(
                    {
                        "type": "object",
                        "properties": {
                            "state": {"type": "string", "enum": ["ON", "OFF"]}
                        },
                        "required": ["state"],
                    }
                ),
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
        connection.execute(
            "UPDATE LlmProvider SET isDefault = 0 WHERE id = ?", (FIXTURE_PROVIDER_ID,)
        )
        for row in previous_rows:
            connection.execute(
                "UPDATE LlmProvider SET isDefault = ?, status = ? WHERE id = ?",
                (row["isDefault"], row["status"], row["id"]),
            )
        connection.commit()
    finally:
        connection.close()


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


def assert_equal(actual, expected, message):
    if actual != expected:
        fail(f"{message}: expected {expected!r}, got {actual!r}")


def main():
    require_env()
    app_health = wait_for_json(HEALTH_URL)
    if app_health.get("status") != "ok":
        fail(f"Application health failed: {app_health}")

    env_llm = os.environ.copy()
    env_llm["MOCK_LLM_PORT"] = str(MOCK_LLM_PORT)
    env_device = os.environ.copy()
    env_device["MOCK_DEVICE_PORT"] = str(MOCK_DEVICE_PORT)
    env_device["MOCK_DEVICE_AUTH_TYPE"] = "none"

    llm_process = start_process(["python3", "scripts/mock_llm_server.py"], env_llm)
    device_process = start_process(["python3", "scripts/mock_device_server.py"], env_device)
    previous_providers = []

    try:
        wait_for_json(f"http://127.0.0.1:{MOCK_LLM_PORT}/health")
        wait_for_json(f"http://127.0.0.1:{MOCK_DEVICE_PORT}/health")
        previous_providers = seed_fixture()

        success = send_webhook(FIXTURE_UPDATE_BASE, "把燈打開")
        assert_equal(success["status"], "dispatch_success", "success status mismatch")
        assert_equal(success["reasonCode"], "dispatch_success", "success reason mismatch")

        validation_failure = send_webhook(FIXTURE_UPDATE_BASE + 1, "把風扇打開")
        assert_equal(
            validation_failure["status"],
            "validation_failed",
            "validation status mismatch",
        )
        assert_equal(
            validation_failure["reasonCode"],
            "device_not_found",
            "validation reason mismatch",
        )

        duplicate_first = send_webhook(FIXTURE_UPDATE_BASE + 2, "把電燈關掉")
        assert_equal(
            duplicate_first["status"],
            "dispatch_success",
            "duplicate baseline status mismatch",
        )
        duplicate_second = send_webhook(FIXTURE_UPDATE_BASE + 2, "把電燈關掉")
        assert_equal(
            duplicate_second["status"],
            "duplicate_update_ignored",
            "duplicate guard mismatch",
        )

        print(
            json.dumps(
                {
                    "ok": True,
                    "app": app_health,
                    "checks": [
                        "dispatch_success",
                        "validation_failed/device_not_found",
                        "duplicate_update_ignored",
                    ],
                },
                ensure_ascii=False,
            )
        )
    finally:
        if previous_providers:
            restore_provider_defaults(previous_providers)
        stop_process(llm_process)
        stop_process(device_process)


if __name__ == "__main__":
    main()
