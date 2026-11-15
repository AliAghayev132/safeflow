import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  boot,
  shutdown,
  api,
  login,
  accounts,
  uuid,
  sendSos,
  waitFor,
  sleep,
  connectSocket,
  fakeRouting,
  YASAMAL,
} from "./helpers.js";

let admin, dispatcher, lead;

before(async () => {
  await boot();
  [admin, dispatcher, lead] = await Promise.all([
    login(...accounts.admin),
    login(...accounts.dispatcher),
    login(...accounts.lead),
  ]);
});

after(shutdown);

const activeClusterAlerts = async () =>
  (await api("GET", "/dispatcher/alerts?status=active", { token: dispatcher.accessToken })).data.alerts.filter(
    (a) => a.type === "sos_cluster",
  );

// Reset the simulated city; give in-flight rule evaluations time to settle.
const resetWorld = async () => {
  await sleep(250);
  await api("POST", "/simulation/reset", { token: dispatcher.accessToken });
  await sleep(100);
};

describe("RBAC — REST", () => {
  test("citizen (no token) cannot reach dispatcher endpoints", async () => {
    assert.equal((await api("GET", "/dispatcher/overview")).status, 401);
    assert.equal((await api("GET", "/dispatcher/sos/queue")).status, 401);
    assert.equal((await api("POST", "/simulation/reset")).status, 401);
  });

  test("a citizen device id is not a staff credential", async () => {
    const r = await api("GET", "/dispatcher/overview", { headers: { "X-Device-Id": uuid() } });
    assert.equal(r.status, 401);
  });

  test("brigade lead cannot decide alerts, assign SOS or edit config", async () => {
    const t = lead.accessToken;
    assert.equal((await api("POST", "/dispatcher/alerts/000000000000000000000000/approve", { token: t })).status, 403);
    assert.equal((await api("POST", "/dispatcher/sos/000000000000000000000000/assign", { token: t })).status, 403);
    assert.equal((await api("PATCH", "/admin/config", { token: t, body: {} })).status, 403);
    assert.equal((await api("GET", "/dispatcher/overview", { token: t })).status, 200);
  });

  test("brigade lead may only update their own brigade", async () => {
    const overview = (await api("GET", "/dispatcher/overview", { token: dispatcher.accessToken })).data;
    const own = overview.brigades.find((b) => b.id === lead.operator.brigade);
    const other = overview.brigades.find((b) => b.id !== lead.operator.brigade);
    assert.equal(
      (await api("PATCH", `/dispatcher/brigades/${other.id}/status`, { token: lead.accessToken, body: { status: "on_scene" } })).status,
      403,
    );
    assert.equal(
      (await api("PATCH", `/dispatcher/brigades/${own.id}/status`, { token: lead.accessToken, body: { status: "available" } })).status,
      200,
    );
  });

  test("dispatcher cannot change config; admin can", async () => {
    assert.equal((await api("PATCH", "/admin/config", { token: dispatcher.accessToken, body: {} })).status, 403);
    const r = await api("PATCH", "/admin/config", { token: admin.accessToken, body: { triage: { autoAssignMinScore: 40 } } });
    assert.equal(r.status, 200);
  });

  test("login returns permissions from config/rbac.json", () => {
    assert.ok(admin.permissions.includes("config:manage"));
    assert.ok(admin.permissions.includes("alert:decide")); // inherited from dispatcher
    assert.ok(!dispatcher.permissions.includes("config:manage"));
    assert.ok(lead.permissions.includes("brigade:update_own"));
  });
});

describe("RBAC — WebSocket channels", () => {
  test("citizen sockets don't receive other citizens' SOS; dispatchers do", async () => {
    const citizen = await connectSocket({ client: "citizen", deviceId: uuid() });
    const staff = await connectSocket({ client: "operator", token: dispatcher.accessToken });
    assert.ok(!citizen.hello.channels.includes("sos"));
    assert.ok(staff.hello.channels.includes("sos"));

    await sendSos({ type: "medical", ...YASAMAL });
    await waitFor(() => staff.events.some((e) => e.type === "sos:new"));
    await sleep(150);
    assert.equal(citizen.events.some((e) => e.type === "sos:new"), false);
    citizen.close();
    staff.close();
  });

  test("invalid token is rejected at handshake", async () => {
    await assert.rejects(connectSocket({ client: "operator", token: "nope" }));
  });
});

