import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Webhook signing + retry schedule — pure.
 *
 * Signature header:  X-SafeFlow-Signature: sha256=<hex>
 *   hex = HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
 * The timestamp (X-SafeFlow-Timestamp, unix seconds) is part of the signed
 * string so receivers can reject replays older than a few minutes.
 */
export const signPayload = (secret, timestamp, body) =>
  `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;

/** Receiver-side verification helper (used by tests and documented for partners). */
export const verifySignature = ({ secret, timestamp, body, signature, toleranceSec = 300, now = Date.now() }) => {
  if (!signature || !timestamp) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > toleranceSec) return false;
  const expected = Buffer.from(signPayload(secret, timestamp, body));
  const given = Buffer.from(String(signature));
  return expected.length === given.length && timingSafeEqual(expected, given);
};

/**
 * Exponential backoff: attempt n (1-based) waits base × 2^(n-1), capped.
 * Returns null when no more attempts are allowed.
 */
export const backoffDelay = (attempt, { baseDelayMs, maxDelayMs = 10 * 60 * 1000, maxAttempts }) => {
  if (attempt >= maxAttempts) return null;
  return Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
};

/** Normalised certificate fingerprint: uppercase hex without separators. */
export const normalizeFingerprint = (fp) =>
  String(fp ?? "")
    .replace(/^sha256[:=]/i, "")
    .replace(/[^a-fA-F0-9]/g, "")
    .toUpperCase();
