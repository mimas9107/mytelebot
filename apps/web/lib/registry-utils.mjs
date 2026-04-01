export function parseAliasesJson(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function getDeviceMatchCandidates(device) {
  return [device.deviceKey, device.name, ...parseAliasesJson(device.aliasesJson)];
}

export function getCommandMatchCandidates(command) {
  return [command.commandKey, command.label, ...parseAliasesJson(command.aliasesJson)];
}

export function normalizeKey(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function rawTextExplicitlyMentionsDevice(rawText, device) {
  const normalizedText = normalizeKey(rawText);

  if (!normalizedText) {
    return false;
  }

  const candidates = getDeviceMatchCandidates(device)
    .map((value) => normalizeKey(value))
    .filter(Boolean);

  return candidates.some((candidate) => normalizedText.includes(candidate));
}

export function validateArgsForCommand({ args, argsSchemaJson }) {
  if (!argsSchemaJson) {
    return { ok: true };
  }

  let schema;

  try {
    schema = JSON.parse(argsSchemaJson);
  } catch {
    return { ok: false, reason: "invalid_args_schema" };
  }

  return validateSchemaNode({
    value: args,
    schema,
    path: ""
  });
}

export function validateSchemaNode({ value, schema, path }) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return { ok: true };
  }

  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, reason: `arg_type_invalid:${path || "root"}` };
    }

    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const key of required) {
      if (!(key in value)) {
        const keyPath = path ? `${path}.${key}` : key;
        return { ok: false, reason: `missing_required_arg:${keyPath}` };
      }
    }

    const properties = schema.properties && typeof schema.properties === "object"
      ? schema.properties
      : {};

    for (const [key, rules] of Object.entries(properties)) {
      if (!(key in value)) {
        continue;
      }

      const keyPath = path ? `${path}.${key}` : key;
      const nestedResult = validateSchemaNode({
        value: value[key],
        schema: rules,
        path: keyPath
      });

      if (!nestedResult.ok) {
        return nestedResult;
      }
    }

    return { ok: true };
  }

  if (schema.type === "string") {
    if (typeof value !== "string") {
      return { ok: false, reason: `arg_type_invalid:${path}` };
    }

    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
      return { ok: false, reason: `arg_enum_invalid:${path}` };
    }

    if (schema.pattern) {
      try {
        const pattern = new RegExp(schema.pattern);
        if (!pattern.test(value)) {
          return { ok: false, reason: `arg_pattern_invalid:${path}` };
        }
      } catch {
        return { ok: false, reason: "invalid_args_schema" };
      }
    }

    return { ok: true };
  }

  if (schema.type === "number" || schema.type === "integer") {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return { ok: false, reason: `arg_type_invalid:${path}` };
    }

    if (schema.type === "integer" && !Number.isInteger(value)) {
      return { ok: false, reason: `arg_type_invalid:${path}` };
    }

    if (typeof schema.minimum === "number" && value < schema.minimum) {
      return { ok: false, reason: `arg_minimum_invalid:${path}` };
    }

    if (typeof schema.maximum === "number" && value > schema.maximum) {
      return { ok: false, reason: `arg_maximum_invalid:${path}` };
    }

    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
      return { ok: false, reason: `arg_enum_invalid:${path}` };
    }

    return { ok: true };
  }

  if (schema.type === "boolean") {
    if (typeof value !== "boolean") {
      return { ok: false, reason: `arg_type_invalid:${path}` };
    }

    return { ok: true };
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      return { ok: false, reason: `arg_type_invalid:${path}` };
    }

    if (schema.items) {
      for (let index = 0; index < value.length; index += 1) {
        const nestedResult = validateSchemaNode({
          value: value[index],
          schema: schema.items,
          path: `${path}[${index}]`
        });

        if (!nestedResult.ok) {
          return nestedResult;
        }
      }
    }

    return { ok: true };
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    return { ok: false, reason: `arg_enum_invalid:${path}` };
  }

  return { ok: true };
}
