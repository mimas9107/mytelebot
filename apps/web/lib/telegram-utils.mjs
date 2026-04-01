export function parsePendingActionCommand(text) {
  const match = String(text || "").trim().match(/^(confirm|cancel)\s+([A-Za-z0-9_-]+)$/i);

  if (!match) {
    return null;
  }

  return {
    verb: match[1].toLowerCase(),
    token: match[2].toUpperCase()
  };
}

export function verifyTelegramWebhookHeaders(expectedSecret, headerSecret) {
  if (!expectedSecret) {
    return true;
  }

  return headerSecret === expectedSecret;
}
