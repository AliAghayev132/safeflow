/**
 * Edge node end-to-end: a CENTRAL server (in-process) and an EDGE node
 * (separate process, own database) connected through a proxy we can switch
 * off to simulate losing the internet / satellite / radio link.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { boot, shutdown, api, login, accounts, uuid, sleep, waitFor, ORIGIN } from "./helpers.js";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const EDGE_DB = process.env.TEST_EDGE_NODE_MONGODB_URI || "mongodb://localhost:27017/crisis_test_edge_node";

let admin;
let dispatcher;
let node;
let edgeToken;
let edgeProc;
let edgeBase;
let edgeAdminToken;
let proxy;
const link = { online: false };

const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

/** Link between edge and center: forwards when online, drops when offline. */
const startProxy = (target) =>
  new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (!link.online) {
        req.socket.destroy();
        return;
      }
      const up = http.request(`${target}${req.url}`, { method: req.method, headers: req.headers }, (r) => {
        res.writeHead(r.statusCode, r.headers);
        r.pipe(res);
      });
      up.on("error", () => res.destroy());
      req.pipe(up);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });

const edgeApi = async (method, p, { body, token } = {}) => {
  const res = await fetch(`${edgeBase}/api${p}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json, data: json.data };
};

const syncNow = () => edgeApi("POST", "/edge/v1/local/sync-now?force=1", { token: edgeAdminToken });
const edgeHeaders = (token = edgeToken) => ({ "X-Edge-Token": token });

before(async () => {
  await boot();
  [admin, dispatcher] = await Promise.all([login(...accounts.admin), login(...accounts.dispatcher)]);

  const created = await api("POST", "/edge/v1/nodes", {
    token: admin.accessToken,
    body: { nodeId: "edge-sh06", name: "Yasamal Mərkəzi Parkı", shelterCode: "SH-06" },
  });
  assert.equal(created.status, 201);
  node = created.data.node;
  edgeToken = created.data.token;

  proxy = await startProxy(ORIGIN);
  const proxyUrl = `http://127.0.0.1:${proxy.address().port}`;

  // Fresh database for the edge node
  const { mongoose } = await import("#lib");
  const conn = await mongoose.createConnection(EDGE_DB).asPromise();
  await conn.dropDatabase();
  await conn.close();

  // Stand-in for the built citizen PWA served by the node
  const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "edge-app-"));
  fs.writeFileSync(path.join(staticDir, "index.html"), "<!doctype html><title>edge-portal</title>");
  fs.writeFileSync(path.join(staticDir, "app.js"), "console.log(1)");

  const port = await freePort();
  edgeBase = `http://127.0.0.1:${port}`;
  edgeProc = spawn(process.execPath, ["app.js"], {
    cwd: backendDir,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      MONGODB_URI: EDGE_DB,
      ENABLE_BRIGADE_TICKER: "false",
      EDGE_MODE: "true",
      EDGE_NODE_ID: "edge-sh06",
      EDGE_SHELTER_CODE: "SH-06",
      CENTRAL_URL: proxyUrl,
      EDGE_TOKEN: edgeToken,
      EDGE_SYNC_INTERVAL_MS: "600000", // manual sync only in tests
      EDGE_STATIC_DIR: staticDir,
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  edgeProc.stderr.on("data", () => {});
  await waitFor(async () => {
    try {
      return (await fetch(`${edgeBase}/api/health`)).ok;
    } catch {
      return false;
    }
  }, 30000, 250);

  edgeAdminToken = (await edgeApi("POST", "/auth/login", { body: { username: "admin", password: "Admin123!" } })).data
    .accessToken;
});

after(async () => {
  edgeProc?.kill();
  await new Promise((r) => proxy?.close(r));
  await shutdown();
});

describe("Edge node registry (center, RBAC)", () => {
  test("token is returned once and stored hashed; dispatcher can list, not create", async () => {
    assert.match(edgeToken, /^edge_/);
    const list = await api("GET", "/edge/v1/nodes", { token: dispatcher.accessToken });
    assert.equal(list.status, 200);
    assert.equal(list.data.nodes[0].nodeId, "edge-sh06");
    assert.equal(list.data.nodes[0].tokenHash, undefined);
    const create = await api("POST", "/edge/v1/nodes", {
      token: dispatcher.accessToken,
      body: { nodeId: "x-node", name: "X" },
    });
    assert.equal(create.status, 403);
  });

  test("node endpoints require a valid edge token", async () => {
    assert.equal((await api("GET", "/edge/v1/ping")).status, 401);
    assert.equal((await api("GET", "/edge/v1/ping", { headers: edgeHeaders("edge_wrong") })).status, 401);
    assert.equal((await api("GET", "/edge/v1/ping", { headers: edgeHeaders() })).status, 200);
  });
});

