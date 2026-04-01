#!/usr/bin/env python3
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = os.environ.get("MOCK_TELEGRAM_HOST", "127.0.0.1")
PORT = int(os.environ.get("MOCK_TELEGRAM_PORT", "19000"))
MESSAGES = []


class Handler(BaseHTTPRequestHandler):
    server_version = "MockTelegramServer/1.0"

    def _send(self, status, payload):
      body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
      self.send_response(status)
      self.send_header("Content-Type", "application/json; charset=utf-8")
      self.send_header("Content-Length", str(len(body)))
      self.end_headers()
      self.wfile.write(body)

    def _read_json(self):
      length = int(self.headers.get("Content-Length", "0") or "0")
      raw = self.rfile.read(length) if length > 0 else b"{}"
      try:
        return json.loads(raw.decode("utf-8"))
      except json.JSONDecodeError:
        return None

    def do_GET(self):
      if self.path == "/health":
        self._send(200, {"ok": True, "service": "mock-telegram-server", "messages": len(MESSAGES)})
        return

      if self.path == "/messages":
        self._send(200, {"ok": True, "messages": MESSAGES})
        return

      self._send(404, {"ok": False, "error": "not_found"})

    def do_POST(self):
      if self.path == "/reset":
        MESSAGES.clear()
        self._send(200, {"ok": True, "messages": []})
        return

      if not self.path.startswith("/bot") or not self.path.endswith("/sendMessage"):
        self._send(404, {"ok": False, "error": "not_found"})
        return

      payload = self._read_json()
      if not isinstance(payload, dict):
        self._send(400, {"ok": False, "error": "invalid_json"})
        return

      message = {
        "path": self.path,
        "chat_id": payload.get("chat_id"),
        "text": payload.get("text"),
      }
      MESSAGES.append(message)
      self._send(
        200,
        {
          "ok": True,
          "result": {
            "message_id": len(MESSAGES),
            "chat": {"id": payload.get("chat_id"), "type": "private"},
            "text": payload.get("text"),
          },
        },
      )

    def log_message(self, fmt, *args):
      print("%s - - [%s] %s" % (self.address_string(), self.log_date_time_string(), fmt % args))


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(json.dumps({"ok": True, "service": "mock-telegram-server", "host": HOST, "port": PORT}))
    server.serve_forever()
