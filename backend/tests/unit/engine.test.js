import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  shelterLevel,
  priorityScore,
  compareTriage,
  scoreShelter,
  rankShelters,
  inflowPerMinute,
  fillEtaMinutes,
  assessSpam,
  resolveRoles,
  hasPermission,
} from "#engine";
import { CircuitBreaker } from "#utils/CircuitBreaker.js";
import defaults from "../../config/defaults/crisis.json" with { type: "json" };

describe("shelter thresholds", () => {
  const cfg = { rerouteThreshold: 0.9, alertThreshold: 0.95 };
  test("89% normal, 90% warning (reroute)", () => {
    assert.equal(shelterLevel(0.89, cfg), "normal");
    assert.equal(shelterLevel(0.9, cfg), "warning");
  });
  test("94% warning, 95% critical (alert)", () => {
    assert.equal(shelterLevel(0.94, cfg), "warning");
    assert.equal(shelterLevel(0.95, cfg), "critical");
  });
});

describe("triage priority", () => {
  const cfg = defaults.triage;
  test("severity order medical > fire > collapse > flood", () => {
    const s = (type) => priorityScore({ type }, cfg).score;
    assert.ok(s("medical") > s("fire"));
    assert.ok(s("fire") > s("collapse"));
    assert.ok(s("collapse") > s("flood"));
  });
  test("headcount and vulnerable flags raise priority", () => {
    const base = priorityScore({ type: "flood" }, cfg).score;
    const crowd = priorityScore({ type: "flood", headcount: 6 }, cfg).score;
    const vuln = priorityScore({ type: "flood", vulnerable: { child: true, elderly: true } }, cfg).score;
    assert.ok(crowd > base);
    assert.ok(vuln > base);
  });
  test("headcount is capped", () => {
    const a = priorityScore({ type: "fire", headcount: 500 }, cfg).score;
    const b = priorityScore({ type: "fire", headcount: cfg.headcountCap }, cfg).score;
    assert.equal(a, b);
  });
  test("queue sorts by score desc, then oldest first", () => {
    const list = [
      { id: "low", priority: 10, createdAt: "2026-01-01T10:00:00Z" },
      { id: "highNew", priority: 50, createdAt: "2026-01-01T10:05:00Z" },
      { id: "highOld", priority: 50, createdAt: "2026-01-01T10:01:00Z" },
    ].sort(compareTriage);
    assert.deepEqual(list.map((x) => x.id), ["highOld", "highNew", "low"]);
  });
});

describe("weighted shelter scoring", () => {
  const cfg = { weights: defaults.routing.weights, shelter: defaults.shelter };
  test("a slightly farther empty shelter beats a nearer crowded one", () => {
    const near = scoreShelter({ distanceMeters: 800, occupancyRate: 0.85 }, cfg);
    const far = scoreShelter({ distanceMeters: 1500, occupancyRate: 0.2 }, cfg);
    assert.ok(far.score < near.score);
  });
  test("full shelters are ranked last regardless of score", () => {
    const ranked = rankShelters([
      { id: "full", isFull: true, score: 1 },
      { id: "ok", isFull: false, score: 9 },
    ]);
    assert.equal(ranked[0].id, "ok");
  });
  test("fast-filling shelter is penalised", () => {
    const steady = scoreShelter({ distanceMeters: 1000, occupancyRate: 0.5, fillEtaMin: null }, cfg);
    const filling = scoreShelter({ distanceMeters: 1000, occupancyRate: 0.5, fillEtaMin: 8 }, cfg);
    assert.ok(filling.score > steady.score);
  });
});

describe("inflow & fill time", () => {
  test("people per minute over the window and ETA", () => {
    const now = 600000;
    const samples = [
      { at: now - 500000, delta: 30 },
      { at: now - 100000, delta: 30 },
      { at: now - 700000, delta: 999 }, // outside window
    ];
    const inflow = inflowPerMinute(samples, now, 600000);
    assert.equal(inflow, 6);
    assert.equal(fillEtaMinutes({ capacity: 100, occupancy: 28, inflow }), 12);
    assert.equal(fillEtaMinutes({ capacity: 100, occupancy: 28, inflow: 0 }), null);
  });
});

describe("spam heuristics", () => {
  const cfg = defaults.sos.spam;
  test("normal citizen is not flagged", () => {
    assert.equal(assessSpam({ deviceRecentCount: 1, ipDistinctDevices: 1 }, cfg).flagged, false);
  });
  test("device burst is flagged", () => {
    const r = assessSpam({ deviceRecentCount: cfg.deviceBurstCount + 1, ipDistinctDevices: 1 }, cfg);
    assert.equal(r.flagged, true);
    assert.ok(r.flags.includes("repeat_device"));
  });
  test("device-id rotation from one IP is flagged", () => {
    const r = assessSpam({ deviceRecentCount: 1, ipDistinctDevices: cfg.ipDeviceBurstCount }, cfg);
    assert.ok(r.flags.includes("ip_burst"));
  });
});

describe("config-driven RBAC", () => {
  const roles = resolveRoles({
    citizen: { permissions: ["sos:create"] },
    dispatcher: { permissions: ["sos:read", "alert:decide"] },
    admin: { inherits: ["dispatcher"], permissions: ["config:manage"] },
    auditor: { permissions: ["audit:*"] },
  });
  test("inherits parent permissions", () => {
    assert.ok(hasPermission(roles.admin, "alert:decide"));
    assert.ok(hasPermission(roles.admin, "config:manage"));
  });
  test("citizen cannot decide alerts", () => {
    assert.equal(hasPermission(roles.citizen, "alert:decide"), false);
  });
  test("wildcards", () => {
    assert.ok(hasPermission(roles.auditor, "audit:read"));
    assert.equal(hasPermission(roles.auditor, "sos:read"), false);
  });
  test("a new role is just one config entry", () => {
    const withNew = resolveRoles({ ...{ a: { permissions: ["x:read"] } }, volunteer: { permissions: ["shelter:read"] } });
    assert.ok(hasPermission(withNew.volunteer, "shelter:read"));
  });
  test("inheritance cycles are rejected", () => {
    assert.throws(() => resolveRoles({ a: { inherits: ["b"] }, b: { inherits: ["a"] } }));
  });
});

describe("circuit breaker", () => {
  test("opens after threshold, fails fast, half-opens after timeout", async () => {
    let t = 0;
    const cb = new CircuitBreaker({ name: "x", failureThreshold: 2, resetTimeoutMs: 1000, now: () => t });
    const fail = () => Promise.reject(new Error("boom"));
    await assert.rejects(cb.exec(fail));
    await assert.rejects(cb.exec(fail));
    assert.equal(cb.status().state, "open");
    await assert.rejects(cb.exec(() => Promise.resolve(1)), { code: "CIRCUIT_OPEN" });
    t = 1500;
    assert.equal(await cb.exec(() => Promise.resolve(1)), 1);
    assert.equal(cb.status().state, "closed");
  });
});