describe("SOS idempotency", () => {
  test("the same clientId twice creates one ticket", async () => {
    const clientId = uuid();
    const deviceId = uuid();
    const a = await sendSos({ clientId, deviceId, type: "fire" });
    const b = await sendSos({ clientId, deviceId, type: "fire" });
    assert.equal(a.status, 201);
    assert.equal(b.status, 200);
    assert.equal(b.data.reason, "idempotent_replay");
    assert.equal(a.data.sos.id, b.data.sos.id);
  });

  test("concurrent retries with one clientId still yield one ticket", async () => {
    const clientId = uuid();
    const deviceId = uuid();
    const results = await Promise.all([1, 2, 3, 4].map(() => sendSos({ clientId, deviceId, type: "flood" })));
    const ids = new Set(results.map((r) => r.data.sos.id));
    assert.equal(ids.size, 1);
    assert.equal(results.filter((r) => r.status === 201).length, 1);
  });

  test("repeated taps from one device are merged, not rejected", async () => {
    const deviceId = uuid();
    const a = await sendSos({ deviceId, type: "medical" });
    const b = await sendSos({ deviceId, type: "medical", headcount: 3 });
    assert.equal(b.status, 200);
    assert.equal(b.data.reason, "merged_repeat");
    assert.equal(a.data.sos.id, b.data.sos.id);
    assert.equal(b.data.sos.headcount, 3);
  });
});

describe("Cluster rule end-to-end (API + rule engine + DB)", () => {
  test("4 distinct devices → exactly one alert; a 5th updates it", async () => {
    await resetWorld();
    for (let i = 0; i < 4; i++) await sendSos();
    const alerts = await waitFor(async () => {
      const list = await activeClusterAlerts();
      return list.length ? list : null;
    });
    assert.equal(alerts.length, 1);
    await sendSos();
    // signalCount is recomputed in a coalesced (≤1/s) update
    const after = await waitFor(async () => {
      const list = await activeClusterAlerts();
      return list[0]?.signalCount >= 5 ? list : null;
    });
    assert.equal(after.length, 1);
  });

  test("3 distinct devices → no alert", async () => {
    await resetWorld();
    for (let i = 0; i < 3; i++) await sendSos();
    await sleep(400);
    assert.equal((await activeClusterAlerts()).length, 0);
  });

  test("one device pressing 4 times (4 tickets) → no alert", async () => {
    await resetWorld();
    const deviceId = uuid();
    for (const type of ["fire", "flood", "medical", "general"]) await sendSos({ deviceId, type });
    await sleep(400);
    assert.equal((await activeClusterAlerts()).length, 0);
  });

  test("'I am safe' removes the citizen from the count", async () => {
    await resetWorld();
    const safeDevice = uuid();
    await sendSos();
    await sendSos();
    await sendSos({ deviceId: safeDevice });
    await api("PATCH", "/citizen/status", { body: { deviceId: safeDevice, status: "safe" } });
    await sendSos();
    await sleep(400);
    assert.equal((await activeClusterAlerts()).length, 0);
  });
});

