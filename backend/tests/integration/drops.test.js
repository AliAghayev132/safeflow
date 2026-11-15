/**
 * Official Challenge Drops of the PM final — one test block per drop.
 *   #1 Limited-mobility role → Priority #1 + barrier-free route; AZ/EN UI (client)
 *   #2 External routing API down (503 / > 5 s) → no crash, circuit breaker,
 *      local fallback route + "backup routing mode" flag
 *   #3 500+ fake SOS flood → rate limiting + duplicate filtering, dispatcher not
 *      flooded, brigade dispatch protected by JWT/RBAC, average latency < 300 ms
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, api, login, accounts, uuid, YASAMAL, fakeRouting } from "./helpers.js";

let admin, dispatcher, lead;

before(async () => {
  await boot();
  [admin, dispatcher, lead] = await Promise.all([login(...accounts.admin), login(...accounts.dispatcher), login(...accounts.lead)]);
  await api("POST", "/simulation/reset", { token: dispatcher.accessToken });
});
after(shutdown);

describe("Challenge Drop #3 — SOS flood / spam attack", () => {
  test("600 fake SOS + 20 genuine: limits and duplicate filter work, all genuine accepted, avg < 300 ms, dispatcher not flooded", async () => {
    const r = await api("POST", "/simulation/sos-flood", { token: dispatcher.accessToken, body: { attack: 600, genuine: 20 } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const rep = r.data.report;
    console.log("    flood report:", JSON.stringify({ attack: rep.attack, genuine: rep.genuine, latency: rep.latency, genuineFailures: rep.genuineFailures }));

    assert.equal(rep.attack.sent, 600);
    assert.ok(rep.attack.rateLimited > 0, "rate limiter answered 429");
    assert.ok(rep.attack.duplicatesMerged > 0, "duplicates were filtered");
    assert.ok(rep.attack.spamFlagged > 0, "spam detected");
    assert.equal(rep.genuine.accepted, rep.genuine.sent, "every genuine SOS got through");
    assert.equal(rep.errors, 0, "no 5xx / crashes");
    assert.ok(rep.latency.avgMs < 300, `average latency ${rep.latency.avgMs} ms`);

    // Dispatcher queue contains no spam-flagged SOS
    const queue = (await api("GET", "/dispatcher/sos/queue", { token: dispatcher.accessToken })).data.queue;
    assert.ok(queue.every((s) => !s.spamFlagged));
  });

  test("brigade dispatch is protected by JWT + RBAC", async () => {
    const id = "000000000000000000000000";
    assert.equal((await api("POST", `/dispatcher/sos/${id}/assign`)).status, 401, "no token");
    assert.equal((await api("POST", `/dispatcher/sos/${id}/assign`, { token: "forged.jwt.token" })).status, 401, "bad token");
    assert.equal((await api("POST", `/dispatcher/sos/${id}/assign`, { token: lead.accessToken })).status, 403, "brigade lead lacks sos:assign");
    assert.equal((await api("POST", `/dispatcher/alerts/${id}/approve`, { token: lead.accessToken })).status, 403, "brigade lead lacks alert:decide");
    // A citizen device id is not a credential
    assert.equal((await api("POST", `/dispatcher/sos/${id}/assign`, { headers: { "X-Device-Id": uuid() } })).status, 401);
  });
});

describe("Challenge Drop #1 — limited-mobility role, Priority #1, barrier-free route", () => {
  test("the role exists in RBAC and is assigned from the profile", async () => {
    const roles = (await api("GET", "/admin/roles", { token: admin.accessToken })).data.roles;
    assert.ok(roles.priority_citizen, "priority_citizen role in rbac.json");
    assert.ok(roles.priority_citizen.permissions.includes("sos:priority"));

    const deviceId = uuid();
    const saved = await api("PUT", "/citizen/profile", { body: { deviceId, accessibility: { wheelchair: true } } });
    assert.equal(saved.data.profile.role, "priority_citizen");

    // SOS → Priority #1 automatically
    const sos = await api("POST", "/citizen/sos", { body: { clientId: uuid(), deviceId, type: "general", ...YASAMAL } });
    assert.equal(sos.data.sos.priorityOne, true);
    assert.ok(sos.data.sos.priority >= 1000);

    // Only a barrier-free route is assigned
    const plan = (await api("GET", `/citizen/evacuation?lat=40.395&lng=49.845&deviceId=${deviceId}`)).data;
    assert.equal(plan.routing.accessible, true);
    assert.equal(plan.recommended.shelter.accessible, true);

    // Removing the flag removes the role
    const back = await api("PUT", "/citizen/profile", { body: { deviceId, accessibility: { wheelchair: false, limitedMobility: false } } });
    assert.equal(back.data.profile.role, "citizen");
  });
});

describe("Challenge Drop #2 — external routing API down", () => {
  const plan = () => api("GET", `/citizen/evacuation?lat=${YASAMAL.lat}&lng=${YASAMAL.lng}`);

  test("HTTP 503 → no crash, local graph route, flagged as backup mode", async () => {
    const { RouteService } = await import("#services");
    RouteService.resetBreakers();
    fakeRouting.mode = "503";
    const r = await plan();
    assert.equal(r.status, 200);
    assert.equal(r.data.routing.provider, "graph");
    assert.equal(r.data.routing.fallback, true);
    assert.ok(r.data.recommended.route.distanceMeters > 0);
  });

  test("answer slower than 5 s → timeout, user still served quickly", async () => {
    const { RouteService } = await import("#services");
    RouteService.resetBreakers();
    fakeRouting.mode = "slow";
    const t0 = Date.now();
    const r = await plan();
    const ms = Date.now() - t0;
    assert.equal(r.status, 200);
    assert.equal(r.data.routing.fallback, true);
    assert.ok(ms < 4000, `answered in ${ms} ms (external timeout is shorter than 5 s)`);
  });

  test("circuit breaker opens: further requests skip the dead API instantly", async () => {
    fakeRouting.mode = "503";
    for (let i = 0; i < 3; i++) await plan();
    const status = (await api("GET", "/simulation/routing-outage", { token: dispatcher.accessToken })).data.routing;
    assert.equal(status.external.breaker.state, "open");
    const hits = fakeRouting.hits;
    const r = await plan();
    assert.equal(r.data.routing.fallback, true);
    assert.equal(fakeRouting.hits, hits, "no call to the external API while the circuit is open");
    fakeRouting.mode = "ok";
  });
});