describe("Captive portal (edge mode only)", () => {
  test("OS connectivity probes are redirected to the local app", async () => {
    for (const probe of ["/generate_204", "/hotspot-detect.html", "/connecttest.txt", "/ncsi.txt"]) {
      const r = await fetch(`${edgeBase}${probe}`, { redirect: "manual" });
      assert.equal(r.status, 302, probe);
      assert.match(r.headers.get("location"), /\/$/);
    }
  });

  test("the node serves the citizen app (SPA fallback); /api stays JSON", async () => {
    const home = await fetch(`${edgeBase}/`, { headers: { Accept: "text/html" } });
    assert.equal(home.status, 200);
    assert.match(await home.text(), /edge-portal/);
    const deep = await fetch(`${edgeBase}/evacuation`, { headers: { Accept: "text/html" } });
    assert.match(await deep.text(), /edge-portal/);
    const asset = await fetch(`${edgeBase}/app.js`);
    assert.equal(asset.status, 200);
    const missing = await fetch(`${edgeBase}/api/nope`, { headers: { Accept: "text/html" } });
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).code, "NOT_FOUND");
  });

  test("the central server does not act as a captive portal", async () => {
    const r = await fetch(`${ORIGIN}/generate_204`, { redirect: "manual" });
    assert.equal(r.status, 404);
  });

  test("edge reports edge mode; center does not", async () => {
    assert.equal((await edgeApi("GET", "/edge/v1/info")).data.edgeMode, true);
    assert.equal((await api("GET", "/edge/v1/info")).data.edgeMode, false);
  });
});

describe("Offline operation and store-and-forward sync", () => {
  const clientId = uuid();
  const deviceId = uuid();
  const sos = { clientId, deviceId, type: "medical", lat: 40.39, lng: 49.81, headcount: 2 };

  test("with the link down the node still accepts SOS (idempotent) and queues it", async () => {
    link.online = false;
    const a = await edgeApi("POST", "/citizen/sos", { body: sos });
    const b = await edgeApi("POST", "/citizen/sos", { body: sos });
    assert.equal(a.status, 201);
    assert.equal(b.status, 200);

    const r = await syncNow();
    assert.equal(r.data.result.online, false);
    const info = (await edgeApi("GET", "/edge/v1/info")).data;
    assert.equal(info.centralOnline, false);
    assert.ok(info.pending >= 1);
  });

  test("link back → queued SOS reaches the center exactly once", async () => {
    link.online = true;
    const r = await syncNow();
    assert.equal(r.data.result.online, true);
    assert.ok(r.data.result.pushed >= 1);

    const queue = (await api("GET", "/dispatcher/sos/queue", { token: dispatcher.accessToken })).data.queue;
    const mine = queue.filter((s) => s.clientId === clientId);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].queuedOffline, true);
    assert.equal((await edgeApi("GET", "/edge/v1/info")).data.pending, 0);
  });

  test("a re-sent SOS (lost ack) is not stored twice", async () => {
    const item = {
      kind: "sos",
      key: `sos:${clientId}`,
      occurredAt: new Date().toISOString(),
      payload: { clientId, deviceId, type: "medical", lat: 40.39, lng: 49.81 },
    };
    const r = await api("POST", "/edge/v1/sync", { headers: edgeHeaders(), body: { items: [item, item] } });
    assert.equal(r.status, 200);
    assert.ok(r.data.results.every((x) => x.ok && x.duplicate));
    const queue = (await api("GET", "/dispatcher/sos/queue", { token: dispatcher.accessToken })).data.queue;
    assert.equal(queue.filter((s) => s.clientId === clientId).length, 1);
  });

  test("'I am safe' set on the edge reaches the center", async () => {
    const dev = uuid();
    await edgeApi("PATCH", "/citizen/status", { body: { deviceId: dev, status: "safe" } });
    await syncNow();
    const state = (await api("GET", `/citizen/state?deviceId=${dev}`)).data.state;
    assert.equal(state.status, "safe");
  });

  test("center's shelter occupancy is applied on the node", async () => {
    const shelters = (await api("GET", "/citizen/shelters")).data.shelters;
    const sh = shelters.find((s) => s.code === "SH-06");
    await api("POST", `/simulation/shelters/${sh.id}/occupancy`, { token: dispatcher.accessToken, body: { rate: 0.5 } });
    await syncNow();
    const local = (await edgeApi("GET", "/citizen/shelters")).data.shelters.find((s) => s.code === "SH-06");
    assert.equal(local.occupancy, Math.round(sh.capacity * 0.5));
  });
});

