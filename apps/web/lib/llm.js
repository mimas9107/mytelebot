import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/encryption";
import { buildEndpointCandidates, buildPrompt, parseCapabilitiesJson, parseJsonFromText } from "./llm-utils.mjs";
import { logError, logInfo, logWarn, summarizeText } from "@/lib/logger";

function createLlmError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}



export async function getActiveProvider() {
  let provider = await prisma.llmProvider.findFirst({
    where: {
      isDefault: true,
      status: "active"
    },
    include: {
      apiKeySecret: {
        select: {
          encryptedValue: true
        }
      }
    }
  });

  if (!provider) {
    provider = await prisma.llmProvider.findFirst({
      where: {
        status: "active"
      },
      orderBy: {
        createdAt: "desc"
      },
      include: {
        apiKeySecret: {
          select: {
            encryptedValue: true
          }
        }
      }
    });
  }

  if (!provider) {
    return null;
  }

  return {
    id: provider.id,
    providerKey: provider.providerKey,
    baseUrl: provider.baseUrl.replace(/\/$/, ""),
    model: provider.model,
    capabilities: parseCapabilitiesJson(provider.capabilitiesJson),
    extraHeaders: provider.extraHeadersJson ? JSON.parse(provider.extraHeadersJson) : {},
    apiKey: provider.apiKeySecret?.encryptedValue
      ? decryptSecret(provider.apiKeySecret.encryptedValue)
      : null
  };
}

export async function parseCommandWithLlm({ provider, message, context, traceId = null }) {
  const userPrompt = buildPrompt({ message, context });
  const strictSystemPrompt = provider.capabilities?.jsonStrict
    ? "You convert natural language into strict command JSON. Return JSON only without commentary."
    : "You convert natural language into strict command JSON.";
  const headers = {
    "Content-Type": "application/json",
    ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
    ...provider.extraHeaders
  };
  const requestPayload = {
    model: provider.model,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: strictSystemPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ]
  };

  if (provider.capabilities?.jsonOutputMode === "json_object") {
    requestPayload.response_format = { type: "json_object" };
  }

  const requestBody = JSON.stringify(requestPayload);

  const endpointCandidates = buildEndpointCandidates(provider.baseUrl);
  const startedAt = Date.now();

  logInfo("llm_request_start", {
    traceId,
    providerKey: provider.providerKey,
    model: provider.model,
    endpointCandidates,
    jsonOutputMode: provider.capabilities?.jsonOutputMode || "prompt_only",
    jsonStrict: Boolean(provider.capabilities?.jsonStrict),
    messagePreview: summarizeText(message, 160)
  });

  let payload = null;
  let lastError = null;
  const timeoutMs = 15000;

  for (const endpoint of endpointCandidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const attemptStartedAt = Date.now();
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: requestBody,
        signal: controller.signal
      });

      if (response.ok) {
        payload = await response.json();
        logInfo("llm_request_success", {
          traceId,
          providerKey: provider.providerKey,
          model: provider.model,
          endpoint,
          status: response.status,
          durationMs: Date.now() - attemptStartedAt
        });
        break;
      }

      const body = await response.text();
      logWarn("llm_request_http_error", {
        traceId,
        providerKey: provider.providerKey,
        model: provider.model,
        endpoint,
        status: response.status,
        bodyPreview: summarizeText(body, 500),
        durationMs: Date.now() - attemptStartedAt
      });
      lastError = createLlmError(
        "provider_http_error",
        `LLM request failed at ${endpoint}: ${response.status} ${body}`
      );
    } catch (error) {
      logWarn("llm_request_exception", {
        traceId,
        providerKey: provider.providerKey,
        model: provider.model,
        endpoint,
        error
      });
      if (error instanceof Error && error.name === "AbortError") {
        lastError = createLlmError(
          "provider_timeout",
          `LLM request timed out at ${endpoint}`
        );
      } else {
        lastError = createLlmError(
          "provider_network_error",
          error instanceof Error
            ? `LLM network request failed at ${endpoint}: ${error.message}`
            : `LLM network request failed at ${endpoint}`
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!payload) {
    logError("llm_request_failed", {
      traceId,
      providerKey: provider.providerKey,
      model: provider.model,
      durationMs: Date.now() - startedAt,
      error: lastError || createLlmError("provider_request_failed", "LLM request failed")
    });
    throw lastError || createLlmError("provider_request_failed", "LLM request failed");
  }

  const content = payload?.choices?.[0]?.message?.content;
  const parsed = parseJsonFromText(content);

  if (!parsed || typeof parsed !== "object") {
    logWarn("llm_response_invalid", {
      traceId,
      providerKey: provider.providerKey,
      model: provider.model,
      contentPreview: summarizeText(content, 500),
      durationMs: Date.now() - startedAt
    });
    throw createLlmError(
      "provider_response_invalid",
      "LLM output is not valid JSON object"
    );
  }

  logInfo("llm_parse_success", {
    traceId,
    providerKey: provider.providerKey,
    model: provider.model,
    intent: parsed.intent || null,
    actionsCount: Array.isArray(parsed.actions) ? parsed.actions.length : 0,
    durationMs: Date.now() - startedAt
  });

  return parsed;
}
