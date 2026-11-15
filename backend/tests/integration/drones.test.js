import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, api, login, accounts, waitFor } from "./helpers.js";

const { DroneService } = await import("#modules/drones/index.js");

let admin, dispatcher, lead, manager;
let shelters;

before(async () => {
  await boot();
  [admin, dispatcher, lead, manager] = await Promise.all([
    login(...accounts.admin),
    login(...accounts.dispatcher),
    login(...accounts.lead),
    login("manager1", "Manager123!"),
  ]);
  shelters = (await api("GET", "/citizen/shelters")).data.shelters;
});

after(shutdown);

/** Fast-forward the simulated fleet until `fn` is truthy. */
const flyUntil = async (fn, maxSteps = 200) => {
  for (let i = 0; i < maxSteps; i++) {
    await DroneService.provider.tick(30);
    const value = await fn();
    if (value) return value;
  }
  throw new Error("drone never got there");
};

describe("Drones — RBAC", () => {
  test("manager account is a shelter_manager linked to a shelter", () => {
    assert.equal(manager.role, "shelter_manager");
    assert.ok(manager.operator.shelter);
  });

  test("brigade lead has no access to drones", async () => {
    assert.equal((await api("GET", "/drones/fleet", { token: lead.accessToken })).status, 403);
    assert.equal((await api("GET", "/drones/requests", { token: lead.accessToken })).status, 403);
  });

  test("citizens (no token) are rejected", async () => {
    assert.equal((await api("GET", "/drones/fleet")).status, 401);
  });

  test("shelter manager cannot dispatch drones or cancel requests", async () => {
    const t = manager.accessToken;
    assert.equal((await api("POST", "/drones/requests/000000000000000000000000/approve", { token: t })).status, 403);
    assert.equal((await api("POST", "/drones/requests/000000000000000000000000/cancel", { token: t })).status, 403);
  });

  test("shelter manager is scoped to their own shelter", async () => {
    const other = shelters.find((s) => s.id !== manager.operator.shelter);
    const r = await api("POST", "/drones/requests", {
      token: manager.accessToken,
      body: { shelterId: other.id, items: [{ kind: "water", quantity: 10 }] },
    });
    assert.equal(r.status, 201);
    assert.equal(r.data.request.shelter, manager.operator.shelter, "forced to own shelter");

    const list = (await api("GET", "/drones/requests", { token: manager.accessToken })).data.requests;
    assert.ok(list.every((x) => x.shelter === manager.operator.shelter));
  });
});

describe("Drones — need estimation", () => {
  test("estimate follows occupancy and per-person ratios", async () => {
    const r = await api("GET", "/drones/estimate", { token: manager.accessToken });
    assert.equal(r.status, 200);
    const { estimate } = r.data;
    const water = estimate.items.find((i) => i.kind === "water");
    assert.equal(water.quantity, estimate.people * 3);
    assert.ok(estimate.totalKg > 0);
    assert.match(estimate.text, /nəfərə/);
  });

  test("invalid items are rejected", async () => {
    const r = await api("POST", "/drones/requests", {
      token: dispatcher.accessToken,
      body: { shelterId: shelters[0].id, items: [{ kind: "gold", quantity: 1 }] },
    });
    assert.equal(r.status, 400);
  });
});

