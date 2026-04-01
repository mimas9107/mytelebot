import test from "node:test";
import assert from "node:assert/strict";
import { validateArgsForCommand } from "../apps/web/lib/registry-utils.mjs";

const schema = JSON.stringify({
  type: "object",
  properties: {
    temperature: { type: "number", minimum: 18, maximum: 30 },
    mode: { type: "string", pattern: "^(cool|dry|fan)$" },
    enabled: { type: "boolean" },
    schedule: {
      type: "object",
      properties: {
        hour: { type: "integer", minimum: 0, maximum: 23 }
      },
      required: ["hour"]
    },
    zones: {
      type: "array",
      items: { type: "string", enum: ["A", "B", "C"] }
    }
  },
  required: ["temperature", "mode"]
});

test("validateArgsForCommand accepts nested valid payload", () => {
  assert.deepEqual(
    validateArgsForCommand({
      args: {
        temperature: 24,
        mode: "cool",
        enabled: true,
        schedule: { hour: 7 },
        zones: ["A", "C"]
      },
      argsSchemaJson: schema
    }),
    { ok: true }
  );
});

test("validateArgsForCommand rejects missing required nested arg", () => {
  assert.deepEqual(
    validateArgsForCommand({
      args: {
        temperature: 24,
        mode: "cool",
        schedule: {}
      },
      argsSchemaJson: schema
    }),
    { ok: false, reason: "missing_required_arg:schedule.hour" }
  );
});

test("validateArgsForCommand rejects minimum maximum and pattern violations", () => {
  assert.deepEqual(
    validateArgsForCommand({
      args: { temperature: 10, mode: "cool" },
      argsSchemaJson: schema
    }),
    { ok: false, reason: "arg_minimum_invalid:temperature" }
  );

  assert.deepEqual(
    validateArgsForCommand({
      args: { temperature: 24, mode: "heat" },
      argsSchemaJson: schema
    }),
    { ok: false, reason: "arg_pattern_invalid:mode" }
  );
});

test("validateArgsForCommand rejects invalid array item enum", () => {
  assert.deepEqual(
    validateArgsForCommand({
      args: { temperature: 24, mode: "fan", zones: ["A", "Z"] },
      argsSchemaJson: schema
    }),
    { ok: false, reason: "arg_enum_invalid:zones[1]" }
  );
});
