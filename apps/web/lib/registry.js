import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/encryption";
import { renderValidatedAction } from "@/lib/dispatcher";
import { createHmac } from "node:crypto";
import {
  getCommandMatchCandidates,
  getDeviceMatchCandidates,
  normalizeKey,
  parseAliasesJson,
  rawTextExplicitlyMentionsDevice,
  validateArgsForCommand
} from "./registry-utils.mjs";

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

function parseJsonArrayInput(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = JSON.parse(trimmed);

  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error("JSON input must be an array of strings");
  }

  const normalized = parsed.map((item) => item.trim()).filter(Boolean);

  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}

export async function listRegistryData() {
  const [targets, devices, commands] = await Promise.all([
    prisma.target.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        authSecret: {
          select: { id: true }
        }
      }
    }),
    prisma.device.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        target: {
          select: {
            id: true,
            name: true,
            targetKey: true
          }
        }
      }
    }),
    prisma.deviceCommand.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        device: {
          select: {
            id: true,
            name: true,
            deviceKey: true,
            target: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })
  ]);

  return {
    targets: targets.map((target) => ({
      ...target,
      hasAuthSecret: Boolean(target.authSecret)
    })),
    devices: devices.map((device) => ({
      ...device,
      aliases: parseAliasesJson(device.aliasesJson)
    })),
    commands: commands.map((command) => ({
      ...command,
      aliases: parseAliasesJson(command.aliasesJson)
    }))
  };
}

export async function buildLlmRegistryContext() {
  const targets = await prisma.target.findMany({
    where: {
      status: "active"
    },
    include: {
      devices: {
        where: {
          status: "active"
        },
        include: {
          commands: {
            where: {
              status: "active"
            }
          }
        }
      }
    }
  });

  return {
    available_targets: targets.map((target) => ({
      target_key: target.targetKey,
      name: target.name,
      devices: target.devices.map((device) => ({
        device_key: device.deviceKey,
        name: device.name,
        aliases: parseAliasesJson(device.aliasesJson),
        type: device.type,
        commands: device.commands.map((command) => ({
          command_key: command.commandKey,
          label: command.label,
          aliases: parseAliasesJson(command.aliasesJson),
          method: command.method,
          path: command.path,
          args_schema_json: command.argsSchemaJson
        }))
      }))
    }))
  };
}

export async function validateLlmActions(actions, options = {}) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return { ok: false, reason: "no_actions" };
  }

  const action = actions[0];
  const targetKey = String(action.target_key || "");
  const deviceKey = String(action.device_key || "");
  const commandKey = String(action.command_key || "");
  const args = action.args && typeof action.args === "object" ? action.args : {};

  if (!targetKey || !deviceKey || !commandKey) {
    return { ok: false, reason: "missing_keys" };
  }

  let target = await resolveTargetFromAction({ targetKey });
  let device = null;

  if (target) {
    device = await resolveDeviceFromAction({
      targetId: target.id,
      deviceKey
    });
  }

  // If target key is wrong, infer target from device key/name when unique.
  if (!target || !device) {
    const inferred = await resolveByDeviceAcrossTargets({ deviceKey });

    if (inferred) {
      target = inferred.target;
      device = inferred.device;
    }
  }

  if (!target) {
    return { ok: false, reason: "target_not_found" };
  }

  if (!device) {
    return { ok: false, reason: "device_not_found" };
  }

  if (!rawTextExplicitlyMentionsDevice(options.rawText || "", device)) {
    return { ok: false, reason: "device_not_explicitly_requested" };
  }

  const command = await resolveCommandFromAction({
    deviceId: device.id,
    commandKey
  });

  if (!command) {
    return { ok: false, reason: "command_not_found" };
  }

  const normalizedArgs = enrichArgsFromNaturalLanguage({
    args,
    rawText: options.rawText || "",
    argsSchemaJson: command.argsSchemaJson
  });
  const argsValidation = validateArgsForCommand({
    args: normalizedArgs,
    argsSchemaJson: command.argsSchemaJson
  });

  if (!argsValidation.ok) {
    return { ok: false, reason: argsValidation.reason };
  }

  return {
    ok: true,
    action: {
      target,
      device,
      command,
      args: normalizedArgs
    }
  };
}

