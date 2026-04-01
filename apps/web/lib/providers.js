import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/encryption";

function buildProviderSecretName(providerKey) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${providerKey}-api-key-${stamp}`;
}

function parseCapabilitiesValue(value) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeProviderCapabilities(formData, capabilitiesText) {
  const capabilities = parseJsonInput(capabilitiesText) ? JSON.parse(parseJsonInput(capabilitiesText)) : {};
  const capabilityProfile = String(formData.get("capabilityProfile") || "").trim() || "openai_compatible";
  const jsonOutputMode = String(formData.get("jsonOutputMode") || "").trim() || "prompt_only";
  const jsonStrict = formData.get("jsonStrict") === "on";

  return JSON.stringify({
    ...capabilities,
    capability_profile: capabilityProfile,
    json_output_mode: jsonOutputMode,
    json_strict: jsonStrict
  });
}

function parseJsonInput(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = JSON.parse(trimmed);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON input must be an object");
  }

  return JSON.stringify(parsed);
}

export async function listProviders() {
  const providers = await prisma.llmProvider.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    include: {
      apiKeySecret: {
        select: {
          id: true,
          encryptedValue: true,
          createdAt: true,
          rotatedAt: true
        }
      }
    }
  });

  const histories = await Promise.all(
    providers.map((provider) =>
      prisma.secret.findMany({
        where: {
          secretType: "llm_api_key",
          name: {
            startsWith: `${provider.providerKey}-api-key`
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
          rotatedAt: true
        },
        take: 5
      })
    )
  );

  return providers.map((provider, index) => ({
    ...provider,
    capabilityProfile:
      parseCapabilitiesValue(provider.capabilitiesJson).capability_profile ||
      "openai_compatible",
    jsonOutputMode:
      parseCapabilitiesValue(provider.capabilitiesJson).json_output_mode ||
      "prompt_only",
    jsonStrict: Boolean(parseCapabilitiesValue(provider.capabilitiesJson).json_strict),
    maskedApiKey: provider.apiKeySecret ? "Stored securely" : null,
    apiKeyHistory: histories[index],
    apiKeyVersionCount: histories[index].length
  }));
}

export async function createProvider(formData) {
  const providerKey = String(formData.get("providerKey") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const baseUrl = String(formData.get("baseUrl") || "").trim();
  const model = String(formData.get("model") || "").trim();
  const apiKey = String(formData.get("apiKey") || "").trim();
  const extraHeadersText = String(formData.get("extraHeadersJson") || "");
  const capabilitiesText = String(formData.get("capabilitiesJson") || "");
  const makeDefault = formData.get("makeDefault") === "on";

  if (!providerKey || !name || !baseUrl || !model) {
    throw new Error("providerKey, name, baseUrl, and model are required");
  }

  const extraHeadersJson = parseJsonInput(extraHeadersText);
  const capabilitiesJson = normalizeProviderCapabilities(formData, capabilitiesText);

  await prisma.$transaction(async (tx) => {
    let apiKeySecretId = null;

    if (apiKey) {
      const secret = await tx.secret.create({
        data: {
          secretType: "llm_api_key",
          name: buildProviderSecretName(providerKey),
          encryptedValue: encryptSecret(apiKey)
        }
      });

      apiKeySecretId = secret.id;
    }

    if (makeDefault) {
      await tx.llmProvider.updateMany({
        data: {
          isDefault: false
        }
      });
    }

    await tx.llmProvider.create({
      data: {
        providerKey,
        name,
        baseUrl,
        model,
        extraHeadersJson,
        capabilitiesJson,
        apiKeySecretId,
        status: makeDefault ? "active" : "inactive",
        isDefault: makeDefault
      }
    });
  });
}

export async function updateProvider(formData) {
  const providerId = String(formData.get("providerId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const baseUrl = String(formData.get("baseUrl") || "").trim();
  const model = String(formData.get("model") || "").trim();
  const extraHeadersText = String(formData.get("extraHeadersJson") || "");
  const capabilitiesText = String(formData.get("capabilitiesJson") || "");

  if (!providerId || !name || !baseUrl || !model) {
    throw new Error("providerId, name, baseUrl, and model are required");
  }

  const extraHeadersJson = parseJsonInput(extraHeadersText);
  const capabilitiesJson = normalizeProviderCapabilities(formData, capabilitiesText);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.llmProvider.findUnique({
      where: { id: providerId },
      select: {
        id: true,
        providerKey: true
      }
    });

    if (!existing) {
      throw new Error("Provider not found");
    }

    await tx.llmProvider.update({
      where: { id: providerId },
      data: {
        name,
        baseUrl,
        model,
        extraHeadersJson,
        capabilitiesJson
      }
    });
  });
}

export async function rotateProviderApiKey(formData, actorUser) {
  const providerId = String(formData.get("providerId") || "").trim();
  const apiKey = String(formData.get("apiKey") || "").trim();
  const confirmRotation = formData.get("confirmRotation") === "on";

  if (!providerId || !apiKey) {
    throw new Error("providerId and apiKey are required");
  }

  if (!confirmRotation) {
    throw new Error("Rotation confirmation is required");
  }

  await prisma.$transaction(async (tx) => {
    const provider = await tx.llmProvider.findUnique({
      where: { id: providerId },
      select: {
        id: true,
        providerKey: true,
        apiKeySecretId: true
      }
    });

    if (!provider) {
      throw new Error("Provider not found");
    }

    const newSecret = await tx.secret.create({
      data: {
        secretType: "llm_api_key",
        name: buildProviderSecretName(provider.providerKey),
        encryptedValue: encryptSecret(apiKey)
      }
    });

    if (provider.apiKeySecretId) {
      await tx.secret.update({
        where: { id: provider.apiKeySecretId },
        data: {
          rotatedAt: new Date()
        }
      });
    }

    await tx.llmProvider.update({
      where: { id: provider.id },
      data: {
        apiKeySecretId: newSecret.id
      }
    });

    await tx.auditLog.create({
      data: {
        actorType: "admin",
        actorId: actorUser.id,
        userId: actorUser.id,
        providerId: provider.id,
        rawInput: `rotate provider api key ${provider.providerKey}`,
        executionStatus: "provider_api_key_rotated",
        parsedResultJson: JSON.stringify({
          providerId: provider.id,
          providerKey: provider.providerKey,
          replacedSecretId: provider.apiKeySecretId,
          newSecretId: newSecret.id
        })
      }
    });
  });
}

export async function setDefaultProvider(providerId) {
  await prisma.$transaction(async (tx) => {
    await tx.llmProvider.updateMany({
      data: {
        isDefault: false
      }
    });

    await tx.llmProvider.update({
      where: { id: providerId },
      data: {
        isDefault: true,
        status: "active"
      }
    });
  });
}

export async function toggleProviderStatus(providerId) {
  const provider = await prisma.llmProvider.findUnique({
    where: { id: providerId },
    select: { id: true, status: true }
  });

  if (!provider) {
    throw new Error("Provider not found");
  }

  await prisma.llmProvider.update({
    where: { id: providerId },
    data: {
      status: provider.status === "active" ? "inactive" : "active"
    }
  });
}

export async function deleteProvider(providerId) {
  await prisma.$transaction(async (tx) => {
    const provider = await tx.llmProvider.findUnique({
      where: { id: providerId },
      select: { apiKeySecretId: true, providerKey: true }
    });

    await tx.llmProvider.delete({
      where: { id: providerId }
    });

    if (provider?.providerKey) {
      await tx.secret.deleteMany({
        where: {
          secretType: "llm_api_key",
          name: {
            startsWith: `${provider.providerKey}-api-key`
          }
        }
      });
    }
  });
}

export async function testProviderConnection(providerId) {
  const provider = await prisma.llmProvider.findUnique({
    where: { id: providerId },
    include: {
      apiKeySecret: {
        select: {
          encryptedValue: true
        }
      }
    }
  });

  if (!provider) {
    throw new Error("Provider not found");
  }

  const baseUrl = provider.baseUrl.replace(/\/$/, "");
  const headers = {
    ...(provider.apiKeySecret?.encryptedValue
      ? { Authorization: `Bearer ${decryptSecret(provider.apiKeySecret.encryptedValue)}` }
      : {}),
    ...(provider.extraHeadersJson ? JSON.parse(provider.extraHeadersJson) : {})
  };
  const endpointCandidates = baseUrl.endsWith("/v1")
    ? [`${baseUrl}/models`]
    : [`${baseUrl}/v1/models`, `${baseUrl}/models`];
  let lastError = "Provider endpoint is unreachable";

  for (const endpoint of endpointCandidates) {
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers
      });
      const body = await response.text();

      return {
        ok: response.ok,
        reachable: true,
        endpoint,
        status: response.status,
        message: response.ok
          ? `Connected successfully at ${endpoint}`
          : `Provider responded with HTTP ${response.status}`,
        bodyPreview: body.slice(0, 300)
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Provider request failed";
    }
  }

  return {
    ok: false,
    reachable: false,
    endpoint: endpointCandidates[0],
    status: null,
    message: lastError,
    bodyPreview: ""
  };
}
