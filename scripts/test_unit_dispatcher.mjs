import test from "node:test";
import assert from "node:assert/strict";
import {
  applyArgsToTemplate,
  buildHmacSignature,
  parseJsonString,
  parseResponseBody
} from "../apps/web/lib/dispatcher-utils.mjs";

test("parseJsonString parses valid json and returns null for invalid json", () => {
  assert.deepEqual(parseJsonString('{"state":"ON"}'), { state: "ON" });
  assert.equal(parseJsonString("not-json"), null);
});

test("parseResponseBody parses target json body", () => {
  assert.deepEqual(parseResponseBody('{"ok":false,"error":"denied"}'), {
    ok: false,
    error: "denied"
  });
  assert.equal(parseResponseBody("plain text"), null);
});

test("applyArgsToTemplate substitutes exact placeholder with native type", () => {
  assert.deepEqual(
    applyArgsToTemplate({ enabled: "{{enabled}}", note: "{{state}}" }, { enabled: true, state: "ON" }),
    { enabled: true, note: "ON" }
  );
});

test("buildHmacSignature is deterministic for identical inputs", () => {
  const input = {
    secret: "test-secret",
    timestamp: "1710000001",
    method: "post",
    pathWithQuery: "/device/light_01?mode=on",
    bodyText: '{"state":"ON"}'
  };

  assert.equal(buildHmacSignature(input), buildHmacSignature(input));
  assert.equal(buildHmacSignature(input).length, 64);
});
