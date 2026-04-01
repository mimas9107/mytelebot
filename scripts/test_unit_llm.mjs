import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEndpointCandidates,
  buildPrompt,
  parseCapabilitiesJson,
  parseJsonFromText
} from "../apps/web/lib/llm-utils.mjs";

test("parseCapabilitiesJson returns defaults for empty or invalid input", () => {
  assert.deepEqual(parseCapabilitiesJson(""), {
    capabilityProfile: "openai_compatible",
    jsonOutputMode: "prompt_only",
    jsonStrict: false
  });

  assert.deepEqual(parseCapabilitiesJson("not-json"), {
    capabilityProfile: "openai_compatible",
    jsonOutputMode: "prompt_only",
    jsonStrict: false
  });
});

test("parseCapabilitiesJson reads json strictness fields", () => {
  assert.deepEqual(
    parseCapabilitiesJson(JSON.stringify({
      capability_profile: "ollama",
      json_output_mode: "json_object",
      json_strict: true
    })),
    {
      capabilityProfile: "ollama",
      jsonOutputMode: "json_object",
      jsonStrict: true
    }
  );
});

test("buildEndpointCandidates avoids duplicate /chat/completions suffixing", () => {
  assert.deepEqual(buildEndpointCandidates("http://127.0.0.1:11434/v1"), [
    "http://127.0.0.1:11434/v1/chat/completions"
  ]);

  assert.deepEqual(buildEndpointCandidates("http://127.0.0.1:11434"), [
    "http://127.0.0.1:11434/v1/chat/completions",
    "http://127.0.0.1:11434/chat/completions"
  ]);
});

test("parseJsonFromText extracts first json object from provider content", () => {
  const text = 'prefix {"intent":"device_control","actions":[]} suffix';
  assert.deepEqual(parseJsonFromText(text), {
    intent: "device_control",
    actions: []
  });
  assert.equal(parseJsonFromText("not-json"), null);
});

test("buildPrompt includes schema context and user message", () => {
  const prompt = buildPrompt({
    message: "把燈打開",
    context: { available_targets: [{ target_key: "home" }] }
  });

  assert.match(prompt, /available_targets/);
  assert.match(prompt, /把燈打開/);
  assert.match(prompt, /device_control\|device_query\|chat\|reject/);
});