describe("Drones — full flow: request → approve → arrive → confirm", () => {
  test("one-click dispatch, live ETA, arrival, receipt; audited", async () => {
    const created = await api("POST", "/drones/requests", {
      token: manager.accessToken,
      body: { items: [{ kind: "water", quantity: 15 }, { kind: "first_aid", quantity: 2 }], priority: "urgent" },
    });
    assert.equal(created.status, 201);
    const request = created.data.request;
    assert.equal(request.totalKg, 19);

    const suggestion = await api("GET", `/drones/requests/${request.id}/suggest`, { token: dispatcher.accessToken });
    assert.equal(suggestion.status, 200);
    assert.ok(suggestion.data.best, "a drone is suggested");
    assert.ok(suggestion.data.best.fullLoad);

    const approved = await api("POST", `/drones/requests/${request.id}/approve`, { token: dispatcher.accessToken });
    assert.equal(approved.status, 200);
    assert.equal(approved.data.drone.id, suggestion.data.best.drone.id);
    assert.equal(approved.data.request.status, "in_progress");
    assert.ok(approved.data.delivery.etaSec > 0);
    const deliveryId = approved.data.delivery.id;

    // Not arrived yet → manager cannot confirm
    assert.equal(
      (await api("POST", `/drones/deliveries/${deliveryId}/confirm`, { token: manager.accessToken })).status,
      409,
    );

    // Fly until arrival; the ETA counts down meanwhile
    let lastEta = Infinity;
    await flyUntil(async () => {
      const d = (await api("GET", "/drones/deliveries", { token: manager.accessToken })).data.deliveries.find(
        (x) => x.id === deliveryId,
      );
      if (d.status === "en_route") {
        assert.ok(d.etaSec <= lastEta);
        lastEta = d.etaSec;
      }
      return d.status === "arrived";
    });

    const confirmed = await api("POST", `/drones/deliveries/${deliveryId}/confirm`, { token: manager.accessToken });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.data.delivery.status, "confirmed");
    assert.equal(confirmed.data.request.status, "delivered");

    const audit = (await api("GET", "/admin/audit?limit=50", { token: admin.accessToken })).data.entries.map((e) => e.action);
    for (const action of ["supply.request", "drone.dispatch", "supply.receipt"]) assert.ok(audit.includes(action), action);

    // The drone flies home and recharges back to idle
    const droneId = approved.data.drone.id;
    await flyUntil(async () => {
      const fleet = (await api("GET", "/drones/fleet", { token: dispatcher.accessToken })).data.drones;
      return fleet.find((d) => d.id === droneId).status === "idle";
    }, 400);
  });

  test("a heavy request is split over several trips", async () => {
    const created = await api("POST", "/drones/requests", {
      token: dispatcher.accessToken,
      body: { shelterId: manager.operator.shelter, items: [{ kind: "water", quantity: 100 }] },
    });
    const id = created.data.request.id;
    const first = await api("POST", `/drones/requests/${id}/approve`, { token: dispatcher.accessToken });
    assert.equal(first.status, 200);
    assert.ok(first.data.request.remainingKg > 0, "partial load");
    const second = await api("POST", `/drones/requests/${id}/approve`, { token: dispatcher.accessToken });
    assert.equal(second.status, 200);
    assert.notEqual(second.data.drone.id, first.data.drone.id);
  });
});

describe("Drones — auto proposal rule", () => {
  test("a shelter crossing the occupancy level gets an auto request", async () => {
    const target = shelters.find((s) => s.isActive && s.occupancyRate < 0.5 && s.id !== manager.operator.shelter);
    await api("POST", `/simulation/shelters/${target.id}/occupancy`, { token: dispatcher.accessToken, body: { rate: 0.7 } });
    const auto = await waitFor(async () => {
      const list = (await api("GET", `/drones/requests?shelterId=${target.id}`, { token: dispatcher.accessToken })).data.requests;
      return list.find((r) => r.source === "auto");
    });
    assert.ok(auto.items.length > 0);
    // Another update above the level does not create a second one
    await api("POST", `/simulation/shelters/${target.id}/occupancy`, { token: dispatcher.accessToken, body: { rate: 0.75 } });
    const list = (await api("GET", `/drones/requests?shelterId=${target.id}`, { token: dispatcher.accessToken })).data.requests;
    assert.equal(list.filter((r) => r.source === "auto").length, 1);
  });
});

describe("Drones — feature flag", () => {
  test("flag off → 404 FEATURE_DISABLED, flag on → back", async () => {
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { features: { drones: false } } });
    const off = await api("GET", "/drones/fleet", { token: dispatcher.accessToken });
    assert.equal(off.status, 404);
    assert.equal(off.body.code, "FEATURE_DISABLED");
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { features: { drones: true } } });
    assert.equal((await api("GET", "/drones/fleet", { token: dispatcher.accessToken })).status, 200);
  });

  test("module config section is editable and validated", async () => {
    const ok = await api("PATCH", "/admin/config", {
      token: admin.accessToken,
      body: { drones: { ratios: { waterLitersPerPerson: 4 } } },
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.effective.drones.ratios.waterLitersPerPerson, 4);
    const bad = await api("PATCH", "/admin/config", { token: admin.accessToken, body: { drones: { nope: 1 } } });
    assert.equal(bad.status, 400);
    await api("POST", "/admin/config/reset", { token: admin.accessToken });
  });
});

describe("Drones — simulation reset", () => {
  test("reset parks the fleet and clears missions", async () => {
    await api("POST", "/simulation/reset", { token: dispatcher.accessToken });
    await waitFor(async () => {
      const fleet = (await api("GET", "/drones/fleet", { token: dispatcher.accessToken })).data.drones;
      const reqs = (await api("GET", "/drones/requests", { token: dispatcher.accessToken })).data.requests;
      return fleet.length === 6 && fleet.every((d) => d.status === "idle") && reqs.length === 0;
    });
  });
});
