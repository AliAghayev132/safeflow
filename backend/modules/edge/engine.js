/**
 * Edge node — pure decision logic (no I/O, unit-tested).
 */

const time = (v) => {
  const t = v instanceof Date ? v.getTime() : new Date(v ?? NaN).getTime();
  return Number.isFinite(t) ? t : null;
};

/**
 * Citizen status conflict resolution — the latest status wins.
 * `current` is what the central server holds ({ status, at } or null),
 * `incoming` comes from an edge node ({ status, at }).
 * Ties keep the current value (idempotent replays never flip a status).
 *
 * @returns {{ apply: boolean, reason: string }}
 */
export const resolveStatusConflict = (current, incoming) => {
  const inAt = time(incoming?.at);
  if (!incoming?.status || inAt === null) return { apply: false, reason: "invalid" };
  const curAt = time(current?.at);
  if (!current?.status || curAt === null) return { apply: true, reason: "no_current" };
  if (inAt > curAt) return { apply: true, reason: "newer" };
  if (inAt === curAt && incoming.status === current.status) return { apply: false, reason: "duplicate" };
  return { apply: false, reason: "stale" };
};

/**
 * Exponential retry backoff with jitter for outbox items.
 *   delay = min(maxMs, baseMs × 2^(attempts-1)) × (1 ± jitter)
 */
export const nextBackoffMs = (attempts, { backoffBaseMs, backoffMaxMs, jitter = 0.2 }, rand = Math.random) => {
  const n = Math.max(1, attempts);
  const raw = Math.min(backoffMaxMs, backoffBaseMs * 2 ** (n - 1));
  const factor = 1 + (rand() * 2 - 1) * jitter;
  return Math.max(0, Math.round(Math.min(backoffMaxMs, raw * factor)));
};

/** Items due for a push attempt (not synced, nextAttemptAt reached). */
export const isDue = (item, now, { force = false } = {}) =>
  !item.syncedAt && (force || !item.nextAttemptAt || time(item.nextAttemptAt) <= now);

/**
 * Push order: oldest first; for equal times SOS before details before status,
 * so an "I am safe" never reaches the center before the SOS it cancels.
 */
const KIND_ORDER = { sos: 0, sosDetails: 1, status: 2 };
export const orderForPush = (items) =>
  [...items].sort(
    (a, b) =>
      (time(a.occurredAt) ?? 0) - (time(b.occurredAt) ?? 0) ||
      (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9),
  );

/** Node health from its last contact. */
export const nodeHealth = (node, now, staleMs) => {
  if (node.status === "revoked") return "revoked";
  const seen = time(node.lastSeenAt);
  if (seen === null) return "never";
  if (now - seen > staleMs) return "offline";
  if (node.lastError) return "degraded";
  return "online";
};
