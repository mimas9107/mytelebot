import { createHmac } from "node:crypto";

export function applyArgsToTemplate(template, args) {
  if (template === null || template === undefined) {
    return template;
  }

  if (typeof template === "string") {
    const exact = template.match(/^\{\{([a-zA-Z0-9_]+)\}\}$/);

    if (exact) {
      const key = exact[1];
      return key in args ? args[key] : template;
    }

    return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) =>
      key in args ? String(args[key]) : `{{${key}}}`
    );
  }

  if (Array.isArray(template)) {
    return template.map((item) => applyArgsToTemplate(item, args));
  }

  if (typeof template === "object") {
    const output = {};

    for (const [key, value] of Object.entries(template)) {
      output[key] = applyArgsToTemplate(value, args);
    }

    return output;
  }

  return template;
}

export function parseJsonString(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function parseResponseBody(responseText) {
  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return null;
  }
}

export function buildHmacSignature({ secret, timestamp, method, pathWithQuery, bodyText }) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${method.toUpperCase()}.${pathWithQuery}.${bodyText}`)
    .digest("hex");
}
