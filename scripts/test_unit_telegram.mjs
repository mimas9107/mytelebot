import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePendingActionCommand,
  verifyTelegramWebhookHeaders
} from "../apps/web/lib/telegram-utils.mjs";

test("parsePendingActionCommand recognizes confirm and cancel tokens", () => {
  assert.deepEqual(parsePendingActionCommand("confirm 28A49D"), {
    verb: "confirm",
    token: "28A49D"
  });

  assert.deepEqual(parsePendingActionCommand("cancel token-123"), {
    verb: "cancel",
    token: "TOKEN-123"
  });

  assert.equal(parsePendingActionCommand("open light_01"), null);
});

test("verifyTelegramWebhookHeaders enforces secret only when configured", () => {
  assert.equal(verifyTelegramWebhookHeaders("", "anything"), true);
  assert.equal(verifyTelegramWebhookHeaders("secret", "secret"), true);
  assert.equal(verifyTelegramWebhookHeaders("secret", "other"), false);
});
