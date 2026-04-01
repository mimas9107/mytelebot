#!/usr/bin/env python3

import hashlib
import hmac
import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse


HOST = os.environ.get("MOCK_DEVICE_HOST", "127.0.0.1")
PORT = int(os.environ.get("MOCK_DEVICE_PORT", "8000"))
AUTH_TYPE = os.environ.get("MOCK_DEVICE_AUTH_TYPE", "bearer").strip().lower()
AUTH_SECRET = os.environ.get("MOCK_DEVICE_AUTH_SECRET", "dev-secret")

DEVICE_STATE = {}


def json_bytes(payload, status=200):
    body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
    return status, body


class MockDeviceHandler(BaseHTTPRequestHandler):
    server_version = "MockDeviceServer/0.1"

    def _send_json(self, payload, status=200):
        response_status, body = json_bytes(payload, status=status)
        self.send_response(response_status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_raw(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return b""

        raw = self.rfile.read(length)
        if not raw:
            return b""

        return raw

    def _parse_json(self, raw):
        if not raw:
            return None

        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            return "__INVALID_JSON__"

    def _is_authorized(self, raw_body):
        if AUTH_TYPE == "none":
            return True

        if AUTH_TYPE == "bearer":
            return self.headers.get("Authorization") == f"Bearer {AUTH_SECRET}"

        if AUTH_TYPE == "header":
            return self.headers.get("X-Target-Secret") == AUTH_SECRET

        if AUTH_TYPE == "query":
            parsed = urlparse(self.path)
            return parse_qs(parsed.query).get("token", [None])[0] == AUTH_SECRET

        if AUTH_TYPE == "hmac":
            timestamp = self.headers.get("X-Target-Timestamp")
            signature = self.headers.get("X-Target-Signature", "")

            if not timestamp or not signature.startswith("sha256="):
                return False

            try:
                ts = int(timestamp)
            except ValueError:
                return False

            if abs(int(time.time()) - ts) > 300:
                return False

            parsed = urlparse(self.path)
            path_with_query = parsed.path
            if parsed.query:
                path_with_query += f"?{parsed.query}"

            body_text = raw_body.decode("utf-8") if raw_body else ""
            payload = f"{timestamp}.{self.command}.{path_with_query}.{body_text}".encode(
                "utf-8"
            )
            expected = hmac.new(
                AUTH_SECRET.encode("utf-8"), payload, hashlib.sha256
            ).hexdigest()

            return hmac.compare_digest(signature, f"sha256={expected}")

        return False

    def _handle_request(self):
        raw_body = self._read_raw()

        if not self._is_authorized(raw_body):
            self._send_json(
                {
                    "ok": False,
                    "error": "unauthorized",
                    "auth_type": AUTH_TYPE,
                },
                status=401,
            )
            return

        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._send_json(
                {
                    "ok": True,
                    "service": "mock-device-server",
                    "auth_type": AUTH_TYPE,
                    "devices": DEVICE_STATE,
                }
            )
            return

        if not parsed.path.startswith("/device/"):
            self._send_json(
                {
                    "ok": False,
                    "error": "not_found",
                    "path": parsed.path,
                },
                status=404,
            )
            return

        device_id = parsed.path.split("/device/", 1)[1].strip("/") or "unknown"
        payload = self._parse_json(raw_body)

        if payload == "__INVALID_JSON__":
            self._send_json({"ok": False, "error": "invalid_json"}, status=400)
            return

        if self.command in {"POST", "PUT", "PATCH"}:
            if not isinstance(payload, dict):
                self._send_json(
                    {"ok": False, "error": "payload_object_required"},
                    status=400,
                )
                return

            state = payload.get("state")
            if state is not None and state not in {"ON", "OFF"}:
                self._send_json(
                    {"ok": False, "error": "invalid_state", "state": state},
                    status=400,
                )
                return

            current = DEVICE_STATE.get(device_id, {})
            current.update(payload)
            DEVICE_STATE[device_id] = current

        self._send_json(
            {
                "ok": True,
                "device_id": device_id,
                "method": self.command,
                "path": parsed.path,
                "received_payload": payload,
                "device_state": DEVICE_STATE.get(device_id, {}),
            }
        )

    def do_GET(self):
        self._handle_request()

    def do_POST(self):
        self._handle_request()

    def do_PUT(self):
        self._handle_request()

    def do_PATCH(self):
        self._handle_request()

    def do_DELETE(self):
        self._handle_request()

    def log_message(self, format_string, *args):
        print(
            "%s - - [%s] %s"
            % (self.address_string(), self.log_date_time_string(), format_string % args)
        )


def main():
    server = ThreadingHTTPServer((HOST, PORT), MockDeviceHandler)
    print(
        json.dumps(
            {
                "ok": True,
                "service": "mock-device-server",
                "host": HOST,
                "port": PORT,
                "auth_type": AUTH_TYPE,
            },
            ensure_ascii=True,
        )
    )
    server.serve_forever()


if __name__ == "__main__":
    main()
