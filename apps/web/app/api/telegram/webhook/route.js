import { NextResponse } from "next/server";
import {
  createTraceId,
  logError,
  logInfo,
  logMemorySnapshot,
  logWarn,
  requestLogMeta,
  summarizeText
} from "@/lib/logger";
import {
  createPendingTelegramAction,
  createTelegramAuditLog,
  findTelegramAccount,
  findPendingTelegramAction,
  recordCommandExecution,
  recordTelegramUpdate,
  sendTelegramMessage,
  updatePendingTelegramActionStatus,
  verifyTelegramWebhookRequest
} from "@/lib/telegram";
import {
  buildLlmRegistryContext,
  checkCommandCooldown,
  hydrateValidatedAction,
  validateLlmActions
} from "@/lib/registry";
import { getActiveProvider, parseCommandWithLlm } from "@/lib/llm";
import { dispatchValidatedAction } from "@/lib/dispatcher";
import { parsePendingActionCommand } from "@/lib/telegram-utils.mjs";

function extractMessage(update) {
  return update.message || update.edited_message || update.channel_post || null;
}

function classifyParseError(error) {
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "provider_http_error" || error.code === "provider_request_failed") {
      return {
        status: "provider_http_error",
        message: "LLM provider 回傳異常 HTTP 狀態。請檢查 provider URL、model 與上游服務。",
        hint: "確認 /admin/providers 的 Base URL、Model 與 provider 服務狀態。"
      };
    }

    if (error.code === "provider_timeout") {
      return {
        status: "provider_timeout",
        message: "LLM provider 回應逾時。",
        hint: "確認 provider 是否過載，或先改用較快的模型。"
      };
    }

    if (error.code === "provider_network_error") {
      return {
        status: "provider_network_error",
        message: "無法連線到 LLM provider。",
        hint: "確認 provider Base URL、DNS、網路出口與本機 mock 服務是否已啟動。"
      };
    }

    if (error.code === "provider_response_invalid") {
      return {
        status: "provider_response_invalid",
        message: "LLM provider 輸出不是有效 JSON。",
        hint: "可調整 provider 的 JSON strictness 或改用更穩定的模型。"
      };
    }
  }

  return {
    status: "parse_failed",
    message: "命令解析失敗。請檢查 provider 設定與 server logs。",
    hint: "確認 LLM prompt、provider 連線與回傳格式。"
  };
}

function buildReasonPayload(reasonCode, message) {
  return { reasonCode, message };
}

function classifyValidationReason(reason) {
  if (!reason) {
    return buildReasonPayload("device_not_found", "找不到指定的裝置。");
  }

  if (
    reason === "target_not_found" ||
    reason === "device_not_found" ||
    reason === "device_not_explicitly_requested" ||
    reason === "missing_keys" ||
    reason === "no_actions"
  ) {
    return buildReasonPayload(reason, "找不到指定的裝置。");
  }

  if (reason === "command_not_found") {
    return buildReasonPayload(reason, "找不到指定的裝置命令。");
  }

  if (reason.startsWith("missing_required_arg:")) {
    const argName = reason.split(":")[1] || "unknown";
    return buildReasonPayload(reason, `缺少必要參數：${argName}。`);
  }

  if (reason.startsWith("arg_type_invalid:")) {
    const argName = reason.split(":")[1] || "unknown";
    return buildReasonPayload(reason, `參數型別不正確：${argName}。`);
  }

  if (reason.startsWith("arg_enum_invalid:")) {
    const argName = reason.split(":")[1] || "unknown";
    return buildReasonPayload(reason, `參數值不允許：${argName}。`);
  }

  if (reason.startsWith("arg_pattern_invalid:")) {
    const argName = reason.split(":")[1] || "unknown";
    return buildReasonPayload(reason, `參數格式不正確：${argName}。`);
  }

  if (reason.startsWith("arg_minimum_invalid:")) {
    const argName = reason.split(":")[1] || "unknown";
    return buildReasonPayload(reason, `參數值過小：${argName}。`);
  }

  if (reason.startsWith("arg_maximum_invalid:")) {
    const argName = reason.split(":")[1] || "unknown";
    return buildReasonPayload(reason, `參數值過大：${argName}。`);
  }

  return buildReasonPayload(reason, `Parsed command is not allowed: ${reason}`);
}

