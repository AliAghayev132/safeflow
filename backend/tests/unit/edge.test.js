import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  resolveStatusConflict,
  nextBackoffMs,
  isDue,
  orderForPush,
  nodeHealth,
} from "../../modules/edge/engine.js";

const T = (s) => new Date(Date.parse("2026-11-15T12:00:00Z") + s * 1000).toISOString();

describe("edge — status conflict resolution (latest wins)", () => {
  test("no current status → apply", () => {
    assert.equal(resolveStatusConflict(null, { status: "safe", at: T(0) }).apply, true);
  });
  test("newer incoming → apply", () => {
    const r = resolveStatusConflict({ status: "needs_help", at: T(0) }, { status: "safe", at: T(5) });
    assert.deepEqual(r, { apply: true, reason: "newer" });
  });
  test("older incoming → keep current (stale)", () => {
    const r = resolveStatusConflict({ status: "needs_help", at: T(10) }, { status: "safe", at: T(5) });
    assert.deepEqual(r, { apply: false, reason: "stale" });
  });
  test("same time + same status → idempotent duplicate", () => {
    const r = resolveStatusConflict({ status: "safe", at: T(5) }, { status: "safe", at: T(5) });
    assert.equal(r.reason, "duplicate");
    assert.equal(r.apply, false);
  });
  test("same time, different status → keep current (deterministic)", () => {
    assert.equal(resolveStatusConflict({ status: "safe", at: T(5) }, { status: "evacuating", at: T(5) }).apply, false);
  });
  test("current without timestamp is overwritten", () => {
    assert.equal(resolveStatusConflict({ status: "unknown", at: null }, { status: "safe", at: T(1) }).apply, true);
  });
  test("invalid incoming is ignored", () => {
    assert.equal(resolveStatusConflict(null, { status: "safe", at: "nope" }).apply, false);
    assert.equal(resolveStatusConflict(null, { at: T(1) }).apply, false);
  });
});

describe("edge — outbox retry backoff", () => {
  const cfg = { backoffBaseMs: 2000, backoffMaxMs: 60000, jitter: 0 };
  test("doubles per attempt", () => {
    assert.deepEqual([1, 2, 3, 4].map((n) => nextBackoffMs(n, cfg)), [2000, 4000, 8000, 16000]);
  });
  test("is capped at backoffMaxMs", () => {
    assert.equal(nextBackoffMs(30, cfg), 60000);
  });
  test("jitter stays within ±jitter and never exceeds the cap", () => {
    const j = { ...cfg, jitter: 0.2 };
    assert.equal(nextBackoffMs(2, j, () => 0), 3200);
    assert.equal(nextBackoffMs(2, j, () => 1), 4800);
    assert.equal(nextBackoffMs(20, j, () => 1), 60000);
  });
});

describe("edge — due items and push order", () => {
  const now = Date.parse(T(100));
  test("synced items are never due", () => {
    assert.equal(isDue({ syncedAt: T(0) }, now), false);
  });
  test("backoff window respected unless forced", () => {
    const item = { syncedAt: null, nextAttemptAt: T(200) };
    assert.equal(isDue(item, now), false);
    assert.equal(isDue(item, now, { force: true }), true);
    assert.equal(isDue({ syncedAt: null, nextAttemptAt: T(50) }, now), true);
  });
  test("oldest first; at equal time SOS before details before status", () => {
    const ordered = orderForPush([
      { key: "st", kind: "status", occurredAt: T(1) },
      { key: "late", kind: "sos", occurredAt: T(9) },
      { key: "det", kind: "sosDetails", occurredAt: T(1) },
      { key: "sos", kind: "sos", occurredAt: T(1) },
    ]);
    assert.deepEqual(ordered.map((i) => i.key), ["sos", "det", "st", "late"]);
  });
});

describe("edge — node health", () => {
  const now = Date.parse(T(1000));
  test("states", () => {
    assert.equal(nodeHealth({ status: "revoked", lastSeenAt: T(999) }, now, 120000), "revoked");
    assert.equal(nodeHealth({ status: "active", lastSeenAt: null }, now, 120000), "never");
    assert.equal(nodeHealth({ status: "active", lastSeenAt: T(990) }, now, 120000), "online");
    assert.equal(nodeHealth({ status: "active", lastSeenAt: T(990), lastError: "x" }, now, 120000), "degraded");
    assert.equal(nodeHealth({ status: "active", lastSeenAt: T(500) }, now, 120000), "offline");
  });
});
