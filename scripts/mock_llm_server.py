#!/usr/bin/env python3
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


HOST = os.environ.get("MOCK_LLM_HOST", "127.0.0.1")
PORT = int(os.environ.get("MOCK_LLM_PORT", "11435"))


def build_action(message: str):
    text = (message or "").strip().lower()
    normalized = text.replace(" ", "")

    if "風扇" in normalized:
        return {
            "intent": "device_control",
            "response_text": "fan requested",
            "actions": [
                {
                    "target_key": "integration-home",
                    "device_key": "fan_01",
                    "command_key": "lightcommands",
                    "args": {"state": "ON"},
                }
            ],
        }

    if "confirm " in normalized or "cancel " in normalized:
        return {
            "intent": "chat",
            "response_text": "pending action command",
            "actions": [],
        }

    desired_state = None
    if "打開" in normalized or "開燈" in normalized or "開啟" in normalized or "on" in normalized:
        desired_state = "ON"
    elif "關掉" in normalized or "關閉" in normalized or "關" in normalized or "off" in normalized:
        desired_state = "OFF"

    if "light_01" in normalized or "light" in normalized or "燈" in normalized:
        return {
            "intent": "device_control",
            "response_text": "light requested",
            "actions": [
                {
                    "target_key": "integration-home",
                    "device_key": "light_01",
                    "command_key": "lightcommands",
                    "args": {"state": desired_state or "ON"},
                }
            ],
        }

    return {"intent": "reject", "response_text": "unknown device", "actions": []}


class Handler(BaseHTTPRequestHandler):
    server_version = "MockLlmServer/1.0"

    def _send(self, status: int, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print("%s - - [%s] %s" % (self.address_string(), self.log_date_time_string(), fmt % args))

    def do_GET(self):
        if self.path in ("/health", "/v1/models", "/models"):
            self._send(
                200,
                {
                    "object": "list",
                    "data": [{"id": "mock-home-automation", "object": "model"}],
                },
            )
            return

        self._send(404, {"error": "not_found"})

    def do_POST(self):
        if self.path not in ("/v1/chat/completions", "/chat/completions"):
            self._send(404, {"error": "not_found"})
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(content_length).decode("utf-8") if content_length else "{}"

        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            self._send(400, {"error": "invalid_json"})
            return

        messages = payload.get("messages") or []
        user_message = ""
        if messages:
            user_message = str(messages[-1].get("content", ""))

        marker = "user_message:"
        extracted = user_message.split(marker, 1)[1].strip() if marker in user_message else user_message
        action = build_action(extracted)

        self._send(
            200,
            {
                "id": "chatcmpl-mock",
                "object": "chat.completion",
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": json.dumps(action, ensure_ascii=False),
                        },
                        "finish_reason": "stop",
                    }
                ],
            },
        )


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(json.dumps({"ok": True, "service": "mock-llm-server", "host": HOST, "port": PORT}))
    server.serve_forever()
