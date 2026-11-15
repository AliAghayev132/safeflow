import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  estimateNeeds,
  itemsWeightKg,
  tripBatteryPct,
  etaSec,
  selectDrone,
  flightStep,
} from "#modules/drones/logic.js";
import { dronesDefaults as cfg } from "#modules/drones/defaults.js";
import { haversineMeters } from "#utils/geo.js";

const BASE = { lat: 40.4, lng: 49.85 };
// ~1 km north of BASE
const north = (km) => ({ lat: BASE.lat + km / 111.3195, lng: BASE.lng });

const drone = (over = {}) => ({
  id: over.id ?? "d1",
  code: over.code ?? "DR",
  status: "idle",
  batteryPct: 100,
  payloadKg: 20,
  speedKmh: 60,
  rangeKm: 22,
  location: BASE,
  ...over,
});

describe("need estimation", () => {
  test("500 people → 1500 L water, 1000 rations, 10 medicine, 20 first aid", () => {
    const items = estimateNeeds(500, cfg.ratios);
    const by = Object.fromEntries(items.map((i) => [i.kind, i]));
    assert.equal(by.water.quantity, 1500);
    assert.equal(by.water.unit, "L");
    assert.equal(by.food.quantity, 1000);
    assert.equal(by.medicine.quantity, 10);
    assert.equal(by.first_aid.quantity, 20);
  });

  test("partial groups round up (1 person still gets a kit)", () => {
    const by = Object.fromEntries(estimateNeeds(1, cfg.ratios).map((i) => [i.kind, i.quantity]));
    assert.equal(by.medicine, 1);
    assert.equal(by.first_aid, 1);
  });

  test("empty shelter → no request", () => {
    assert.deepEqual(estimateNeeds(0, cfg.ratios), []);
  });

  test("weight uses per-unit kg", () => {
    const w = itemsWeightKg([{ kind: "water", quantity: 10 }, { kind: "food", quantity: 4 }], cfg.unitWeightKg);
    assert.equal(w, 12);
  });
});

describe("battery & ETA maths", () => {
  test("round trip drains more when loaded", () => {
    const empty = tripBatteryPct({ distanceKm: 5, loadKg: 0, capacityKg: 20 }, cfg.battery);
    const full = tripBatteryPct({ distanceKm: 5, loadKg: 20, capacityKg: 20 }, cfg.battery);
    assert.equal(empty, 30); // 2 × 5 km × 3 %/km
    assert.equal(full, 37.5); // outbound × 1.5
  });

  test("ETA = loading + flight time", () => {
    assert.equal(etaSec({ distanceKm: 6, speedKmh: 60, loadingSec: 60 }), 60 + 360);
  });

  test("flight step moves at speed and stops at the target", () => {
    const to = north(1);
    const half = flightStep({ from: BASE, to, speedKmh: 60, dtSec: 30 }); // 0.5 km
    assert.equal(half.arrived, false);
    assert.ok(Math.abs(haversineMeters(BASE, half) - 500) < 5);
    const done = flightStep({ from: half, to, speedKmh: 60, dtSec: 60 });
    assert.equal(done.arrived, true);
    assert.equal(done.lat, to.lat);
  });
});

describe("best drone selection", () => {
  const target = north(2);

  test("prefers the closer idle drone that carries the full load", () => {
    const { best } = selectDrone(
      [drone({ id: "far", location: north(-6) }), drone({ id: "near", location: north(1) })],
      { target, weightKg: 15 },
      cfg,
    );
    assert.equal(best.drone.id, "near");
    assert.equal(best.fullLoad, true);
    assert.equal(best.loadKg, 15);
  });

  test("busy, low-battery and out-of-range drones are not eligible", () => {
    const { best, ranked } = selectDrone(
      [
        drone({ id: "busy", status: "en_route" }),
        drone({ id: "low", batteryPct: 25 }),
        drone({ id: "far", location: north(-15) }),
      ],
      { target, weightKg: 5 },
      cfg,
    );
    assert.equal(best, null);
    const reason = Object.fromEntries(ranked.map((r) => [r.drone.id, r.reason]));
    assert.equal(reason.busy, "busy");
    assert.equal(reason.low, "low_battery");
    assert.equal(reason.far, "out_of_range");
  });

  test("battery reserve is respected exactly", () => {
    // 2 km away, empty-ish load: needs 2×2×3 = 12 % (+ load share)
    const need = tripBatteryPct({ distanceKm: 2, loadKg: 5, capacityKg: 20 }, cfg.battery);
    const ok = drone({ id: "ok", batteryPct: need + cfg.battery.reservePct + 0.5 });
    const no = drone({ id: "no", batteryPct: need + cfg.battery.reservePct - 0.5 });
    const { ranked } = selectDrone([ok, no], { target, weightKg: 5 }, cfg);
    assert.equal(ranked.find((r) => r.drone.id === "ok").eligible, true);
    assert.equal(ranked.find((r) => r.drone.id === "no").eligible, false);
  });

  test("a drone that can carry everything beats a smaller one at the same spot", () => {
    const { best } = selectDrone(
      [drone({ id: "small", payloadKg: 10 }), drone({ id: "big", payloadKg: 40 })],
      { target, weightKg: 30 },
      cfg,
    );
    assert.equal(best.drone.id, "big");
  });

  test("when nobody can carry it all, the drone takes a partial load", () => {
    const { best } = selectDrone([drone({ id: "d", payloadKg: 20 })], { target, weightKg: 100 }, cfg);
    assert.equal(best.loadKg, 20);
    assert.equal(best.fullLoad, false);
  });
});
