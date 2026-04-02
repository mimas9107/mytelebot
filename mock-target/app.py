#!/usr/bin/env python3

import asyncio
import hashlib
import hmac
import json
import os
import threading
import time
import uuid
from collections import deque
from dataclasses import dataclass
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse


VALID_AUTH_TYPES = {"none", "bearer", "header", "query", "hmac"}
VALID_RESPONSE_MODES = {"success", "business_error", "http_error", "timeout"}


@dataclass(frozen=True)
class Settings:
    service_name: str
    auth_type: str
    auth_secret: str
    admin_token: str | None
    max_request_logs: int
    default_timeout_seconds: float
    default_http_error_status: int
    default_business_error_message: str
    hmac_tolerance_seconds: int


class State:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.lock = threading.Lock()
        self.request_log: deque[dict[str, Any]] = deque(maxlen=settings.max_request_logs)
        self.response_mode = "success"
        self.delay_seconds = settings.default_timeout_seconds
        self.http_error_status = settings.default_http_error_status
        self.business_error_message = settings.default_business_error_message

    def _config_payload(self) -> dict[str, Any]:
        return {
            "responseMode": self.response_mode,
            "delaySeconds": self.delay_seconds,
            "httpErrorStatus": self.http_error_status,
            "businessErrorMessage": self.business_error_message,
        }

    def snapshot_config(self) -> dict[str, Any]:
        with self.lock:
            return self._config_payload()

    def update_config(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self.lock:
            mode = str(payload.get("responseMode") or self.response_mode).strip()
            if mode not in VALID_RESPONSE_MODES:
                raise ValueError(
                    f"responseMode must be one of: {', '.join(sorted(VALID_RESPONSE_MODES))}"
                )

            delay_seconds = payload.get("delaySeconds", self.delay_seconds)
            http_error_status = payload.get("httpErrorStatus", self.http_error_status)
            business_error_message = payload.get(
                "businessErrorMessage", self.business_error_message
            )

            delay_seconds = float(delay_seconds)
            http_error_status = int(http_error_status)
            business_error_message = str(business_error_message).strip()

            if delay_seconds < 0:
                raise ValueError("delaySeconds must be >= 0")

            if http_error_status < 400 or http_error_status > 599:
                raise ValueError("httpErrorStatus must be between 400 and 599")

            if not business_error_message:
                raise ValueError("businessErrorMessage must not be empty")

            self.response_mode = mode
            self.delay_seconds = delay_seconds
            self.http_error_status = http_error_status
            self.business_error_message = business_error_message

            return self._config_payload()

    def clear_requests(self) -> int:
        with self.lock:
            count = len(self.request_log)
            self.request_log.clear()
            return count

    def append_request(self, payload: dict[str, Any]) -> None:
        with self.lock:
            self.request_log.appendleft(payload)

    def list_requests(self, limit: int) -> list[dict[str, Any]]:
        with self.lock:
            return list(self.request_log)[:limit]

    def get_request(self, request_id: str) -> dict[str, Any] | None:
        with self.lock:
            for item in self.request_log:
                if item["requestId"] == request_id:
                    return item
        return None


def load_settings() -> Settings:
    auth_type = os.environ.get("MOCK_TARGET_AUTH_TYPE", "none").strip().lower()
    if auth_type not in VALID_AUTH_TYPES:
        raise RuntimeError(
            f"MOCK_TARGET_AUTH_TYPE must be one of: {', '.join(sorted(VALID_AUTH_TYPES))}"
        )

    return Settings(
        service_name=os.environ.get("MOCK_TARGET_SERVICE_NAME", "mytelebot-mock-target"),
        auth_type=auth_type,
        auth_secret=os.environ.get("MOCK_TARGET_AUTH_SECRET", "dev-secret"),
        admin_token=os.environ.get("MOCK_TARGET_ADMIN_TOKEN") or None,
        max_request_logs=max(int(os.environ.get("MOCK_TARGET_MAX_REQUEST_LOGS", "200")), 1),
        default_timeout_seconds=float(
            os.environ.get("MOCK_TARGET_TIMEOUT_SECONDS", "12")
        ),
        default_http_error_status=int(
            os.environ.get("MOCK_TARGET_HTTP_ERROR_STATUS", "500")
        ),
        default_business_error_message=os.environ.get(
            "MOCK_TARGET_BUSINESS_ERROR_MESSAGE", "mock target rejected the command"
        ),
        hmac_tolerance_seconds=max(
            int(os.environ.get("MOCK_TARGET_HMAC_TOLERANCE_SECONDS", "300")), 1
        ),
    )


SETTINGS = load_settings()
STATE = State(SETTINGS)
APP_VERSION = "0.1.0"

app = FastAPI(
    title="MyTeleBot Mock Target",
    version=APP_VERSION,
    description="Standalone mock target for MyTeleBot target/device/command integration tests.",
)


def utc_timestamp() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def parse_body(raw_body: bytes) -> tuple[str, Any, str | None]:
    if not raw_body:
        return "", None, None

    text = raw_body.decode("utf-8", errors="replace")

    try:
        return text, json.loads(text), None
    except json.JSONDecodeError:
        return text, None, "invalid_json"


def masked_headers(headers: dict[str, str]) -> dict[str, str]:
    output: dict[str, str] = {}

    for key, value in headers.items():
        lowered = key.lower()
        if lowered == "authorization":
            output[key] = "Bearer ***"
        elif lowered == "x-target-secret":
            output[key] = "***"
        elif lowered == "x-target-signature":
            output[key] = "sha256=***"
        else:
            output[key] = value

    return output


def masked_query(query_items: list[tuple[str, str]]) -> dict[str, Any]:
    output: dict[str, Any] = {}

    for key, value in query_items:
        safe_value = "***" if key == "token" else value
        if key in output:
            existing = output[key]
            if isinstance(existing, list):
                existing.append(safe_value)
            else:
                output[key] = [existing, safe_value]
        else:
            output[key] = safe_value

    return output


def verify_target_auth(request: Request, raw_body: bytes) -> tuple[bool, str]:
    auth_type = SETTINGS.auth_type
    secret = SETTINGS.auth_secret

    if auth_type == "none":
        return True, "auth disabled"

    if auth_type == "bearer":
        expected = f"Bearer {secret}"
        actual = request.headers.get("Authorization", "")
        return actual == expected, "expected Authorization bearer token"

    if auth_type == "header":
        actual = request.headers.get("X-Target-Secret", "")
        return actual == secret, "expected X-Target-Secret header"

    if auth_type == "query":
        actual = request.query_params.get("token", "")
        return actual == secret, "expected token query parameter"

    if auth_type == "hmac":
        timestamp = request.headers.get("X-Target-Timestamp", "")
        signature = request.headers.get("X-Target-Signature", "")

        if not timestamp or not signature.startswith("sha256="):
            return False, "missing HMAC headers"

        try:
            timestamp_int = int(timestamp)
        except ValueError:
            return False, "invalid HMAC timestamp"

        if abs(int(time.time()) - timestamp_int) > SETTINGS.hmac_tolerance_seconds:
            return False, "HMAC timestamp outside allowed window"

        path_with_query = request.url.path
        if request.url.query:
            path_with_query = f"{path_with_query}?{request.url.query}"

        body_text = raw_body.decode("utf-8", errors="replace") if raw_body else ""
        payload = (
            f"{timestamp}.{request.method.upper()}.{path_with_query}.{body_text}"
        ).encode("utf-8")
        expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        actual = signature.removeprefix("sha256=")

        return hmac.compare_digest(actual, expected), "expected valid HMAC signature"

    return False, f"unsupported auth type: {auth_type}"


def assert_admin_access(admin_token: str | None) -> None:
    if SETTINGS.admin_token and admin_token != SETTINGS.admin_token:
        raise HTTPException(status_code=403, detail="invalid admin token")


def build_request_record(
    *,
    request: Request,
    request_id: str,
    raw_body: bytes,
    body_text: str,
    body_json: Any,
    body_error: str | None,
    authorized: bool,
    auth_detail: str,
    response_status: int,
    response_payload: dict[str, Any],
) -> dict[str, Any]:
    headers = dict(request.headers.items())
    query_items = list(request.query_params.multi_items())
    return {
        "requestId": request_id,
        "receivedAt": utc_timestamp(),
        "method": request.method.upper(),
        "path": request.url.path,
        "query": masked_query(query_items),
        "headers": masked_headers(headers),
        "contentLength": len(raw_body),
        "bodyText": body_text,
        "bodyJson": body_json,
        "bodyError": body_error,
        "auth": {
            "type": SETTINGS.auth_type,
            "authorized": authorized,
            "detail": auth_detail,
        },
        "response": {
            "status": response_status,
            "payload": response_payload,
        },
    }


async def process_target_request(request: Request) -> JSONResponse:
    raw_body = await request.body()
    body_text, body_json, body_error = parse_body(raw_body)
    request_id = uuid.uuid4().hex[:12]
    authorized, auth_detail = verify_target_auth(request, raw_body)

    if not authorized:
        payload = {
            "ok": False,
            "mock": True,
            "requestId": request_id,
            "error": "unauthorized",
            "message": auth_detail,
            "authType": SETTINGS.auth_type,
        }
        STATE.append_request(
            build_request_record(
                request=request,
                request_id=request_id,
                raw_body=raw_body,
                body_text=body_text,
                body_json=body_json,
                body_error=body_error,
                authorized=authorized,
                auth_detail=auth_detail,
                response_status=401,
                response_payload=payload,
            )
        )
        return JSONResponse(payload, status_code=401)

    config = STATE.snapshot_config()
    mode = config["responseMode"]

    if mode == "timeout":
        await asyncio.sleep(config["delaySeconds"])

    if request.url.path == "/health":
        payload = {
            "ok": True,
            "mock": True,
            "service": SETTINGS.service_name,
            "version": APP_VERSION,
            "authType": SETTINGS.auth_type,
            "responseMode": mode,
            "requestLogCount": len(STATE.list_requests(limit=SETTINGS.max_request_logs)),
            "timestamp": utc_timestamp(),
        }
        status_code = 200
    elif mode == "business_error":
        payload = {
            "ok": False,
            "mock": True,
            "requestId": request_id,
            "error": config["businessErrorMessage"],
            "message": config["businessErrorMessage"],
        }
        status_code = 200
    elif mode == "http_error":
        payload = {
            "ok": False,
            "mock": True,
            "requestId": request_id,
            "error": f"mock target forced HTTP {config['httpErrorStatus']}",
            "message": "mock target forced an HTTP error response",
        }
        status_code = config["httpErrorStatus"]
    else:
        payload = {
            "ok": True,
            "mock": True,
            "requestId": request_id,
            "receivedAt": utc_timestamp(),
            "method": request.method.upper(),
            "path": request.url.path,
            "query": masked_query(list(request.query_params.multi_items())),
            "headers": masked_headers(dict(request.headers.items())),
            "bodyJson": body_json,
            "bodyText": body_text,
        }
        status_code = 200

    STATE.append_request(
        build_request_record(
            request=request,
            request_id=request_id,
            raw_body=raw_body,
            body_text=body_text,
            body_json=body_json,
            body_error=body_error,
            authorized=authorized,
            auth_detail=auth_detail,
            response_status=status_code,
            response_payload=payload,
        )
    )
    return JSONResponse(payload, status_code=status_code)


@app.get("/_mock/info")
async def get_info(x_mock_admin_token: str | None = Header(default=None)) -> dict[str, Any]:
    assert_admin_access(x_mock_admin_token)
    return {
        "ok": True,
        "service": SETTINGS.service_name,
        "version": APP_VERSION,
        "authType": SETTINGS.auth_type,
        "requestLogCapacity": SETTINGS.max_request_logs,
        "config": STATE.snapshot_config(),
        "endpoints": {
            "health": "/health",
            "requests": "/_mock/requests",
            "config": "/_mock/config",
        },
    }


@app.get("/_mock/ping")
async def public_ping() -> dict[str, Any]:
    return {
        "ok": True,
        "public": True,
        "service": SETTINGS.service_name,
        "version": APP_VERSION,
        "timestamp": utc_timestamp(),
    }


@app.get("/_mock/config")
async def get_config(x_mock_admin_token: str | None = Header(default=None)) -> dict[str, Any]:
    assert_admin_access(x_mock_admin_token)
    return {
        "ok": True,
        "config": STATE.snapshot_config(),
    }


@app.put("/_mock/config")
async def update_config(
    request: Request, x_mock_admin_token: str | None = Header(default=None)
) -> dict[str, Any]:
    assert_admin_access(x_mock_admin_token)
    payload = await request.json()

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="config payload must be a JSON object")

    try:
        config = STATE.update_config(payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return {
        "ok": True,
        "config": config,
    }


@app.get("/_mock/requests")
async def list_requests(
    limit: int = Query(default=50, ge=1, le=200),
    x_mock_admin_token: str | None = Header(default=None),
) -> dict[str, Any]:
    assert_admin_access(x_mock_admin_token)
    items = STATE.list_requests(limit=limit)
    return {
        "ok": True,
        "count": len(items),
        "items": items,
    }


@app.get("/_mock/requests/{request_id}")
async def get_request(
    request_id: str, x_mock_admin_token: str | None = Header(default=None)
) -> dict[str, Any]:
    assert_admin_access(x_mock_admin_token)
    item = STATE.get_request(request_id)
    if not item:
        raise HTTPException(status_code=404, detail="request log not found")
    return {
        "ok": True,
        "item": item,
    }


@app.delete("/_mock/requests")
async def clear_requests(
    x_mock_admin_token: str | None = Header(default=None),
) -> dict[str, Any]:
    assert_admin_access(x_mock_admin_token)
    removed = STATE.clear_requests()
    return {
        "ok": True,
        "removed": removed,
    }


@app.get("/health")
async def health(request: Request) -> JSONResponse:
    return await process_target_request(request)


@app.api_route("/", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
async def root_target(request: Request) -> JSONResponse:
    return await process_target_request(request)


@app.api_route(
    "/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
)
async def catch_all_target(full_path: str, request: Request) -> JSONResponse:
    return await process_target_request(request)
