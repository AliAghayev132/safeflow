import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  grantScopes,
  normalizeScopes,
  allowedEvents,
  hasScope,
} from "#modules/partner/core/scopes.js";
import {
  serializeIncident,
  serializeAssemblyPoint,
  serializeRoad,
  serializeRequest,
  findForbiddenKeys,
} from "#modules/partner/core/serializers.js";
import {
  signPayload,
  verifySignature,
  backoffDelay,
  normalizeFingerprint,
} from "#modules/partner/core/signing.js";

describe("partner scopes", () => {
  const allowed = ["incidents:read", "roads:read", "requests:write"];

  test("no requested scope → all allowed scopes", () => {
    assert.deepEqual(grantScopes({ allowed, requested: "", status: "active" }).scopes, allowed);
  });

  test("requested subset is granted", () => {
    assert.deepEqual(grantScopes({ allowed, requested: "roads:read", status: "active" }).scopes, ["roads:read"]);
  });

  test("scope outside the client's allow-list → invalid_scope", () => {
    assert.equal(grantScopes({ allowed, requested: "assembly_points:read", status: "active" }).error, "invalid_scope");
  });

  test("limited client only gets read scopes", () => {
    assert.deepEqual(grantScopes({ allowed, requested: "", status: "limited" }).scopes, ["incidents:read", "roads:read"]);
    assert.equal(grantScopes({ allowed, requested: "requests:write", status: "limited" }).error, "invalid_scope");
  });

  test("unknown scopes are dropped on registration", () => {
    assert.deepEqual(normalizeScopes(["roads:read", "admin:*", "roads:read"]), ["roads:read"]);
  });

  test("webhook events follow scopes", () => {
    assert.deepEqual(allowedEvents(["roads:read"]), ["road.updated"]);
    assert.ok(allowedEvents(["incidents:read"]).includes("incident.created"));
    assert.equal(hasScope(["roads:read"], "incidents:read"), false);
  });
});

describe("partner data minimisation", () => {
  test("incident: aggregate count + rounded centroid, never identities", () => {
    const alert = {
      id: "a1",
      type: "sos_cluster",
      severity: "critical",
      status: "active",
      lat: 40.3861234,
      lng: 49.8187654,
      signalCount: 17,
      sosSignals: ["s1", "s2"],
      deviceIds: ["d1"],
      message: "…",
      i18n: { params: { zone: "Yasamal", hazard: "collapse" } },
      createdAt: "2026-11-15T10:00:00Z",
    };
    const out = serializeIncident(alert);
    assert.equal(out.reports, 17);
    assert.deepEqual(out.center, { lat: 40.386, lng: 49.819 });
    assert.deepEqual(findForbiddenKeys(out), []);
    assert.equal("sosSignals" in out, false);
  });

  test("assembly point / road / request serializers drop internal and personal fields", () => {
    const shelter = { id: "s", code: "SH-01", name: "X", type: "park", lat: 1, lng: 2, capacity: 10, occupancy: 5, occupancyRate: 0.5, isActive: true, nodeId: "N1", phone: "+994" };
    const road = { edgeId: "E1", name: "R", status: "closed", congestion: 0, from: "N1", to: "N2", note: "x" };
    const request = { _id: "r1", type: "help", priority: "urgent", title: "t", status: "submitted", client: "c", partnerName: "p", handledBy: "op", note: "x" };
    for (const out of [serializeAssemblyPoint(shelter), serializeRoad(road), serializeRequest(request)]) {
      assert.deepEqual(findForbiddenKeys(out), []);
    }
    assert.equal("nodeId" in serializeAssemblyPoint(shelter), false);
    assert.equal("handledBy" in serializeRequest(request), false);
  });

  test("forbidden-key scanner catches nested leaks", () => {
    assert.deepEqual(findForbiddenKeys({ a: [{ b: { deviceId: 1 } }], phone: 2 }).sort(), ["deviceId", "phone"]);
  });
});

describe("webhook signing", () => {
  const secret = "whsec_test";
  const body = '{"event":"road.updated"}';
  const ts = 1763200000;

  test("signature = sha256 HMAC over `timestamp.body`", () => {
    const expected = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
    assert.equal(signPayload(secret, ts, body), `sha256=${expected}`);
  });

  test("verification accepts a fresh, correct signature", () => {
    const signature = signPayload(secret, ts, body);
    assert.ok(verifySignature({ secret, timestamp: ts, body, signature, now: ts * 1000 + 10_000 }));
  });

  test("tampered body, wrong secret or stale timestamp are rejected", () => {
    const signature = signPayload(secret, ts, body);
    assert.equal(verifySignature({ secret, timestamp: ts, body: body + " ", signature, now: ts * 1000 }), false);
    assert.equal(verifySignature({ secret: "other", timestamp: ts, body, signature, now: ts * 1000 }), false);
    assert.equal(verifySignature({ secret, timestamp: ts, body, signature, now: (ts + 3600) * 1000 }), false);
  });
});

describe("webhook retry backoff", () => {
  const cfg = { baseDelayMs: 1000, maxAttempts: 5, maxDelayMs: 6000 };
  test("exponential, capped, stops after max attempts", () => {
    assert.equal(backoffDelay(1, cfg), 1000);
    assert.equal(backoffDelay(2, cfg), 2000);
    assert.equal(backoffDelay(3, cfg), 4000);
    assert.equal(backoffDelay(4, cfg), 6000); // capped
    assert.equal(backoffDelay(5, cfg), null); // no 6th attempt
  });
});

describe("mTLS fingerprints", () => {
  test("normalised to uppercase hex without separators", () => {
    assert.equal(normalizeFingerprint("sha256:ab:cd:0f"), "ABCD0F");
    assert.equal(normalizeFingerprint("AB CD 0F"), "ABCD0F");
  });
});