export async function hydrateValidatedAction({ targetId, deviceId, commandId, args }) {
  const command = await prisma.deviceCommand.findUnique({
    where: { id: commandId },
    include: {
      device: {
        include: {
          target: true
        }
      }
    }
  });

  if (!command || command.status !== "active") {
    return { ok: false, reason: "command_not_found" };
  }

  if (command.deviceId !== deviceId || command.device.targetId !== targetId) {
    return { ok: false, reason: "command_not_found" };
  }

  if (command.device.status !== "active") {
    return { ok: false, reason: "device_not_found" };
  }

  if (command.device.target.status !== "active") {
    return { ok: false, reason: "target_not_found" };
  }

  return {
    ok: true,
    action: {
      target: command.device.target,
      device: command.device,
      command,
      args: args && typeof args === "object" ? args : {}
    }
  };
}

export async function checkCommandCooldown(commandId) {
  const command = await prisma.deviceCommand.findUnique({
    where: { id: commandId },
    select: {
      id: true,
      cooldownSeconds: true
    }
  });

  if (!command) {
    return { ok: false, reason: "command_not_found" };
  }

  if (!command.cooldownSeconds || command.cooldownSeconds <= 0) {
    return { ok: true, remainingSeconds: 0 };
  }

  const latest = await prisma.commandExecution.findFirst({
    where: {
      commandId,
      status: "dispatch_success"
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (!latest) {
    return { ok: true, remainingSeconds: 0 };
  }

  const elapsedSeconds = Math.floor((Date.now() - latest.createdAt.getTime()) / 1000);
  const remainingSeconds = command.cooldownSeconds - elapsedSeconds;

  if (remainingSeconds > 0) {
    return { ok: false, reason: "command_on_cooldown", remainingSeconds };
  }

  return { ok: true, remainingSeconds: 0 };
}

async function resolveTargetFromAction({ targetKey }) {
  const normalized = normalizeKey(targetKey);

  let target = await prisma.target.findFirst({
    where: {
      targetKey,
      status: "active"
    }
  });

  if (target) {
    return target;
  }

  const activeTargets = await prisma.target.findMany({
    where: {
      status: "active"
    }
  });

  target = activeTargets.find(
    (item) =>
      normalizeKey(item.targetKey) === normalized ||
      normalizeKey(item.name) === normalized
  );

  if (target) {
    return target;
  }

  return null;
}

async function resolveDeviceFromAction({ targetId, deviceKey }) {
  const normalized = normalizeKey(deviceKey);

  let device = await prisma.device.findFirst({
    where: {
      deviceKey,
      targetId,
      status: "active"
    }
  });

  if (device) {
    return device;
  }

  const activeDevices = await prisma.device.findMany({
    where: {
      targetId,
      status: "active"
    }
  });

  device = activeDevices.find(
    (item) =>
      getDeviceMatchCandidates(item).some(
        (candidate) => normalizeKey(candidate) === normalized
      )
  );

  if (device) {
    return device;
  }

  return null;
}

async function resolveByDeviceAcrossTargets({ deviceKey }) {
  const normalized = normalizeKey(deviceKey);

  const activeDevices = await prisma.device.findMany({
    where: {
      status: "active",
      target: {
        status: "active"
      }
    },
    include: {
      target: true
    }
  });

  const matches = activeDevices.filter(
    (item) =>
      getDeviceMatchCandidates(item).some(
        (candidate) => normalizeKey(candidate) === normalized
      )
  );

  if (matches.length === 1) {
    return {
      target: matches[0].target,
      device: matches[0]
    };
  }

  return null;
}

async function resolveCommandFromAction({ deviceId, commandKey }) {
  const normalized = normalizeKey(commandKey);

  let command = await prisma.deviceCommand.findFirst({
    where: {
      deviceId,
      commandKey,
      status: "active"
    }
  });

  if (command) {
    return command;
  }

  const activeCommands = await prisma.deviceCommand.findMany({
    where: {
      deviceId,
      status: "active"
    }
  });

  command = activeCommands.find(
    (item) =>
      getCommandMatchCandidates(item).some(
        (candidate) => normalizeKey(candidate) === normalized
      )
  );

  return command || null;
}


function enrichArgsFromNaturalLanguage({ args, rawText, argsSchemaJson }) {
  const output = { ...args };

  if (!argsSchemaJson) {
    return output;
  }

  let schema;

  try {
    schema = JSON.parse(argsSchemaJson);
  } catch {
    return output;
  }

  const stateRules = schema?.properties?.state;
  const stateEnum = Array.isArray(stateRules?.enum) ? stateRules.enum : null;
  const hasStateEnum =
    stateEnum &&
    stateEnum.includes("ON") &&
    stateEnum.includes("OFF");

  if (!hasStateEnum || "state" in output) {
    return output;
  }

  const normalizedText = String(rawText || "").toLowerCase();
  const onHints = ["打開", "開啟", "开启", "開", "on", "turn on", "switch on"];
  const offHints = ["關閉", "关闭", "關", "off", "turn off", "switch off"];

  if (onHints.some((hint) => normalizedText.includes(hint.toLowerCase()))) {
    output.state = "ON";
    return output;
  }

  if (offHints.some((hint) => normalizedText.includes(hint.toLowerCase()))) {
    output.state = "OFF";
    return output;
  }

  return output;
}

export async function createTarget(formData) {
  const targetKey = String(formData.get("targetKey") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const baseUrl = String(formData.get("baseUrl") || "").trim();
  const authType = String(formData.get("authType") || "bearer").trim();
  const authSecret = String(formData.get("authSecret") || "").trim();
  const timeoutMs = Number(String(formData.get("timeoutMs") || "8000"));

  if (!targetKey || !name || !baseUrl) {
    throw new Error("targetKey, name, and baseUrl are required");
  }

  await prisma.$transaction(async (tx) => {
    let authSecretId = null;

    if (authSecret) {
      const secret = await tx.secret.create({
        data: {
          secretType: "target_auth_secret",
          name: `${targetKey}-auth-secret`,
          encryptedValue: encryptSecret(authSecret)
        }
      });

      authSecretId = secret.id;
    }

    await tx.target.create({
      data: {
        targetKey,
        name,
        baseUrl,
        authType,
        authSecretId,
        timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 8000,
        status: "active"
      }
    });
  });
}

export async function updateTarget(formData) {
  const targetId = String(formData.get("targetId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const baseUrl = String(formData.get("baseUrl") || "").trim();
  const authType = String(formData.get("authType") || "bearer").trim();
  const authSecret = String(formData.get("authSecret") || "").trim();
  const timeoutMs = Number(String(formData.get("timeoutMs") || "8000"));

  if (!targetId || !name || !baseUrl) {
    throw new Error("targetId, name, and baseUrl are required");
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.target.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        targetKey: true,
        authSecretId: true
      }
    });

    if (!existing) {
      throw new Error("Target not found");
    }

    let authSecretId = existing.authSecretId;

    if (authSecret) {
      if (existing.authSecretId) {
        await tx.secret.update({
          where: { id: existing.authSecretId },
          data: {
            encryptedValue: encryptSecret(authSecret),
            rotatedAt: new Date()
          }
        });
      } else {
        const secret = await tx.secret.create({
          data: {
            secretType: "target_auth_secret",
            name: `${existing.targetKey}-auth-secret`,
            encryptedValue: encryptSecret(authSecret)
          }
        });

        authSecretId = secret.id;
      }
    }

    await tx.target.update({
      where: { id: targetId },
      data: {
        name,
        baseUrl,
        authType,
        authSecretId,
        timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 8000
      }
    });
  });
}

export async function createDevice(formData) {
  const deviceKey = String(formData.get("deviceKey") || "").trim();
  const targetId = String(formData.get("targetId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const aliasesJson = parseJsonArrayInput(String(formData.get("aliasesJson") || ""));
  const type = String(formData.get("type") || "").trim();
  const description = String(formData.get("description") || "").trim();

  if (!deviceKey || !targetId || !name || !type) {
    throw new Error("deviceKey, targetId, name, and type are required");
  }

  await prisma.device.create({
    data: {
      deviceKey,
      targetId,
      name,
      aliasesJson,
      type,
      description: description || null,
      status: "active"
    }
  });
}

export async function updateDevice(formData) {
  const deviceId = String(formData.get("deviceId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const aliasesJson = parseJsonArrayInput(String(formData.get("aliasesJson") || ""));
  const type = String(formData.get("type") || "").trim();
  const description = String(formData.get("description") || "").trim();

  if (!deviceId || !name || !type) {
    throw new Error("deviceId, name, and type are required");
  }

  await prisma.device.update({
    where: { id: deviceId },
    data: {
      name,
      aliasesJson,
      type,
      description: description || null
    }
  });
}

export async function createDeviceCommand(formData) {
  const deviceId = String(formData.get("deviceId") || "").trim();
  const commandKey = String(formData.get("commandKey") || "").trim();
  const aliasesJson = parseJsonArrayInput(String(formData.get("aliasesJson") || ""));
  const label = String(formData.get("label") || "").trim();
  const method = String(formData.get("method") || "POST").trim().toUpperCase();
  const path = String(formData.get("path") || "").trim();
  const cooldownSeconds = Number(String(formData.get("cooldownSeconds") || "0"));
  const payloadTemplateJson = parseJsonInput(
    String(formData.get("payloadTemplateJson") || "")
  );
  const argsSchemaJson = parseJsonInput(String(formData.get("argsSchemaJson") || ""));
  const confirmationRequired = formData.get("confirmationRequired") === "on";

  if (!deviceId || !commandKey || !label || !method || !path) {
    throw new Error("deviceId, commandKey, label, method, and path are required");
  }

  await prisma.deviceCommand.create({
    data: {
      deviceId,
      commandKey,
      aliasesJson,
      label,
      method,
      path,
      cooldownSeconds: Number.isFinite(cooldownSeconds) ? cooldownSeconds : 0,
      payloadTemplateJson,
      argsSchemaJson,
      confirmationRequired,
      status: "active"
    }
  });
}

export async function updateDeviceCommand(formData) {
  const commandId = String(formData.get("commandId") || "").trim();
  const aliasesJson = parseJsonArrayInput(String(formData.get("aliasesJson") || ""));
  const label = String(formData.get("label") || "").trim();
  const method = String(formData.get("method") || "POST").trim().toUpperCase();
  const path = String(formData.get("path") || "").trim();
  const cooldownSeconds = Number(String(formData.get("cooldownSeconds") || "0"));
  const payloadTemplateJson = parseJsonInput(
    String(formData.get("payloadTemplateJson") || "")
  );
  const argsSchemaJson = parseJsonInput(String(formData.get("argsSchemaJson") || ""));
  const confirmationRequired = formData.get("confirmationRequired") === "on";

  if (!commandId || !label || !method || !path) {
    throw new Error("commandId, label, method, and path are required");
  }

  await prisma.deviceCommand.update({
    where: { id: commandId },
    data: {
      aliasesJson,
      label,
      method,
      path,
      cooldownSeconds: Number.isFinite(cooldownSeconds) ? cooldownSeconds : 0,
      payloadTemplateJson,
      argsSchemaJson,
      confirmationRequired
    }
  });
}

export async function dryRunCommand(formData) {
  const commandId = String(formData.get("commandId") || "").trim();
  const argsText = String(formData.get("argsJson") || "").trim();

  if (!commandId) {
    throw new Error("commandId is required");
  }

  let args = {};

  if (argsText) {
    try {
      const parsed = JSON.parse(argsText);

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Args JSON must be an object");
      }

      args = parsed;
    } catch (error) {
      if (error instanceof Error && error.message === "Args JSON must be an object") {
        throw error;
      }

      throw new Error("Args JSON is invalid");
    }
  }

  const command = await prisma.deviceCommand.findUnique({
    where: { id: commandId },
    include: {
      device: {
        include: {
          target: true
        }
      }
    }
  });

  if (!command) {
    throw new Error("Command not found");
  }

  const argsValidation = validateArgsForCommand({
    args,
    argsSchemaJson: command.argsSchemaJson
  });

  if (!argsValidation.ok) {
    throw new Error(argsValidation.reason);
  }

  const rendered = await renderValidatedAction({
    target: command.device.target,
    device: command.device,
    command,
    args
  });

  return {
    ok: true,
    targetKey: command.device.target.targetKey,
    deviceKey: command.device.deviceKey,
    commandKey: command.commandKey,
    timeoutMs: rendered.timeoutMs,
    request: rendered.request
  };
}

export async function toggleTargetStatus(targetId) {
  const target = await prisma.target.findUnique({
    where: { id: targetId },
    select: { id: true, status: true }
  });

  if (!target) {
    throw new Error("Target not found");
  }

  await prisma.target.update({
    where: { id: targetId },
    data: {
      status: target.status === "active" ? "inactive" : "active"
    }
  });
}

export async function toggleDeviceStatus(deviceId) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { id: true, status: true }
  });

  if (!device) {
    throw new Error("Device not found");
  }

  await prisma.device.update({
    where: { id: deviceId },
    data: {
      status: device.status === "active" ? "inactive" : "active"
    }
  });
}

export async function toggleCommandStatus(commandId) {
  const command = await prisma.deviceCommand.findUnique({
    where: { id: commandId },
    select: { id: true, status: true }
  });

  if (!command) {
    throw new Error("Command not found");
  }

  await prisma.deviceCommand.update({
    where: { id: commandId },
    data: {
      status: command.status === "active" ? "inactive" : "active"
    }
  });
}

export async function deleteTarget(targetId) {
  await prisma.$transaction(async (tx) => {
    const target = await tx.target.findUnique({
      where: { id: targetId },
      select: { authSecretId: true }
    });

    await tx.target.delete({
      where: { id: targetId }
    });

    if (target?.authSecretId) {
      await tx.secret.delete({
        where: { id: target.authSecretId }
      });
    }
  });
}

export async function deleteDevice(deviceId) {
  await prisma.device.delete({
    where: { id: deviceId }
  });
}

export async function deleteCommand(commandId) {
  await prisma.deviceCommand.delete({
    where: { id: commandId }
  });
}

export async function testTargetConnection(targetId) {
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
    throw new Error("Target not found");
  }

  const secret = target.authSecret?.encryptedValue
    ? decryptSecret(target.authSecret.encryptedValue)
    : null;
  const baseUrl = target.baseUrl.endsWith("/") ? target.baseUrl : `${target.baseUrl}/`;
  const endpointCandidates = [
    new URL("health", baseUrl).toString(),
    target.baseUrl
  ];
  let lastError = "Target endpoint is unreachable";

  for (const endpoint of endpointCandidates) {
    try {
      const headers = {};
      const url = new URL(endpoint);

      if (secret && target.authType === "bearer") {
        headers.Authorization = `Bearer ${secret}`;
      } else if (secret && target.authType === "header") {
        headers["X-Target-Secret"] = secret;
      } else if (secret && target.authType === "query") {
        url.searchParams.set("token", secret);
      } else if (secret && target.authType === "hmac") {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const pathWithQuery = `${url.pathname}${url.search}`;
        const signature = createHmac("sha256", secret)
          .update(`${timestamp}.GET.${pathWithQuery}.`)
          .digest("hex");
        headers["X-Target-Timestamp"] = timestamp;
        headers["X-Target-Signature"] = `sha256=${signature}`;
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers
      });
      const body = await response.text();

      return {
        ok: response.ok,
        reachable: true,
        endpoint: url.toString(),
        status: response.status,
        message: response.ok
          ? `Connected successfully at ${url.toString()}`
          : `Target responded with HTTP ${response.status}`,
        bodyPreview: body.slice(0, 300)
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Target request failed";
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
