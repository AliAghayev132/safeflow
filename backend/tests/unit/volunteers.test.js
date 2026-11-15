import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  rankCandidates,
  medicalCandidates,
  isEligible,
  initialVerification,
  matchesMagic,
  coarseLocation,
} from "../../modules/volunteers/engine.js";
import { DOCUMENT_TYPES } from "../../modules/volunteers/constants.js";

const SHELTER = { id: "S1", lat: 40.4, lng: 49.85 };
const METERS_PER_DEG_LAT = (Math.PI / 180) * 6378100;
const north = (m) => ({ lat: SHELTER.lat + m / METERS_PER_DEG_LAT, lng: SHELTER.lng });

let n = 0;
const vol = (over = {}) => ({
  deviceId: `d${++n}`,
  profession: "doctor",
  consentGiven: true,
  availability: "ready",
  currentShelterId: null,
  location: north(1000),
  ...over,
});

const base = { shelter: SHELTER, professions: ["doctor"], radiusMeters: 3000, widenRadiusMeters: 6000 };

describe("volunteer matching order", () => {
  test("volunteers at the shelter come first (stage 1)", () => {
    const here = vol({ currentShelterId: "S1", location: north(5000) });
    const near = vol({ location: north(200) });
    const r = rankCandidates({ ...base, volunteers: [near, here], count: 1 });
    assert.deepEqual(r.map((v) => [v.deviceId, v.stage]), [[here.deviceId, 1]]);
  });

  test("radius stage only when the shelter cannot fill the count; nearest first", () => {
    const here = vol({ currentShelterId: "S1" });
    const far = vol({ location: north(2500) });
    const near = vol({ location: north(800) });
    const r = rankCandidates({ ...base, volunteers: [far, here, near], count: 3 });
    assert.deepEqual(r.map((v) => v.stage), [1, 2, 2]);
    assert.equal(r[1].deviceId, near.deviceId);
  });

  test("outside the radius only when widening is on", () => {
    const out = vol({ location: north(4500) });
    assert.equal(rankCandidates({ ...base, volunteers: [out], count: 1, widenRadiusMeters: 0 }).length, 0);
    const wide = rankCandidates({ ...base, volunteers: [out], count: 1 });
    assert.equal(wide[0].stage, 3);
  });

  test("beyond the widened radius is never notified", () => {
    assert.equal(rankCandidates({ ...base, volunteers: [vol({ location: north(7000) })], count: 1 }).length, 0);
  });

  test("withdrawn consent, not ready, other profession or no position are excluded", () => {
    const list = [
      vol({ consentGiven: false }),
      vol({ availability: "not_ready" }),
      vol({ profession: "engineer" }),
      vol({ location: null }),
    ];
    assert.equal(rankCandidates({ ...base, volunteers: list, count: 5 }).length, 0);
  });

  test("maxNotify caps the fan-out", () => {
    const many = Array.from({ length: 10 }, () => vol({ location: north(100) }));
    assert.equal(rankCandidates({ ...base, volunteers: many, count: 10, maxNotify: 4 }).length, 4);
  });

  test("isEligible honours an exclude set", () => {
    const v = vol();
    assert.equal(isEligible(v, { professions: ["doctor"], exclude: new Set([v.deviceId]) }), false);
  });
});

describe("medical SOS call-out", () => {
  test("only medical professions within the radius, nearest first", () => {
    const doc = vol({ profession: "doctor", location: north(900) });
    const nurse = vol({ profession: "nurse", location: north(300) });
    const eng = vol({ profession: "engineer", location: north(100) });
    const far = vol({ profession: "paramedic", location: north(5000) });
    const r = medicalCandidates({ volunteers: [doc, nurse, eng, far], point: SHELTER, radiusMeters: 2000 });
    assert.deepEqual(r.map((v) => v.deviceId), [nurse.deviceId, doc.deviceId]);
  });
});

describe("verification + documents + privacy helpers", () => {
  test("medical professions need verification", () => {
    assert.equal(initialVerification("doctor"), "unverified");
    assert.equal(initialVerification("electrician"), "not_required");
  });

  test("file content must match the declared type", () => {
    const pdf = Buffer.from("%PDF-1.7 ...");
    assert.equal(matchesMagic(pdf, DOCUMENT_TYPES["application/pdf"]), true);
    assert.equal(matchesMagic(pdf, DOCUMENT_TYPES["image/png"]), false);
    assert.equal(matchesMagic(Buffer.from([0xff]), DOCUMENT_TYPES["image/jpeg"]), false);
  });

  test("coarse location never carries coordinates", () => {
    assert.deepEqual(coarseLocation({ shelterName: "Park", zoneName: "Yasamal" }), { kind: "shelter", label: "Park" });
    assert.deepEqual(coarseLocation({ zoneName: "Yasamal" }), { kind: "zone", label: "Yasamal" });
    assert.equal(coarseLocation({}), null);
  });
});
