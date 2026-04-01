import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/encryption";
import { buildEndpointCandidates, buildPrompt, parseCapabilitiesJson, parseJsonFromText } from "./llm-utils.mjs";

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

export async function parseCommandWithLlm({ provider, message, context }) {
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

  let payload = null;
  let lastError = null;
  const timeoutMs = 15000;

  for (const endpoint of endpointCandidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: requestBody,
        signal: controller.signal
      });

      if (response.ok) {
        payload = await response.json();
        break;
      }

      const body = await response.text();
      lastError = createLlmError(
        "provider_http_error",
        `LLM request failed at ${endpoint}: ${response.status} ${body}`
      );
    } catch (error) {
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
    throw lastError || createLlmError("provider_request_failed", "LLM request failed");
  }

  const content = payload?.choices?.[0]?.message?.content;
  const parsed = parseJsonFromText(content);

  if (!parsed || typeof parsed !== "object") {
    throw createLlmError(
      "provider_response_invalid",
      "LLM output is not valid JSON object"
    );
  }

  return parsed;
}