function classifyDispatchFailure(dispatchResult) {
  if (dispatchResult.errorType === "network_timeout") {
    return {
      reasonCode: "dispatch_network_timeout",
      message: "目標設備逾時未回應。",
      hint: "確認 target 服務是否在線，或適度提高 timeout。"
    };
  }

  if (dispatchResult.errorType === "network_error") {
    return {
      reasonCode: "dispatch_network_error",
      message: "目標設備無法連線。",
      hint: "確認 target Base URL、網路可達性與本機 mock target 是否已啟動。"
    };
  }

  if (dispatchResult.errorType === "http_error") {
    if (dispatchResult.status === 401 || dispatchResult.status === 403) {
      return {
        reasonCode: "target_auth_failed",
        message: `目標設備拒絕授權（HTTP ${dispatchResult.status}）。`,
        hint: "確認 target auth type、secret 與設備端驗證設定。"
      };
    }

    return {
      reasonCode: "dispatch_http_error",
      message: `目標設備回傳 HTTP ${dispatchResult.status}。`,
      hint: "請檢查 target 服務 logs 與命令 path / payload。"
    };
  }

  if (dispatchResult.errorType === "target_business_error") {
    return {
      reasonCode: "target_business_error",
      message: "目標設備已收到命令，但業務邏輯拒絕執行。",
      hint: "請檢查 target 回傳的 error/message 與設備狀態條件。"
    };
  }

  return {
    reasonCode: "dispatch_failed",
    message: "命令已解析，但設備執行失敗。",
    hint: "請檢查 audit request/response 與 target logs。"
  };
}

