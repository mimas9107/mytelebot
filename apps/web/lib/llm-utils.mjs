export function parseJsonFromText(text) {
  if (!text) {
    return null;
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function buildPrompt({ message, context }) {
  return [
    "You are a command parser for home automation.",
    "Output one JSON object only, no markdown.",
    "Use only keys listed in available_targets.",
    "If unsure, return intent=reject and no actions.",
    'Output schema: {"intent":"device_control|device_query|chat|reject","response_text":"string","actions":[{"target_key":"string","device_key":"string","command_key":"string","args":{}}]}',
    "",
    `available_targets: ${JSON.stringify(context)}`,
    "",
    `user_message: ${message}`
  ].join("\n");
}

export function parseCapabilitiesJson(value) {
  if (!value) {
    return {
      capabilityProfile: "openai_compatible",
      jsonOutputMode: "prompt_only",
      jsonStrict: false
    };
  }

  try {
    const parsed = JSON.parse(value);

    return {
      capabilityProfile: parsed.capability_profile || "openai_compatible",
      jsonOutputMode: parsed.json_output_mode || "prompt_only",
      jsonStrict: Boolean(parsed.json_strict)
    };
  } catch {
    return {
      capabilityProfile: "openai_compatible",
      jsonOutputMode: "prompt_only",
      jsonStrict: false
    };
  }
}

export function buildEndpointCandidates(baseUrl) {
  const normalized = String(baseUrl || "").replace(/\/$/, "");

  if (normalized.endsWith("/v1")) {
    return [`${normalized}/chat/completions`];
  }

  return [
    `${normalized}/v1/chat/completions`,
    `${normalized}/chat/completions`
  ];
}
