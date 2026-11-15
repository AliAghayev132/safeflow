import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { rankBrigades } from "#engine";

const NOW = Date.parse("2026-11-15T12:00:00Z");
const target = { lat: 40.4, lng: 49.85 };
const cfg = { speedKmh: 40, onSceneMinutes: 20, alternatives: 2 };
const at = (dLat) => ({ lat: 40.4 + dLat, lng: 49.85 });
const b = (id, type, status, dLat, extra = {}) => ({ id, code: id, name: id, type, status, ...at(dLat), ...extra });

describe("brigade auto-suggestion", () => {
  test("nearest matching free brigade first, with an ETA", () => {
    const r = rankBrigades({
      brigades: [b("fire-far", "fire", "available", 0.05), b("fire-near", "fire", "available", 0.01)],
      target,
      preferredType: "fire",
      cfg,
      now: NOW,
    });
    assert.equal(r.suggestion.brigadeId, "fire-near");
    assert.ok(r.suggestion.etaSec > 0);
    assert.equal(r.alternatives[0].brigadeId, "fire-far");
    assert.equal(r.noneAvailable, false);
  });

  test("hazard type matters: a slightly farther matching brigade beats a near mismatch", () => {
    const r = rankBrigades({
      brigades: [b("medical-near", "medical", "available", 0.01), b("fire-a-bit-far", "fire", "available", 0.014)],
      target,
      preferredType: "fire",
      cfg,
      now: NOW,
    });
    assert.equal(r.suggestion.brigadeId, "fire-a-bit-far");
    assert.equal(r.alternatives[0].typeMatch, false);
  });

  test("matching type wins over a mismatch that is only a minute faster", () => {
    // ~2 min medical vs ~3 min fire, hazard = fire → fire brigade
    const r = rankBrigades({
      brigades: [b("medical-2min", "medical", "available", 0.0085), b("fire-3min", "fire", "available", 0.0125)],
      target,
      preferredType: "fire",
      cfg,
      now: NOW,
    });
    assert.equal(r.suggestion.brigadeId, "fire-3min");
  });

  test("a mismatch wins only when it is much faster (> penalty)", () => {
    const r = rankBrigades({
      brigades: [b("medical-near", "medical", "available", 0.002), b("fire-very-far", "fire", "available", 0.12)],
      target,
      preferredType: "fire",
      cfg,
      now: NOW,
    });
    assert.equal(r.suggestion.brigadeId, "medical-near");
  });

  test("busy brigades are never suggested as free", () => {
    const r = rankBrigades({
      brigades: [b("busy", "fire", "on_scene", 0.001, { statusChangedAt: new Date(NOW).toISOString() }), b("free", "fire", "available", 0.05)],
      target,
      preferredType: "fire",
      cfg,
      now: NOW,
    });
    assert.equal(r.suggestion.brigadeId, "free");
  });

  test("nobody free → says so and proposes the soonest-free brigade", () => {
    const r = rankBrigades({
      brigades: [
        // on scene for 18 of 20 minutes → free in ~2 min
        b("almost-done", "rescue", "on_scene", 0.01, { statusChangedAt: new Date(NOW - 18 * 60000).toISOString() }),
        // just arrived → free in 20 min
        b("just-started", "rescue", "on_scene", 0.001, { statusChangedAt: new Date(NOW).toISOString() }),
        // still driving to another incident
        b("en-route", "rescue", "dispatched", 0.02, { target: at(0.03) }),
      ],
      target,
      preferredType: "rescue",
      cfg,
      now: NOW,
    });
    assert.equal(r.suggestion, null);
    assert.equal(r.noneAvailable, true);
    assert.equal(r.soonestFree.brigadeId, "almost-done");
    assert.ok(Math.abs(r.soonestFree.freeInSec - 120) <= 1);
    assert.ok(r.soonestFree.etaSec > r.soonestFree.freeInSec);
  });

  test("a returning brigade can be redirected immediately", () => {
    const r = rankBrigades({
      brigades: [b("returning", "fire", "returning", 0.01), b("on-scene", "fire", "on_scene", 0.001, { statusChangedAt: new Date(NOW).toISOString() })],
      target,
      preferredType: "fire",
      cfg,
      now: NOW,
    });
    assert.equal(r.soonestFree.brigadeId, "returning");
    assert.equal(r.soonestFree.freeInSec, 0);
  });
});
