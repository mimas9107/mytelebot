import { getVerboseServerLogsEnabled } from "@/lib/runtime-settings";

function toMegabytes(value) {
  return Math.round((Number(value || 0) / (1024 * 1024)) * 100) / 100;
}

function truncateText(value, maxLength = 300) {
  if (value === null || value === undefined) {
    return value;
  }

  const text = String(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: truncateText(error.stack, 2000)
    };
  }

  return {
    message: truncateText(error, 500)
  };
}

function sanitizeHeaders(headersLike) {
  if (!headersLike) {
    return {};
  }

  const headers =
    typeof headersLike.entries === "function"
      ? Object.fromEntries(headersLike.entries())
      : { ...headersLike };
  const masked = {};

  for (const [key, rawValue] of Object.entries(headers)) {
    const value = Array.isArray(rawValue) ? rawValue.join(",") : rawValue;
    const normalized = key.toLowerCase();

    if (
      normalized === "authorization" ||
      normalized === "cookie" ||
      normalized === "set-cookie" ||
      normalized === "x-target-secret" ||
      normalized === "x-target-signature" ||
      normalized === "x-goog-api-key"
    ) {
      masked[key] = "***";
      continue;
    }

    masked[key] = truncateText(value, 500);
  }

  return masked;
}

function sanitizeUrl(urlLike) {
  if (!urlLike) {
    return urlLike;
  }

  try {
    const url = new URL(String(urlLike));

    for (const key of ["token", "api_key", "apikey", "key", "secret"]) {
      if (url.searchParams.has(key)) {
        url.searchParams.set(key, "***");
      }
    }

    return url.toString();
  } catch {
    return String(urlLike);
  }
}

function normalizeMeta(meta) {
  if (!meta || typeof meta !== "object") {
    return meta;
  }

  const output = {};

  for (const [key, value] of Object.entries(meta)) {
    if (value instanceof Error) {
      output[key] = serializeError(value);
      continue;
    }

    if (typeof value === "string") {
      output[key] = truncateText(value, 1000);
      continue;
    }

    output[key] = value;
  }

  return output;
}

function summarizeMetaForActivity(meta = {}) {
  const summary = {};

  for (const [key, value] of Object.entries(meta)) {
    if (key === "lastActivity") {
      continue;
    }

    if (
      value === null ||
      value === undefined ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      summary[key] = value;
      continue;
    }

    if (typeof value === "string") {
      summary[key] = truncateText(value, 200);
      continue;
    }

    if (key === "error") {
      summary[key] = serializeError(value);
      continue;
    }

    if (typeof value === "object") {
      summary[key] = truncateText(JSON.stringify(value), 300);
    }
  }

  return summary;
}

function shouldTrackAsLastActivity(event) {
  return event !== "process_heartbeat";
}

function setLastActivity(event, level, meta = {}) {
  if (!shouldTrackAsLastActivity(event)) {
    return;
  }

  globalThis.__mytelebotLastActivity = {
    ts: new Date().toISOString(),
    level,
    event,
    traceId: meta.traceId || null,
    summary: summarizeMetaForActivity(meta)
  };
}

export function getLastActivity() {
  return globalThis.__mytelebotLastActivity || null;
}

export function getProcessTelemetry() {
  const memory = process.memoryUsage();

  return {
    pid: process.pid,
    nodeEnv: process.env.NODE_ENV || "unknown",
    uptimeSec: Math.round(process.uptime()),
    memory: {
      rssMb: toMegabytes(memory.rss),
      heapTotalMb: toMegabytes(memory.heapTotal),
      heapUsedMb: toMegabytes(memory.heapUsed),
      externalMb: toMegabytes(memory.external),
      arrayBuffersMb: toMegabytes(memory.arrayBuffers)
    }
  };
}

export function logMemorySnapshot(event, meta = {}) {
  logInfo(event, {
    ...meta,
    ...getProcessTelemetry()
  });
}

function log(level, event, meta = {}) {
  setLastActivity(event, level, meta);

  if (level === "info" && !getVerboseServerLogsEnabled()) {
    return;
  }

  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...normalizeMeta(meta)
  };
  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function logInfo(event, meta = {}) {
  log("info", event, meta);
}

export function logWarn(event, meta = {}) {
  log("warn", event, meta);
}

export function logError(event, meta = {}) {
  log("error", event, meta);
}

export function createTraceId(prefix = "trace") {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${randomPart}`;
}

export function summarizeText(value, maxLength = 120) {
  return truncateText(value, maxLength);
}

export function requestLogMeta(request) {
  try {
    const url = new URL(request.url);
    return {
      method: request.method,
      path: url.pathname,
      url: sanitizeUrl(url.toString()),
      userAgent: truncateText(request.headers.get("user-agent") || "", 200),
      forwardedFor: truncateText(request.headers.get("x-forwarded-for") || "", 200)
    };
  } catch {
    return {
      method: request.method,
      url: request.url
    };
  }
}

export function registerProcessHandlers() {
  if (globalThis.__mytelebotProcessHandlersRegistered) {
    return;
  }

  globalThis.__mytelebotProcessHandlersRegistered = true;

  process.on("uncaughtException", (error) => {
    logError("process_uncaught_exception", {
      error,
      ...getProcessTelemetry(),
      lastActivity: getLastActivity()
    });
  });

  process.on("unhandledRejection", (reason) => {
    logError("process_unhandled_rejection", {
      error: serializeError(reason),
      ...getProcessTelemetry(),
      lastActivity: getLastActivity()
    });
  });

  process.on("warning", (warning) => {
    logWarn("process_warning", {
      warning: serializeError(warning),
      ...getProcessTelemetry(),
      lastActivity: getLastActivity()
    });
  });

  process.on("beforeExit", (code) => {
    logWarn("process_before_exit", {
      code,
      ...getProcessTelemetry(),
      lastActivity: getLastActivity()
    });
  });

  process.on("exit", (code) => {
    const payload = JSON.stringify({
      ts: new Date().toISOString(),
      level: "warn",
      event: "process_exit",
      code,
      ...getProcessTelemetry(),
      lastActivity: getLastActivity()
    });
    console.warn(payload);
  });

  process.on("SIGTERM", () => {
    logWarn("process_signal", {
      signal: "SIGTERM",
      ...getProcessTelemetry(),
      lastActivity: getLastActivity()
    });
    process.exit(0);
  });

  process.on("SIGINT", () => {
    logWarn("process_signal", {
      signal: "SIGINT",
      ...getProcessTelemetry(),
      lastActivity: getLastActivity()
    });
    process.exit(0);
  });

  if (!globalThis.__mytelebotProcessHeartbeat) {
    globalThis.__mytelebotProcessHeartbeat = setInterval(() => {
      logInfo("process_heartbeat", {
        ...getProcessTelemetry(),
        lastActivity: getLastActivity()
      });
    }, 60_000);

    globalThis.__mytelebotProcessHeartbeat.unref?.();
  }

  logInfo("process_handlers_registered", {
    ...getProcessTelemetry(),
    lastActivity: getLastActivity()
  });
}

export { sanitizeHeaders, sanitizeUrl, serializeError };
