import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseEmergencyText, toSosDetails } from "#modules/ai/voice/parser.js";
import { holtFit, holtForecast, occupancyRisk } from "#modules/ai/forecast/holt.js";
import { planDistribution, needFor, coverageHours } from "#modules/ai/supply/planner.js";
import { detectIntents, composeAnswer } from "#modules/ai/chat/intents.js";

const ZONES = [
  { code: "YAS", name: "Yasamal" },
  { code: "SEB", name: "Səbail" },
];

describe("AI — voice SOS parser (az / en / ru)", () => {
  test("Azerbaijani collapse call: hazard, people, floor, child, zone, critical", () => {
    const p = parseEmergencyText(
      "Kömək edin! Binamız uçub, üçüncü mərtəbədə dağıntı altında dörd nəfərik, aramızda uşaq var. Yasamal, Şərifzadə küçəsi.",
      ZONES,
    );
    assert.equal(p.hazardType, "collapse");
    assert.equal(p.peopleCount, 4);
    assert.equal(p.location.floor, 3);
    assert.equal(p.location.zoneCode, "YAS");
    assert.equal(p.vulnerable.child, true);
    assert.equal(p.trapped, true);
    assert.equal(p.priority, "critical");
  });

  test("English fire call with elderly person → high priority", () => {
    const p = parseEmergencyText("Fire in the kitchen, 2 people, my grandmother cannot walk", ZONES);
    assert.equal(p.hazardType, "fire");
    assert.equal(p.peopleCount, 2);
    assert.equal(p.vulnerable.elderly, true);
    assert.equal(p.priority, "high");
  });

  test("Russian flood call", () => {
    const p = parseEmergencyText("Помогите, наводнение, нас трое, с нами ребенок", ZONES);
    assert.equal(p.hazardType, "flood");
    assert.equal(p.peopleCount, 3);
    assert.equal(p.vulnerable.child, true);
  });

  test("unclear text → general, low/medium priority, no invented facts", () => {
    const p = parseEmergencyText("salam, sualım var", ZONES);
    assert.equal(p.hazardType, "general");
    assert.equal(p.peopleCount, null);
    assert.equal(p.location.zoneCode, null);
    assert.ok(["low", "medium"].includes(p.priority));
  });

  test("toSosDetails maps to SOS fields", () => {
    const p = parseEmergencyText("4 nəfər dağıntı altında, yaralı var", ZONES);
    const d = toSosDetails(p, "text");
    assert.equal(d.headcount, 4);
    assert.ok(d.needs.includes("rescue_trapped"));
    assert.equal(d.transcript, "text");
  });
});

describe("AI — Holt forecasting", () => {
  test("linear series is extrapolated", () => {
    const m = holtFit([100, 110, 120, 130, 140, 150], { alpha: 0.6, beta: 0.4 });
    const f = holtForecast(m, 3);
    assert.ok(Math.abs(f - 180) < 8, `forecast ${f}`);
  });

  test("flat series stays flat; forecast never negative", () => {
    const m = holtFit([50, 50, 50, 50]);
    assert.equal(Math.round(holtForecast(m, 10)), 50);
    const d = holtFit([30, 20, 10, 0]);
    assert.equal(holtForecast(d, 10, { min: 0 }), 0);
  });

  test("risk classes", () => {
    assert.equal(occupancyRisk(1.05), "overflow");
    assert.equal(occupancyRisk(0.92), "critical");
    assert.equal(occupancyRisk(0.8), "elevated");
    assert.equal(occupancyRisk(0.4), "normal");
  });
});

describe("AI — supply distribution planner", () => {
  const ratios = { waterLitersPerPerson: 3, foodRationsPerPerson: 2, medicineKitPerPeople: 50, firstAidKitPerPeople: 25 };
  const unitWeightKg = { water: 1, food: 0.5, medicine: 1.5, first_aid: 2 };
  const base = { lat: 40.4, lng: 49.85 };
  const opts = { ratios, unitWeightKg, targetHours: 24, criticalHours: 6, loadingSec: 60, now: 0 };

  test("need scales with people and hours", () => {
    assert.deepEqual(needFor(100, ratios, 24), { water: 300, food: 200, medicine: 2, first_aid: 4 });
    assert.equal(needFor(100, ratios, 12).water, 150);
    assert.equal(coverageHours(100, { water: 150, food: 1000, medicine: 99, first_aid: 99 }, ratios), 12);
  });

  test("empty-stock shelter is critical and served first; trips fit payload", () => {
    const plan = planDistribution(
      [
        { id: "A", name: "A", lat: 40.41, lng: 49.86, people: 50, forecastPeople: 50, stock: { water: 1000, food: 1000, medicine: 10, first_aid: 10 } },
        { id: "B", name: "B", lat: 40.39, lng: 49.84, people: 40, forecastPeople: 60, stock: {} },
      ],
      [{ id: "d1", code: "D1", payloadKg: 25, speedKmh: 60, base, freeInSec: 0 }],
      opts,
    );
    assert.equal(plan.shelters[0].shelterId, "B");
    assert.equal(plan.shelters[0].critical, true);
    // forecast people (60) is used, not current (40)
    assert.equal(plan.shelters[0].need.water, 180);
    assert.ok(plan.schedule.length > 1);
    for (const trip of plan.schedule) assert.ok(trip.loadKg <= 25);
    // the first trip goes to the critical shelter
    assert.equal(plan.schedule[0].shelterId, "B");
  });

  test("round-robin: every shelter gets a delivery before any gets a second", () => {
    const plan = planDistribution(
      ["A", "B", "C"].map((id, i) => ({ id, name: id, lat: 40.4 + i * 0.01, lng: 49.85, people: 200, stock: {} })),
      [{ id: "d1", code: "D1", payloadKg: 10, speedKmh: 60, base }],
      { ...opts, maxTrips: 3 },
    );
    assert.deepEqual(new Set(plan.schedule.map((t) => t.shelterId)), new Set(["A", "B", "C"]));
    assert.ok(plan.totals.unscheduledKg > 0);
  });

  test("already requested quantities reduce the deficit", () => {
    const plan = planDistribution(
      [{ id: "A", name: "A", lat: 40.41, lng: 49.86, people: 10, stock: {}, outstanding: { water: 30, food: 20, medicine: 1, first_aid: 1 } }],
      [{ id: "d1", code: "D1", payloadKg: 25, speedKmh: 60, base }],
      opts,
    );
    assert.equal(plan.shelters[0].deficitKg, 0);
    assert.equal(plan.schedule.length, 0);
  });
});

describe("AI — assistant intents", () => {
  const ctx = {
    shelters: [{ id: "1", name: "Park A", distance: "800 m", walkMin: 10, pct: 95, full: true }, { id: "2", name: "Stadion B", distance: "1.2 km", walkMin: 15, pct: 40, full: false }],
    waterPoints: [{ id: "2", name: "Stadion B", distance: "1.2 km", delivered: true }],
    medicalPoints: [],
    closedRoads: 2,
    activeAlerts: 0,
  };

  test("detects intents in three languages", () => {
    assert.ok(detectIntents("Harada su var?").includes("water"));
    assert.ok(detectIntents("Where is the nearest shelter?").includes("shelter"));
    assert.ok(detectIntents("Где врач?").includes("medical"));
  });

  test("answers only from retrieved data, offers alternative when full", () => {
    const a = composeAnswer(["shelter", "water", "medical"], ctx, "en");
    assert.match(a, /Park A/);
    assert.match(a, /Alternative: Stadion B/);
    assert.match(a, /drone/);
    assert.match(a, /No medical point/);
  });
});