describe("Triage + one-click assignment + audit", () => {
  test("priority ranks medical/vulnerable first and Confirm dispatches", async () => {
    await resetWorld();
    await sendSos({ type: "flood", lat: 40.42, lng: 49.89 });
    const urgent = await sendSos({
      type: "medical",
      lat: 40.4,
      lng: 49.86,
      headcount: 4,
      vulnerable: { child: true, elderly: true },
    });
    const queue = (await api("GET", "/dispatcher/sos/queue", { token: dispatcher.accessToken })).data.queue;
    assert.equal(queue[0].id, urgent.data.sos.id);
    assert.ok(queue[0].recommendedBrigade, "high priority gets a recommended brigade");

    const r = await api("POST", `/dispatcher/sos/${urgent.data.sos.id}/assign`, { token: dispatcher.accessToken });
    assert.equal(r.status, 200);
    assert.equal(r.data.sos.status, "assigned");

    const audit = (await api("GET", "/admin/audit?action=sos.assign", { token: admin.accessToken })).data.entries;
    assert.ok(audit.some((e) => e.target.id === urgent.data.sos.id && e.actor.username === "dispatcher"));
  });

  test("audit log is append-only at the model level", async () => {
    const { AuditLog } = await import("#models");
    await assert.rejects(AuditLog.updateMany({}, { $set: { action: "tampered" } }), /append-only/);
    await assert.rejects(AuditLog.deleteMany({}), /append-only/);
  });
});

describe("Shelter thresholds via API", () => {
  test("95% raises one overload alert; 89% does not", async () => {
    await resetWorld();
    const shelters = (await api("GET", "/citizen/shelters")).data.shelters;
    const s = shelters[0];
    await api("POST", `/simulation/shelters/${s.id}/occupancy`, { token: dispatcher.accessToken, body: { rate: 0.89 } });
    await sleep(300);
    let alerts = (await api("GET", "/dispatcher/alerts?status=active", { token: dispatcher.accessToken })).data.alerts;
    assert.equal(alerts.filter((a) => a.type === "shelter_overload").length, 0);

    await api("POST", `/simulation/shelters/${s.id}/occupancy`, { token: dispatcher.accessToken, body: { rate: 0.95 } });
    await api("POST", `/simulation/shelters/${s.id}/occupancy`, { token: dispatcher.accessToken, body: { rate: 0.97 } });
    alerts = await waitFor(async () => {
      const list = (await api("GET", "/dispatcher/alerts?status=active", { token: dispatcher.accessToken })).data.alerts;
      return list.some((a) => a.type === "shelter_overload") ? list : null;
    });
    assert.equal(alerts.filter((a) => a.type === "shelter_overload").length, 1);
  });
});

describe("Routing fallback chain", () => {
  const plan = () => api("GET", `/citizen/evacuation?lat=${YASAMAL.lat}&lng=${YASAMAL.lng}`);

  test("external API answers → provider external", async () => {
    fakeRouting.mode = "ok";
    const { RouteService } = await import("#services");
    RouteService.resetBreakers();
    const r = await plan();
    assert.equal(r.data.routing.provider, "external");
    assert.equal(r.data.routing.approximate, false);
  });

  test("external fails → simulated graph, flagged as fallback", async () => {
    fakeRouting.mode = "error";
    const r = await plan();
    assert.equal(r.data.routing.provider, "graph");
    assert.equal(r.data.routing.fallback, true);
  });

  test("circuit opens after repeated failures — no more calls to the external API", async () => {
    fakeRouting.mode = "error";
    await plan();
    const status = (await api("GET", "/admin/system", { token: admin.accessToken })).data.routing.external.breaker;
    assert.equal(status.state, "open");
    const hits = fakeRouting.hits;
    await plan();
    assert.equal(fakeRouting.hits, hits, "breaker open → external not called");
  });

  test("graph unavailable → straight line with direction, marked approximate", async () => {
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { routing: { providers: ["external", "straight"] } } });
    const r = await plan();
    assert.equal(r.data.routing.provider, "straight");
    assert.equal(r.data.routing.approximate, true);
    assert.ok(Number.isFinite(r.data.recommended.route.bearing));
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { routing: { providers: ["external", "graph", "straight"] } } });
  });

  test("a hanging external API is cut by the timeout", async () => {
    const { RouteService } = await import("#services");
    RouteService.resetBreakers();
    fakeRouting.mode = "hang";
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { routing: { external: { timeoutMs: 200 } } } });
    const started = Date.now();
    const r = await plan();
    assert.equal(r.status, 200);
    assert.ok(Date.now() - started < 4000);
    assert.notEqual(r.data.routing.provider, "external");
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { routing: { external: { timeoutMs: 1500 } } } });
  });
});