describe("Conflict resolution — latest status wins", () => {
  const push = (items) => api("POST", "/edge/v1/sync", { headers: edgeHeaders(), body: { items } });
  const statusItem = (deviceId, status, at) => ({
    kind: "status",
    key: `status:${deviceId}`,
    occurredAt: at,
    payload: { deviceId, status, at },
  });

  test("an older edge status does not overwrite a newer central one", async () => {
    const dev = uuid();
    await api("PATCH", "/citizen/status", { body: { deviceId: dev, status: "needs_help" } });
    const older = new Date(Date.now() - 60000).toISOString();
    const r = await push([statusItem(dev, "safe", older)]);
    assert.equal(r.data.results[0].applied, false);
    assert.equal(r.data.results[0].reason, "stale");
    assert.equal((await api("GET", `/citizen/state?deviceId=${dev}`)).data.state.status, "needs_help");

    const newer = new Date(Date.now() + 1000).toISOString();
    const r2 = await push([statusItem(dev, "safe", newer)]);
    assert.equal(r2.data.results[0].applied, true);
    assert.equal((await api("GET", `/citizen/state?deviceId=${dev}`)).data.state.status, "safe");
  });

  test("invalid items are rejected individually without blocking the batch", async () => {
    const dev = uuid();
    const r = await push([
      { kind: "status", key: "bad", payload: { deviceId: "nope", status: "safe", at: new Date().toISOString() } },
      statusItem(dev, "evacuating", new Date().toISOString()),
    ]);
    assert.equal(r.data.results[0].ok, false);
    assert.equal(r.data.results[0].permanent, true);
    assert.equal(r.data.results[1].ok, true);
  });

  test("sync activity is audited", async () => {
    const audit = (await api("GET", "/admin/audit?action=edge.sync", { token: admin.accessToken })).data.entries;
    assert.ok(audit.length > 0);
    assert.equal(audit[0].actor.username, "edge:edge-sh06");
  });
});

describe("Node revocation and feature flag", () => {
  test("node health is visible to the dispatcher", async () => {
    const n = (await api("GET", "/edge/v1/nodes", { token: dispatcher.accessToken })).data.nodes[0];
    // The previous test pushed a deliberately invalid item → "degraded" with
    // the error visible; a clean ping/sync brings it back to "online".
    assert.equal(n.health, "degraded");
    assert.match(n.lastError, /failed/);
    assert.ok(n.stats.sos >= 1);
    await api("GET", "/edge/v1/ping", { headers: edgeHeaders() });
    const again = (await api("GET", "/edge/v1/nodes", { token: dispatcher.accessToken })).data.nodes[0];
    assert.equal(again.health, "online");
  });

  test("a revoked node can no longer sync", async () => {
    const r = await api("POST", `/edge/v1/nodes/${node.id}/revoke`, { token: admin.accessToken });
    assert.equal(r.data.node.status, "revoked");
    assert.equal((await api("GET", "/edge/v1/ping", { headers: edgeHeaders() })).status, 401);
    const s = await syncNow();
    assert.equal(s.data.result.online, false);
  });

  test("flag off → edge API answers 404 FEATURE_DISABLED", async () => {
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { features: { edgeNode: false } } });
    const r = await api("GET", "/edge/v1/info");
    assert.equal(r.status, 404);
    assert.equal(r.body.code, "FEATURE_DISABLED");
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { features: { edgeNode: true } } });
    assert.equal((await api("GET", "/edge/v1/info")).status, 200);
  });
});

await sleep(0);