function buildTelegramReply({ title, reasonCode, message, hint, details = [] }) {
  return [
    title,
    `Reason code: ${reasonCode}`,
    message,
    ...details.filter(Boolean),
    hint ? `Hint: ${hint}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

function buildCooldownReason(remainingSeconds) {
  return buildReasonPayload(
    "command_on_cooldown",
    `命令冷卻中，請在 ${remainingSeconds} 秒後再試。`
  );
}

function buildConfirmationReason(action, token) {
  return buildReasonPayload(
    "confirmation_required",
    [
      "此命令需要確認。",
      `Target: ${action.target.targetKey}`,
      `Device: ${action.device.deviceKey}`,
      `Command: ${action.command.commandKey}`,
      `請在 10 分鐘內回覆: confirm ${token}`,
      `若要取消，請回覆: cancel ${token}`
    ].join("\n")
  );
}

function buildDispatchFailureMessage(dispatchResult, action, reasonPayload) {
  const lines = [
    "Command parsed but dispatch failed.",
    `Reason code: ${reasonPayload.reasonCode}`,
    `Reason: ${reasonPayload.message}`,
    `Target: ${action.target.targetKey}`,
    `Device: ${action.device.deviceKey}`,
    `Command: ${action.command.commandKey}`
  ];

  if (dispatchResult.errorMessage) {
    lines.push(`Detail: ${dispatchResult.errorMessage}`);
  }

  if (dispatchResult.responseText) {
    lines.push(`Response: ${dispatchResult.responseText.slice(0, 300)}`);
  }

  if (reasonPayload.hint) {
    lines.push(`Hint: ${reasonPayload.hint}`);
  }

  return lines.join("\n");
}

function buildWebhookResponse(overrides = {}) {
  return {
    ok: true,
    authorized: true,
    stage: "received",
    intent: null,
    parsed: false,
    validated: false,
    dispatched: false,
    status: "ok",
    reasonCode: null,
    message: null,
    ...overrides
  };
}

async function dispatchActionFlow({
  traceId,
  requestStartedAt,
  telegramUserId,
  chatId,
  text,
  providerId,
  parsed,
  intent,
  action,
  pendingActionId
}) {
  const dispatchResult = await dispatchValidatedAction(action, { traceId });
  const dispatchReason = dispatchResult.ok
    ? buildReasonPayload("dispatch_success", "Command dispatched successfully.")
    : classifyDispatchFailure(dispatchResult);

  logInfo(dispatchResult.ok ? "telegram_dispatch_success" : "telegram_dispatch_failed", {
    traceId,
    durationMs: requestStartedAt ? Date.now() - requestStartedAt : null,
    telegramUserId,
    providerId: providerId || null,
    targetKey: action.target.targetKey,
    deviceKey: action.device.deviceKey,
    commandKey: action.command.commandKey,
    args: action.args,
    dispatch: {
      ok: dispatchResult.ok,
      status: dispatchResult.status,
      errorType: dispatchResult.errorType,
      errorMessage: dispatchResult.errorMessage
    }
  });

  logMemorySnapshot("telegram_dispatch_memory", {
    traceId,
    telegramUserId,
    providerId: providerId || null,
    targetKey: action.target.targetKey,
    deviceKey: action.device.deviceKey,
    commandKey: action.command.commandKey,
    dispatchOk: dispatchResult.ok
  });

  await createTelegramAuditLog({
    telegramUserId,
    text,
    status: dispatchResult.ok
      ? "dispatch_success"
      : dispatchResult.errorType || "dispatch_failed",
    errorMessage: dispatchResult.ok ? null : dispatchResult.errorMessage,
    providerId: providerId || null,
    parsedResult: {
      parsed,
      dispatchResult: {
        ok: dispatchResult.ok,
        status: dispatchResult.status,
        errorType: dispatchResult.errorType,
        errorMessage: dispatchResult.errorMessage,
        request: dispatchResult.request,
        responseText: dispatchResult.responseText
      }
    }
  });

  await recordCommandExecution({
    commandId: action.command.id,
    actorId: telegramUserId,
    status: dispatchResult.ok ? "dispatch_success" : "dispatch_failed",
    reasonCode: dispatchReason.reasonCode
  });

  if (pendingActionId && dispatchResult.ok) {
    await updatePendingTelegramActionStatus(pendingActionId, "executed", "executedAt");
  }

  const responseText = dispatchResult.ok
    ? buildTelegramReply({
        title: "Command dispatched successfully.",
        reasonCode: dispatchReason.reasonCode,
        message: dispatchReason.message,
        details: [
          `Target: ${action.target.targetKey}`,
          `Device: ${action.device.deviceKey}`,
          `Command: ${action.command.commandKey}`,
          `Status: ${dispatchResult.status}`,
          `Args: ${JSON.stringify(action.args)}`
        ]
      })
    : buildDispatchFailureMessage(dispatchResult, action, dispatchReason);

  await sendTelegramMessage({
    chatId,
    text: responseText
  });

  return NextResponse.json(
    buildWebhookResponse({
      stage: "dispatch",
      intent,
      parsed: true,
      validated: true,
      dispatched: dispatchResult.ok,
      status: dispatchResult.ok ? "dispatch_success" : dispatchResult.errorType || "dispatch_failed",
      validationReason: null,
      reasonCode: dispatchReason.reasonCode,
      message: dispatchReason.message,
      targetKey: action.target.targetKey,
      deviceKey: action.device.deviceKey,
      commandKey: action.command.commandKey,
      args: action.args,
      dispatch: {
        ok: dispatchResult.ok,
        status: dispatchResult.status,
        errorType: dispatchResult.errorType,
        errorMessage: dispatchResult.errorMessage
      }
    })
  );
}

export async function POST(request) {
  const traceId = createTraceId("tg");
  const startedAt = Date.now();

  logInfo("telegram_webhook_received", {
    traceId,
    ...requestLogMeta(request)
  });

  logMemorySnapshot("telegram_webhook_memory_start", {
    traceId
  });

  if (!verifyTelegramWebhookRequest(request)) {
    logWarn("telegram_webhook_unauthorized", {
      traceId,
      ...requestLogMeta(request)
    });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let update;

  try {
    update = await request.json();
  } catch {
    logWarn("telegram_webhook_invalid_json", {
      traceId
    });
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const message = extractMessage(update);

  if (!message?.from?.id || !message?.chat?.id) {
    logInfo("telegram_webhook_ignored_missing_message", {
      traceId,
      updateId: update?.update_id || null
    });
    return NextResponse.json({
      ok: true,
      ignored: true,
      stage: "ignored"
    });
  }

  const telegramUserId = String(message.from.id);
  const text = typeof message.text === "string" ? message.text : "[non-text message]";

  logInfo("telegram_message_extracted", {
    traceId,
    updateId: update?.update_id || null,
    telegramUserId,
    chatId: String(message.chat.id),
    textPreview: summarizeText(text, 160)
  });

  const dedupe = await recordTelegramUpdate({
    updateId: update.update_id,
    telegramUserId,
    messageText: text
  });

  if (dedupe.duplicate) {
    logInfo("telegram_update_duplicate", {
      traceId,
      updateId: update?.update_id || null,
      telegramUserId
    });
    await createTelegramAuditLog({
      telegramUserId,
      text,
      status: "duplicate_update_ignored",
      errorMessage: `duplicate update_id ${String(update.update_id)}`
    });

    return NextResponse.json(
      buildWebhookResponse({
        stage: "authorization",
        status: "duplicate_update_ignored",
        reasonCode: "duplicate_update_ignored",
        message: "Duplicate Telegram update ignored.",
        deduplicated: true
      })
    );
  }

  const account = await findTelegramAccount(telegramUserId);

  if (!account || account.status !== "active") {
    logWarn("telegram_account_not_allowlisted", {
      traceId,
      telegramUserId,
      accountStatus: account?.status || null
    });
    await createTelegramAuditLog({
      telegramUserId,
      text,
      status: "rejected",
      errorMessage: "telegram account not allowlisted"
    });

    try {
      await sendTelegramMessage({
        chatId: message.chat.id,
        text: "This Telegram account is not allowed to use this bot."
      });
    } catch (error) {
      logError("telegram_unauthorized_reply_failed", {
        traceId,
        telegramUserId,
        error
      });
    }

    return NextResponse.json({
      ok: true,
      authorized: false,
      stage: "authorization",
      status: "rejected",
      reasonCode: "telegram_not_allowlisted",
      message: "This Telegram account is not allowed to use this bot."
    });
  }

  await createTelegramAuditLog({
    telegramUserId,
    text,
    status: "received",
    errorMessage: null
  });

  if (typeof message.text !== "string" || !message.text.trim()) {
    logInfo("telegram_non_text_ignored", {
      traceId,
      telegramUserId,
      chatId: String(message.chat.id)
    });
    await sendTelegramMessage({
      chatId: message.chat.id,
      text: "Only text messages are supported in the current MVP."
    });

    return NextResponse.json(
      buildWebhookResponse({
        stage: "validation",
        status: "ignored_non_text",
        reasonCode: "ignored_non_text",
        message: "Only text messages are supported in the current MVP."
      })
    );
  }

  const pendingActionCommand = parsePendingActionCommand(message.text);

  if (pendingActionCommand) {
    logInfo("telegram_pending_command_received", {
      traceId,
      telegramUserId,
      verb: pendingActionCommand.verb
    });
    const pending = await findPendingTelegramAction({
      token: pendingActionCommand.token,
      telegramUserId
    });

    if (!pending) {
      logWarn("telegram_pending_action_not_found", {
        traceId,
        telegramUserId,
        verb: pendingActionCommand.verb
      });
      const reason = buildReasonPayload("pending_action_not_found", "找不到待確認命令。");
      await sendTelegramMessage({
        chatId: message.chat.id,
        text: `Reason code: ${reason.reasonCode}\n${reason.message}`
      });

      return NextResponse.json(
        buildWebhookResponse({
          stage: "confirmation",
          status: "pending_action_not_found",
          reasonCode: reason.reasonCode,
          message: reason.message
        })
      );
    }

    if (pending.status !== "pending") {
      logInfo("telegram_pending_action_not_pending", {
        traceId,
        telegramUserId,
        pendingActionId: pending.id,
        pendingStatus: pending.status
      });
      const reason = buildReasonPayload("pending_action_not_pending", "這筆待確認命令已經處理過。");
      await sendTelegramMessage({
        chatId: message.chat.id,
        text: `Reason code: ${reason.reasonCode}\n${reason.message}`
      });

      return NextResponse.json(
        buildWebhookResponse({
          stage: "confirmation",
          status: "pending_action_not_pending",
          reasonCode: reason.reasonCode,
          message: reason.message
        })
      );
    }

    if (pending.expiresAt.getTime() <= Date.now()) {
      await updatePendingTelegramActionStatus(pending.id, "expired", null);
      logInfo("telegram_pending_action_expired", {
        traceId,
        telegramUserId,
        pendingActionId: pending.id
      });
      const reason = buildReasonPayload("pending_action_expired", "待確認命令已過期。");
      await sendTelegramMessage({
        chatId: message.chat.id,
        text: `Reason code: ${reason.reasonCode}\n${reason.message}`
      });

      return NextResponse.json(
        buildWebhookResponse({
          stage: "confirmation",
          status: "pending_action_expired",
          reasonCode: reason.reasonCode,
          message: reason.message
        })
      );
    }

    if (pendingActionCommand.verb === "cancel") {
      await updatePendingTelegramActionStatus(pending.id, "cancelled", "cancelledAt");
      logInfo("telegram_confirmation_cancelled", {
        traceId,
        telegramUserId,
        pendingActionId: pending.id
      });
      const reason = buildReasonPayload("confirmation_cancelled", "待確認命令已取消。");
      await sendTelegramMessage({
        chatId: message.chat.id,
        text: `Reason code: ${reason.reasonCode}\n${reason.message}`
      });

      return NextResponse.json(
        buildWebhookResponse({
          stage: "confirmation",
          status: "confirmation_cancelled",
          reasonCode: reason.reasonCode,
          message: reason.message
        })
      );
    }

    const storedAction = JSON.parse(pending.actionJson);
    const hydrated = await hydrateValidatedAction(storedAction);

    if (!hydrated.ok) {
      logWarn("telegram_confirmation_invalid", {
        traceId,
        telegramUserId,
        pendingActionId: pending.id,
        validationReason: hydrated.reason
      });
      const reason = classifyValidationReason(hydrated.reason);
      await sendTelegramMessage({
        chatId: message.chat.id,
        text: `Reason code: ${reason.reasonCode}\n${reason.message}`
      });

      return NextResponse.json(
        buildWebhookResponse({
          stage: "confirmation",
          status: "confirmation_invalid",
          reasonCode: reason.reasonCode,
          message: reason.message
        })
      );
    }

    const cooldown = await checkCommandCooldown(hydrated.action.command.id);

    if (!cooldown.ok) {
      logInfo("telegram_confirmation_command_on_cooldown", {
        traceId,
        telegramUserId,
        pendingActionId: pending.id,
        remainingSeconds: cooldown.remainingSeconds || 0
      });
      const reason = buildCooldownReason(cooldown.remainingSeconds || 0);
      await sendTelegramMessage({
        chatId: message.chat.id,
        text: `Reason code: ${reason.reasonCode}\n${reason.message}`
      });

      return NextResponse.json(
        buildWebhookResponse({
          stage: "dispatch",
          intent: "device_control",
          parsed: true,
          validated: true,
          dispatched: false,
          status: "command_on_cooldown",
          reasonCode: reason.reasonCode,
          message: reason.message
        })
      );
    }

    await updatePendingTelegramActionStatus(pending.id, "confirmed", "confirmedAt");
    logInfo("telegram_confirmation_confirmed", {
      traceId,
      telegramUserId,
      pendingActionId: pending.id
    });

    return dispatchActionFlow({
      traceId,
      requestStartedAt: startedAt,
      telegramUserId,
      chatId: message.chat.id,
      text,
      providerId: pending.providerId,
      parsed: { intent: "device_control", actions: [storedAction], confirmationToken: pending.token },
      intent: "device_control",
      action: hydrated.action,
      pendingActionId: pending.id
    });
  }

  let provider = null;

  try {
    provider = await getActiveProvider();

    if (!provider) {
      logWarn("telegram_provider_missing", {
        traceId,
        telegramUserId
      });
      await createTelegramAuditLog({
        telegramUserId,
        text,
        status: "provider_missing",
        errorMessage: "No active provider is configured"
      });

      await sendTelegramMessage({
        chatId: message.chat.id,
        text: "No active LLM provider is configured yet. Please set one in /admin/providers."
      });

      return NextResponse.json(
        buildWebhookResponse({
          stage: "provider",
          status: "provider_missing",
          reasonCode: "provider_missing",
          message: "No active LLM provider is configured yet. Please set one in /admin/providers."
        })
      );
    }
  } catch (error) {
    logError("telegram_provider_resolution_failed", {
      traceId,
      telegramUserId,
      error
    });

    await createTelegramAuditLog({
      telegramUserId,
      text,
      status: "provider_load_failed",
      errorMessage: error instanceof Error ? error.message : "provider load failed"
    });

    await sendTelegramMessage({
      chatId: message.chat.id,
      text: "Provider configuration failed to load. Check secrets and server environment."
    });

    return NextResponse.json(
      buildWebhookResponse({
        stage: "provider",
        status: "provider_load_failed",
        reasonCode: "provider_load_failed",
        message: "Provider configuration failed to load. Check secrets and server environment."
      })
    );
  }

  let parsed;

  try {
    const context = await buildLlmRegistryContext();
    parsed = await parseCommandWithLlm({
      provider,
      message: message.text,
      context,
      traceId
    });
  } catch (error) {
    logError("telegram_parse_flow_failed", {
      traceId,
      telegramUserId,
      providerKey: provider.providerKey,
      error
    });
    const parseFailure = classifyParseError(error);

    await createTelegramAuditLog({
      telegramUserId,
      text,
      status: parseFailure.status,
      errorMessage: error instanceof Error ? error.message : parseFailure.message,
      providerId: provider.id
    });

    try {
      await sendTelegramMessage({
        chatId: message.chat.id,
        text: buildTelegramReply({
          title: "Command parsing failed.",
          reasonCode: parseFailure.status,
          message: parseFailure.message,
          hint: parseFailure.hint
        })
      });
    } catch (replyError) {
      logError("telegram_error_reply_failed", {
        traceId,
        telegramUserId,
        error: replyError
      });
    }

    return NextResponse.json(
      buildWebhookResponse({
        stage: "parse",
        status: parseFailure.status,
        reasonCode: parseFailure.status,
        message: parseFailure.message
      })
    );
  }

  const intent = String(parsed.intent || "reject");

  logInfo("telegram_parse_completed", {
    traceId,
    telegramUserId,
    providerKey: provider.providerKey,
    intent,
    actionsCount: Array.isArray(parsed.actions) ? parsed.actions.length : 0,
    durationMs: Date.now() - startedAt
  });

  if (intent !== "device_control") {
    const responseText = String(
      parsed.response_text || "I cannot map this request to a safe device command."
    );

    logInfo("telegram_non_control_result", {
      traceId,
      telegramUserId,
      providerKey: provider.providerKey,
      intent,
      responsePreview: summarizeText(responseText, 200)
    });

    await createTelegramAuditLog({
      telegramUserId,
      text,
      status: "parsed_non_control",
      errorMessage: null,
      providerId: provider.id,
      parsedResult: parsed
    });

    await sendTelegramMessage({
      chatId: message.chat.id,
      text: buildTelegramReply({
        title: "No safe device action was selected.",
        reasonCode: "parsed_non_control",
        message: responseText,
        hint: "請直接描述裝置名稱與動作，例如：把燈打開。"
      })
    });

    return NextResponse.json(
      buildWebhookResponse({
        stage: "parse",
        intent,
        parsed: true,
        status: "parsed_non_control",
        reasonCode: "parsed_non_control",
        message: responseText
      })
    );
  }

  const validation = await validateLlmActions(parsed.actions, {
    rawText: message.text
  });

  if (!validation.ok) {
    logWarn("telegram_validation_failed", {
      traceId,
      telegramUserId,
      providerKey: provider.providerKey,
      validationReason: validation.reason,
      parsedIntent: intent
    });
    const validationReason = classifyValidationReason(validation.reason);

    await createTelegramAuditLog({
      telegramUserId,
      text,
      status: "validation_failed",
      errorMessage: validation.reason,
      providerId: provider.id,
      parsedResult: parsed
    });

    await sendTelegramMessage({
      chatId: message.chat.id,
      text: buildTelegramReply({
        title: "Command validation failed.",
        reasonCode: validationReason.reasonCode,
        message: validationReason.message,
        hint: "請明確描述已註冊的裝置名稱或 alias。"
      })
    });

    return NextResponse.json(
      buildWebhookResponse({
        stage: "validation",
        intent,
        parsed: true,
        validated: false,
        status: "validation_failed",
        validationReason: validation.reason,
        reasonCode: validationReason.reasonCode,
        message: validationReason.message
      })
    );
  }

  const { target, device, command, args } = validation.action;

  logInfo("telegram_validation_succeeded", {
    traceId,
    telegramUserId,
    providerKey: provider.providerKey,
    targetKey: target.targetKey,
    deviceKey: device.deviceKey,
    commandKey: command.commandKey,
    args
  });

  const cooldown = await checkCommandCooldown(command.id);

  if (!cooldown.ok) {
    logInfo("telegram_command_on_cooldown", {
      traceId,
      telegramUserId,
      commandKey: command.commandKey,
      remainingSeconds: cooldown.remainingSeconds || 0
    });
    const reason = buildCooldownReason(cooldown.remainingSeconds || 0);

    await createTelegramAuditLog({
      telegramUserId,
      text,
      status: "command_on_cooldown",
      errorMessage: reason.message,
      providerId: provider.id,
      parsedResult: parsed
    });

    await sendTelegramMessage({
      chatId: message.chat.id,
      text: buildTelegramReply({
        title: "Command is cooling down.",
        reasonCode: reason.reasonCode,
        message: reason.message,
        hint: "稍後再試，或調整 command cooldownSeconds。"
      })
    });

    return NextResponse.json(
      buildWebhookResponse({
        stage: "dispatch",
        intent,
        parsed: true,
        validated: true,
        dispatched: false,
        status: "command_on_cooldown",
        reasonCode: reason.reasonCode,
        message: reason.message
      })
    );
  }

  await createTelegramAuditLog({
    telegramUserId,
    text,
    status: "parsed_valid",
    errorMessage: null,
    providerId: provider.id,
    parsedResult: parsed
  });

  if (command.confirmationRequired) {
    logInfo("telegram_confirmation_required", {
      traceId,
      telegramUserId,
      providerKey: provider.providerKey,
      targetKey: target.targetKey,
      deviceKey: device.deviceKey,
      commandKey: command.commandKey
    });
    const pending = await createPendingTelegramAction({
      telegramUserId,
      chatId: message.chat.id,
      commandId: command.id,
      providerId: provider.id,
      rawInput: text,
      action: {
        targetId: target.id,
        deviceId: device.id,
        commandId: command.id,
        args
      }
    });
    const reason = buildConfirmationReason(validation.action, pending.token);

    await sendTelegramMessage({
      chatId: message.chat.id,
      text: buildTelegramReply({
        title: "Confirmation required.",
        reasonCode: reason.reasonCode,
        message: reason.message,
        hint: "若不確定，先回 cancel TOKEN。"
      })
    });

    return NextResponse.json(
      buildWebhookResponse({
        stage: "confirmation",
        intent,
        parsed: true,
        validated: true,
        dispatched: false,
        status: "confirmation_pending",
        reasonCode: reason.reasonCode,
        message: reason.message,
        pendingToken: pending.token
      })
    );
  }

  return dispatchActionFlow({
    traceId,
    requestStartedAt: startedAt,
    telegramUserId,
    chatId: message.chat.id,
    text,
    providerId: provider.id,
    parsed,
    intent,
    action: validation.action
  });
}