describe("Rate limiting", () => {
  test("SOS flood from one device → 429 with Retry-After", async () => {
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { rateLimits: { "sos.create": { device: 3 } } } });
    const deviceId = uuid();
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await sendSos({ deviceId, type: ["fire", "flood", "medical", "collapse", "general"][i] }));
    const limited = results.filter((r) => r.status === 429);
    assert.ok(limited.length >= 1);
    assert.ok(Number(limited[0].headers.get("retry-after")) > 0);
    assert.equal(limited[0].body.code, "RATE_LIMITED");
    // other devices are unaffected
    assert.equal((await sendSos({ type: "fire" })).status, 201);
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { rateLimits: { "sos.create": { device: 20 } } } });
  });
});

describe("Realtime replay (missed events) + polling fallback", () => {
  test("after a disconnect, `sync` returns the events that were missed", async () => {
    const s1 = await connectSocket({ client: "operator", token: dispatcher.accessToken });
    await sendSos({ type: "fire" });
    await waitFor(() => s1.events.length > 0);
    const lastSeq = s1.events.at(-1).seq;
    const epoch = s1.events.at(-1).epoch;
    s1.close();

    const missed = await sendSos({ type: "medical" });

    const s2 = await connectSocket({ client: "operator", token: dispatcher.accessToken });
    const replay = await new Promise((resolve) => s2.emit("sync", { afterSeq: lastSeq, epoch }, resolve));
    assert.equal(replay.resync, false);
    assert.ok(replay.events.some((e) => e.type === "sos:new" && e.data.id === missed.data.sos.id));
    s2.close();
  });

  test("polling endpoint returns the same events, filtered by permission", async () => {
    const deviceId = uuid();
    const before = (await api("GET", "/events?after=0", { token: dispatcher.accessToken })).data.lastSeq;
    const mine = await sendSos({ deviceId, type: "fire" });
    await sendSos({ type: "flood" });
    const staff = (await api("GET", `/events?after=${before}`, { token: dispatcher.accessToken })).data;
    assert.ok(staff.events.filter((e) => e.type === "sos:new").length >= 2);

    await api("PATCH", `/citizen/sos/${mine.data.sos.clientId}`, { body: { deviceId, headcount: 2 } });
    const citizen = (await api("GET", `/events?after=${before}&deviceId=${deviceId}`)).data;
    assert.equal(citizen.events.some((e) => e.type === "sos:new"), false, "no other citizens' SOS");
    assert.ok(citizen.events.every((e) => e.type !== "sos:updated" || e.data.deviceId === deviceId));
  });

  test("unknown epoch → resync", async () => {
    const r = (await api("GET", "/events?after=1&epoch=old", { token: dispatcher.accessToken })).data;
    assert.equal(r.resync, true);
  });
});

