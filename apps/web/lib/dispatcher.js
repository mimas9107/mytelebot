import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/encryption";
import {
  applyArgsToTemplate,
  buildHmacSignature,
  parseJsonString,
  parseResponseBody
} from "./dispatcher-utils.mjs";

async function resolveTargetAuth(targetId) {
  const target = await prisma.target.findUnique({
    where: { id: targetId },
    include: {
      authSecret: {
        select: {
          encryptedValue: true
        }
      }
    }
  });

  if (!target) {
    throw new Error("Target not found during dispatch");
  }

  const secret = target.authSecret?.encryptedValue
    ? decryptSecret(target.authSecret.encryptedValue)
    : null;

  return { target, secret };
}

function applyAuth({ target, secret, headers, url, method, bodyText }) {
  if (!secret || target.authType === "none") {
    return;
  }

  if (target.authType === "bearer") {
    headers.Authorization = `Bearer ${secret}`;
    return;
  }

  if (target.authType === "header") {
    headers["X-Target-Secret"] = secret;
    return;
  }

  if (target.authType === "query") {
    url.searchParams.set("token", secret);
    return;
  }

  if (target.authType === "hmac") {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const pathWithQuery = `${url.pathname}${url.search}`;
    const signature = buildHmacSignature({
      secret,
      timestamp,
      method,
      pathWithQuery,
      bodyText
    });
    headers["X-Target-Timestamp"] = timestamp;
    headers["X-Target-Signature"] = `sha256=${signature}`;
    return;
  }
}

export async function renderValidatedAction(action) {
  const { target: inputTarget, command, args } = action;
  const { target, secret } = await resolveTargetAuth(inputTarget.id);
  const headers = {
    "Content-Type": "application/json"
  };
  const url = new URL(command.path, target.baseUrl.endsWith("/") ? target.baseUrl : `${target.baseUrl}/`);
  const payloadTemplate = parseJsonString(command.payloadTemplateJson);
  const payload = payloadTemplate ? applyArgsToTemplate(payloadTemplate, args) : null;
  const bodyText =
    command.method === "GET" || command.method === "HEAD"
      ? ""
      : payload
        ? JSON.stringify(payload)
        : "";

  applyAuth({ target, secret, headers, url, method: command.method, bodyText });
  const rawHeaders = { ...headers };
  const rawUrl = url.toString();
  const maskedHeaders = { ...headers };
  const maskedUrl = new URL(url.toString());

  if (maskedHeaders.Authorization) {
    maskedHeaders.Authorization = "Bearer ***";
  }

  if (maskedHeaders["X-Target-Secret"]) {
    maskedHeaders["X-Target-Secret"] = "***";
  }

  if (maskedHeaders["X-Target-Signature"]) {
    maskedHeaders["X-Target-Signature"] = "sha256=***";
  }

  if (maskedUrl.searchParams.has("token")) {
    maskedUrl.searchParams.set("token", "***");
  }

  return {
    target,
    command,
    args,
    timeoutMs: Number.isFinite(target.timeoutMs) ? target.timeoutMs : 8000,
    rawRequest: {
      method: command.method,
      url: rawUrl,
      headers: rawHeaders,
      payload
    },
    request: {
      method: command.method,
      url: maskedUrl.toString(),
      headers: maskedHeaders,
      payload
    }
  };
}

export async function dispatchValidatedAction(action) {
  const rendered = await renderValidatedAction(action);
  const { target, command, timeoutMs, request } = rendered;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    try {
      const response = await fetch(rendered.rawRequest.url, {
        method: command.method,
        headers: rendered.rawRequest.headers,
        body:
          command.method === "GET" || command.method === "HEAD"
            ? undefined
            : rendered.rawRequest.payload
              ? JSON.stringify(rendered.rawRequest.payload)
              : undefined,
        signal: controller.signal
      });
      const responseText = await response.text();
      const responseJson = parseResponseBody(responseText);

      if (response.ok && responseJson && responseJson.ok === false) {
        return {
          ok: false,
          status: response.status,
          errorType: "target_business_error",
          errorMessage:
            responseJson.error ||
            responseJson.message ||
            `target reported business failure at status ${response.status}`,
          targetKey: target.targetKey,
          commandKey: command.commandKey,
          request,
          responseText
        };
      }

      return {
        ok: response.ok,
        status: response.status,
        errorType: response.ok ? null : "http_error",
        errorMessage:
          response.ok
            ? null
            : responseJson?.error ||
              responseJson?.message ||
              `target returned status ${response.status}`,
        targetKey: target.targetKey,
        commandKey: command.commandKey,
        request,
        responseText
      };
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === "AbortError";

      return {
        ok: false,
        status: null,
        errorType: isTimeout ? "network_timeout" : "network_error",
        errorMessage:
          error instanceof Error ? error.message : "dispatcher request failed",
        targetKey: target.targetKey,
        commandKey: command.commandKey,
        request,
        responseText: ""
      };
    }
  } finally {
    clearTimeout(timeout);
  }
}
