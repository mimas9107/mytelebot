import test from "node:test";
import assert from "node:assert/strict";
import { applyArgsToTemplate } from "../apps/web/lib/dispatcher-utils.mjs";

test("payload template renders nested objects and arrays", () => {
  const template = {
    state: "{{state}}",
    room: "{{room}}",
    tags: ["{{state}}", "fixed"],
    schedule: {
      enabled: "{{enabled}}",
      note: "set {{room}} to {{state}}"
    }
  };

  const rendered = applyArgsToTemplate(template, {
    state: "ON",
    room: "living_room",
    enabled: true
  });

  assert.deepEqual(rendered, {
    state: "ON",
    room: "living_room",
    tags: ["ON", "fixed"],
    schedule: {
      enabled: true,
      note: "set living_room to ON"
    }
  });
});

test("payload template preserves unresolved placeholders", () => {
  const template = {
    state: "{{state}}",
    brightness: "{{brightness}}",
    note: "set {{state}} / {{missing}}"
  };

  const rendered = applyArgsToTemplate(template, { state: "OFF" });

  assert.deepEqual(rendered, {
    state: "OFF",
    brightness: "{{brightness}}",
    note: "set OFF / {{missing}}"
  });
});

test("payload template keeps scalar values untouched", () => {
  const template = {
    retries: 2,
    enabled: false,
    meta: null
  };

  assert.deepEqual(applyArgsToTemplate(template, { enabled: true }), template);
});