describe("Limited mobility: Priority #1 + barrier-free evacuation", () => {
  const wheelchairUser = async () => {
    const deviceId = uuid();
    await api("PUT", "/citizen/profile", {
      body: { deviceId, accessibility: { wheelchair: true, limitedMobility: true } },
    });
    return deviceId;
  };

  test("profile flag makes the SOS Priority #1 — top of the queue with a brigade", async () => {
    await resetWorld();
    await sendSos({ type: "medical", headcount: 10, vulnerable: { elderly: true, child: true } });
    const deviceId = await wheelchairUser();
    const vip = await sendSos({ deviceId, type: "flood" });
    assert.equal(vip.data.sos.priorityOne, true);
    assert.equal(vip.data.sos.accessibility.wheelchair, true);
    const queue = (await api("GET", "/dispatcher/sos/queue", { token: dispatcher.accessToken })).data.queue;
    assert.equal(queue[0].id, vip.data.sos.id);
    assert.ok(queue[0].recommendedBrigade);
  });

  test("evacuation plan is barrier-free: no stairs/steep segments, step-free shelter", async () => {
    await resetWorld();
    const deviceId = await wheelchairUser();
    const plan = (await api("GET", `/citizen/evacuation?lat=40.395&lng=49.845&deviceId=${deviceId}`)).data;
    assert.equal(plan.needs.accessible, true);
    assert.equal(plan.routing.accessible, true);
    assert.equal(plan.recommended.shelter.accessible, true);
    const roads = (await api("GET", "/roads")).data.edges;
    const byId = new Map(roads.map((e) => [e.edgeId, e]));
    for (const id of plan.recommended.route.edgeIds) {
      const e = byId.get(id);
      assert.ok(!e.stairs && !e.steepSlope && !e.obstacle && !e.damaged, `barrier on ${id}`);
    }
    // the same request without the profile can use stairs-only shelters
    const anyone = (await api("GET", "/citizen/evacuation?lat=40.395&lng=49.845")).data;
    assert.equal(anyone.needs.accessible, false);
  });

  test("?mode=accessible forces a barrier-free route without a profile", async () => {
    const plan = (await api("GET", "/citizen/evacuation?lat=40.395&lng=49.845&mode=accessible")).data;
    assert.equal(plan.routing.accessible, true);
  });

  test("a new obstacle on the route reroutes only barrier-free travellers", async () => {
    await resetWorld();
    const deviceId = await wheelchairUser();
    const plan = (await api("GET", `/citizen/evacuation?lat=40.395&lng=49.845&deviceId=${deviceId}`)).data;
    const edgeId = plan.recommended.route.edgeIds[1];
    await api("POST", `/simulation/roads/${edgeId}/barrier`, { token: dispatcher.accessToken, body: { kind: "obstacle" } });
    const state = await waitFor(async () => {
      const s = (await api("GET", `/citizen/state?deviceId=${deviceId}`)).data.state;
      return s.route && !s.route.edgeIds.includes(edgeId) ? s : null;
    });
    assert.ok(state.route.edgeIds.length > 0);
  });

  test("smart balancing explains the choice", async () => {
    const plan = (await api("GET", "/citizen/evacuation?lat=40.395&lng=49.845")).data;
    assert.ok(plan.explanation?.key.startsWith("balancing."));
    assert.ok(plan.explanation.text.length > 10);
    assert.ok("pendingArrivals" in plan.recommended.shelter);
  });
});

describe("Feature flags", () => {
  test("public flag map, toggled at runtime by an admin", async () => {
    const before = (await api("GET", "/features")).data.features;
    assert.equal(before.drones, true);
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { features: { drones: false } } });
    assert.equal((await api("GET", "/features")).data.features.drones, false);
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { features: { drones: true } } });
  });

  test("unknown feature flags are rejected", async () => {
    const r = await api("PATCH", "/admin/config", { token: admin.accessToken, body: { features: { nope: true } } });
    assert.equal(r.status, 400);
  });
});

describe("Config rules engine", () => {
  test("rejects unknown keys and wrong types", async () => {
    assert.equal((await api("PATCH", "/admin/config", { token: admin.accessToken, body: { nope: 1 } })).status, 400);
    assert.equal(
      (await api("PATCH", "/admin/config", { token: admin.accessToken, body: { sosCluster: { minSignals: "four" } } })).status,
      400,
    );
  });

  test("threshold change applies without restart", async () => {
    await resetWorld();
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { sosCluster: { minSignals: 2 } } });
    await sendSos();
    await sendSos();
    await waitFor(async () => (await activeClusterAlerts()).length === 1);
    await api("POST", "/admin/config/reset", { token: admin.accessToken });
    const cfg = (await api("GET", "/admin/config", { token: admin.accessToken })).data;
    assert.equal(cfg.effective.sosCluster.minSignals, 4);
  });
});
