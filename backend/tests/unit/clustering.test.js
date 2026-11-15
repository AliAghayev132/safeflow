import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { evaluateCluster, decideClusterAlert } from "#engine";

const cfg = { minSignals: 4, windowMs: 5 * 60 * 1000, radiusMeters: 500, cooldownMs: 10 * 60 * 1000 };
const NOW = Date.parse("2026-11-15T12:00:00Z");
const BASE = { lat: 40.4, lng: 49.85 };

// Point `meters` north of BASE (1° lat ≈ 111 194.9 m on a 6378.1 km sphere)
const METERS_PER_DEG_LAT = (Math.PI / 180) * 6378100;
const north = (meters) => ({ lat: BASE.lat + meters / METERS_PER_DEG_LAT, lng: BASE.lng });

let seq = 0;
const sos = (over = {}) => ({
  id: `s${++seq}`,
  deviceId: over.deviceId ?? `dev-${seq}`,
  zone: over.zone ?? "Z1",
  ...BASE,
  createdAt: new Date(NOW - (over.agoMs ?? 0)).toISOString(),
  status: "pending",
  ...over,
});

describe("evaluateCluster — signal count", () => {
  test("exactly 4 distinct devices triggers", () => {
    const signals = [sos(), sos(), sos(), sos()];
    const r = evaluateCluster({ signals, trigger: signals[3], now: NOW, cfg });
    assert.equal(r.triggered, true);
    assert.equal(r.distinctDevices, 4);
  });

  test("3 distinct devices does not trigger", () => {
    const signals = [sos(), sos(), sos()];
    const r = evaluateCluster({ signals, trigger: signals[2], now: NOW, cfg });
    assert.equal(r.triggered, false);
  });

  test("same citizen pressing 4 times does not trigger", () => {
    const signals = [1, 2, 3, 4].map(() => sos({ deviceId: "same-device" }));
    const r = evaluateCluster({ signals, trigger: signals[3], now: NOW, cfg });
    assert.equal(r.triggered, false);
    assert.equal(r.zoneDevices, 1);
  });

  test("citizen marked safe is excluded", () => {
    const signals = [sos(), sos(), sos(), sos({ citizenSafe: true })];
    const r = evaluateCluster({ signals, trigger: signals[0], now: NOW, cfg });
    assert.equal(r.triggered, false);
  });

  test("spam-flagged and cancelled signals are excluded", () => {
    const signals = [sos(), sos(), sos({ spamFlagged: true }), sos({ status: "cancelled" })];
    const r = evaluateCluster({ signals, trigger: signals[0], now: NOW, cfg });
    assert.equal(r.triggered, false);
  });
});

describe("evaluateCluster — radius (haversine), zones evaluated separately", () => {
  test("499 m is inside the 500 m radius", () => {
    const trigger = sos({ zone: "A" });
    const signals = [trigger, sos({ zone: "B", ...north(499) }), sos({ zone: "C", ...north(499) }), sos({ zone: "D", ...north(499) })];
    const r = evaluateCluster({ signals, trigger, now: NOW, cfg });
    assert.equal(r.triggered, true);
    assert.equal(r.mode, "radius");
  });

  test("501 m is outside the 500 m radius", () => {
    const trigger = sos({ zone: "A" });
    const signals = [trigger, sos({ zone: "B", ...north(499) }), sos({ zone: "C", ...north(499) }), sos({ zone: "D", ...north(501) })];
    const r = evaluateCluster({ signals, trigger, now: NOW, cfg });
    assert.equal(r.triggered, false);
    assert.equal(r.radiusDevices, 3);
  });

  test("same zone triggers even when far apart", () => {
    const trigger = sos({ zone: "Z9" });
    const signals = [trigger, sos({ zone: "Z9", ...north(2000) }), sos({ zone: "Z9", ...north(3000) }), sos({ zone: "Z9", ...north(4000) })];
    const r = evaluateCluster({ signals, trigger, now: NOW, cfg });
    assert.equal(r.triggered, true);
    assert.equal(r.mode, "zone");
  });
});

describe("evaluateCluster — sliding 5 minute window", () => {
  const min = 60 * 1000;
  test("a signal 4:59 old is counted", () => {
    const signals = [sos(), sos(), sos(), sos({ agoMs: 4 * min + 59 * 1000 })];
    const r = evaluateCluster({ signals, trigger: signals[0], now: NOW, cfg });
    assert.equal(r.triggered, true);
  });

  test("a signal 5:01 old is not counted", () => {
    const signals = [sos(), sos(), sos(), sos({ agoMs: 5 * min + 1000 })];
    const r = evaluateCluster({ signals, trigger: signals[0], now: NOW, cfg });
    assert.equal(r.triggered, false);
  });

  test("window slides — no fixed buckets across a minute boundary", () => {
    // 2 signals at 12:03:30, 2 at 12:06:10 → within 5 min of each other
    const now = Date.parse("2026-11-15T12:06:10Z");
    const at = (iso) => new Date(iso).toISOString();
    const signals = [
      { ...sos(), createdAt: at("2026-11-15T12:03:30Z") },
      { ...sos(), createdAt: at("2026-11-15T12:03:30Z") },
      { ...sos(), createdAt: at("2026-11-15T12:06:10Z") },
      { ...sos(), createdAt: at("2026-11-15T12:06:10Z") },
    ];
    const r = evaluateCluster({ signals, trigger: signals[3], now, cfg });
    assert.equal(r.triggered, true);
  });
});

describe("decideClusterAlert — no repeated alerts", () => {
  const center = BASE;
  test("active alert in same zone → update, not create", () => {
    const alerts = [{ id: "a1", status: "active", zone: "Z1", ...north(2000), createdAt: new Date(NOW).toISOString() }];
    assert.equal(decideClusterAlert({ alerts, zone: "Z1", center, now: NOW, cfg }).action, "update");
  });

  test("active alert within radius (other zone) → update", () => {
    const alerts = [{ id: "a1", status: "active", zone: "Z2", ...north(300), createdAt: new Date(NOW).toISOString() }];
    assert.equal(decideClusterAlert({ alerts, zone: "Z1", center, now: NOW, cfg }).action, "update");
  });

  test("decided alert inside cooldown → attach (no new red alert)", () => {
    const alerts = [{ id: "a1", status: "approved", zone: "Z1", ...center, decidedAt: new Date(NOW - 9 * 60 * 1000).toISOString() }];
    assert.equal(decideClusterAlert({ alerts, zone: "Z1", center, now: NOW, cfg }).action, "attach");
  });

  test("decided alert after cooldown → create", () => {
    const alerts = [{ id: "a1", status: "approved", zone: "Z1", ...center, decidedAt: new Date(NOW - 11 * 60 * 1000).toISOString() }];
    assert.equal(decideClusterAlert({ alerts, zone: "Z1", center, now: NOW, cfg }).action, "create");
  });

  test("different, distant area → create", () => {
    const alerts = [{ id: "a1", status: "active", zone: "Z2", ...north(5000), createdAt: new Date(NOW).toISOString() }];
    assert.equal(decideClusterAlert({ alerts, zone: "Z1", center, now: NOW, cfg }).action, "create");
  });
});
