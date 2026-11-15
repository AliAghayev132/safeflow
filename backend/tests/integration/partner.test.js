import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  boot,
  shutdown,
  api,
  login,
  accounts,
  sendSos,
  waitFor,
  sleep,
  BASE,
  ORIGIN,
} from "./helpers.js";
import { verifySignature } from "#modules/partner/core/signing.js";
import { findForbiddenKeys } from "#modules/partner/core/serializers.js";

const { io } = await import("socket.io-client");

let admin, dispatcher;
const clients = {};

const tokenRequest = (body, { basic, contentType = "form", headers = {} } = {}) => {
  const h = { ...headers };
  let payload;
  if (contentType === "form") {
    h["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(body).toString();
  } else {
    h["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  if (basic) h.Authorization = `Basic ${Buffer.from(`${basic.id}:${basic.secret}`).toString("base64")}`;
  return fetch(`${BASE}/partner/v1/oauth/token`, { method: "POST", headers: h, body: payload }).then(
    async (r) => ({ status: r.status, headers: r.headers, body: await r.json().catch(() => ({})) }),
  );
};

const partnerGet = (path, token, headers = {}) =>
  fetch(`${BASE}/partner/v1${path}`, { headers: { Authorization: `Bearer ${token}`, ...headers } }).then(
    async (r) => ({ status: r.status, headers: r.headers, body: await r.json().catch(() => ({})) }),
  );

const partnerPost = (path, token, body) =>
  fetch(`${BASE}/partner/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const createClient = async (body) => {
  const r = await api("POST", "/partner/admin/clients", { token: admin.accessToken, body });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { ...r.data.client, secret: r.data.clientSecret };
};

const getToken = async (client, scope) => {
  const r = await tokenRequest({
    grant_type: "client_credentials",
    client_id: client.clientId,
    client_secret: client.secret,
    ...(scope ? { scope } : {}),
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.access_token;
};

before(async () => {
  await boot();
  [admin, dispatcher] = await Promise.all([login(...accounts.admin), login(...accounts.dispatcher)]);
  clients.full = await createClient({
    name: "Təcili Tibbi Yardım",
    type: "ambulance",
    scopes: ["incidents:read", "assembly_points:read", "roads:read", "requests:write"],
    rateLimitPerMin: 1000,
  });
  clients.roadsOnly = await createClient({ name: "Bələdiyyə", type: "municipality", scopes: ["roads:read"], rateLimitPerMin: 1000 });
  clients.throttled = await createClient({ name: "Polis", type: "police", scopes: ["roads:read"], rateLimitPerMin: 3 });
  clients.mtls = await createClient({
    name: "Ordu",
    type: "army",
    scopes: ["incidents:read"],
    requireMtls: true,
    certFingerprints: ["AB:CD:EF:01"],
  });
});

after(shutdown);

describe("Partner RBAC (admin side)", () => {
  test("dispatcher cannot manage partners; admin can", async () => {
    assert.equal((await api("GET", "/partner/admin/clients", { token: dispatcher.accessToken })).status, 403);
    assert.equal((await api("GET", "/partner/admin/clients", { token: admin.accessToken })).status, 200);
    assert.equal((await api("GET", "/partner/admin/clients")).status, 401);
  });

  test("client list never contains secrets", async () => {
    const r = await api("GET", "/partner/admin/clients", { token: admin.accessToken });
    const json = JSON.stringify(r.data);
    assert.ok(!json.includes("secretHash") && !json.includes(clients.full.secret));
  });
});

describe("OAuth2 client credentials", () => {
  test("form body, JSON body and HTTP Basic all issue a scoped bearer token", async () => {
    const form = await tokenRequest({ grant_type: "client_credentials", client_id: clients.full.clientId, client_secret: clients.full.secret });
    assert.equal(form.status, 200);
    assert.equal(form.body.token_type, "Bearer");
    assert.ok(form.body.expires_in > 0);
    assert.equal(form.headers.get("cache-control"), "no-store");

    const json = await tokenRequest(
      { grant_type: "client_credentials", client_id: clients.full.clientId, client_secret: clients.full.secret, scope: "roads:read" },
      { contentType: "json" },
    );
    assert.equal(json.status, 200);
    assert.equal(json.body.scope, "roads:read");

    const basic = await tokenRequest({ grant_type: "client_credentials" }, { basic: { id: clients.full.clientId, secret: clients.full.secret } });
    assert.equal(basic.status, 200);

    const me = await partnerGet("/me", basic.body.access_token);
    assert.equal(me.status, 200);
    assert.equal(me.body.clientId, clients.full.clientId);
  });

  test("wrong secret → 401 invalid_client; bad grant → 400; foreign scope → 400 invalid_scope", async () => {
    const wrong = await tokenRequest({ grant_type: "client_credentials", client_id: clients.full.clientId, client_secret: "nope" });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.error, "invalid_client");

    const grant = await tokenRequest({ grant_type: "password", client_id: clients.full.clientId, client_secret: clients.full.secret });
    assert.equal(grant.status, 400);
    assert.equal(grant.body.error, "unsupported_grant_type");

    const scope = await tokenRequest({ grant_type: "client_credentials", client_id: clients.roadsOnly.clientId, client_secret: clients.roadsOnly.secret, scope: "incidents:read" });
    assert.equal(scope.status, 400);
    assert.equal(scope.body.error, "invalid_scope");
  });

  test("a staff token is not accepted by the Partner API (separate key/audience)", async () => {
    const r = await partnerGet("/roads", admin.accessToken);
    assert.equal(r.status, 401);
    assert.equal(r.body.error, "invalid_token");
  });
});

describe("Scopes and data minimisation", () => {
  test("missing scope → 403 insufficient_scope", async () => {
    const token = await getToken(clients.roadsOnly);
    const r = await partnerGet("/incidents", token);
    assert.equal(r.status, 403);
    assert.equal(r.body.error, "insufficient_scope");
    assert.equal((await partnerGet("/roads", token)).status, 200);
  });

  test("responses never contain citizen personal data", async () => {
    // Other integration files share this server — start from a clean city
    await sleep(250);
    await api("POST", "/simulation/reset", { token: dispatcher.accessToken });
    await sleep(150);
    for (let i = 0; i < 4; i++) await sendSos({ type: "collapse", note: "Adım Əli, nömrəm +994501112233" });
    const token = await getToken(clients.full);
    const incidents = await waitFor(async () => {
      const r = await partnerGet("/incidents", token);
      return r.body.incidents?.some((i) => i.kind === "sos_cluster") ? r : null;
    });
    const cluster = incidents.body.incidents.find((i) => i.kind === "sos_cluster");
    assert.ok(cluster.reports >= 4);
    const points = await partnerGet("/assembly-points", token);
    const roads = await partnerGet("/roads", token);
    for (const r of [incidents, points, roads]) {
      assert.equal(r.status, 200);
      assert.deepEqual(findForbiddenKeys(r.body), []);
      assert.ok(!JSON.stringify(r.body).includes("+994501112233"));
    }
  });
});

describe("Partner requests (requests:write)", () => {
  test("submit → crisis center sees it → status update reaches the partner socket", async () => {
    const token = await getToken(clients.full);
    const socket = io(`${ORIGIN}/partner`, { auth: { token }, transports: ["websocket"], forceNew: true, reconnection: false });
    const events = [];
    socket.on("evt", (e) => events.push(e));
    await new Promise((resolve, reject) => {
      socket.on("hello", resolve);
      socket.on("connect_error", reject);
    });

    const created = await partnerPost("/requests", token, {
      type: "resources",
      priority: "urgent",
      title: "Generatorlar lazımdır",
      quantity: 4,
      unit: "ədəd",
      location: { lat: 40.39, lng: 49.84 },
    });
    assert.equal(created.status, 201);
    const id = created.body.request.id;

    const list = await api("GET", "/partner/admin/requests", { token: dispatcher.accessToken });
    assert.ok(list.data.requests.some((r) => r.id === id && r.partner === "Təcili Tibbi Yardım"));

    const upd = await api("PATCH", `/partner/admin/requests/${id}`, {
      token: dispatcher.accessToken,
      body: { status: "in_progress", response: "Yoldadır" },
    });
    assert.equal(upd.status, 200);

    const evt = await waitFor(() => events.find((e) => e.type === "request.updated"));
    assert.equal(evt.data.status, "in_progress");
    assert.deepEqual(findForbiddenKeys(evt.data), []);
    socket.close();

    const own = await partnerGet(`/requests/${id}`, token);
    assert.equal(own.body.request.response, "Yoldadır");
  });

  test("invalid request body → 400 with a partner-style error", async () => {
    const token = await getToken(clients.full);
    const r = await partnerPost("/requests", token, { type: "nonsense", title: "x" });
    assert.equal(r.status, 400);
    assert.equal(r.body.error, "invalid_request");
  });
});

describe("Per-client rate limit", () => {
  test("4th request within a minute for a 3/min client → 429 + Retry-After", async () => {
    const token = await getToken(clients.throttled);
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await partnerGet("/roads", token));
    assert.deepEqual(results.slice(0, 3).map((r) => r.status), [200, 200, 200]);
    assert.equal(results[3].status, 429);
    assert.ok(Number(results[3].headers.get("retry-after")) > 0);
    assert.equal(results[3].body.error, "rate_limited");
    // Other clients unaffected
    assert.equal((await partnerGet("/roads", await getToken(clients.roadsOnly))).status, 200);
  });
});

describe("mTLS (reverse-proxy header mode)", () => {
  const creds = () => ({ grant_type: "client_credentials", client_id: clients.mtls.clientId, client_secret: clients.mtls.secret });

  test("client requiring mTLS without a certificate is rejected", async () => {
    const r = await tokenRequest(creds());
    assert.equal(r.status, 401);
    assert.equal(r.body.error, "invalid_client");
  });

  test("allowed fingerprint from a trusted proxy is accepted (token + API call)", async () => {
    const headers = { "X-Client-Cert-Fingerprint": "ab:cd:ef:01" };
    const t = await tokenRequest(creds(), { headers });
    assert.equal(t.status, 200);
    assert.equal((await partnerGet("/incidents", t.body.access_token, headers)).status, 200);
    // same token without the cert → rejected
    assert.equal((await partnerGet("/incidents", t.body.access_token)).status, 401);
  });

  test("header from an untrusted peer is ignored; unknown fingerprint rejected", async () => {
    const unknown = await tokenRequest(creds(), { headers: { "X-Client-Cert-Fingerprint": "00:11" } });
    assert.equal(unknown.status, 401);

    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { partner: { mtls: { trustedProxies: [] } } } });
    const untrusted = await tokenRequest(creds(), { headers: { "X-Client-Cert-Fingerprint": "AB:CD:EF:01" } });
    assert.equal(untrusted.status, 401);
    await api("PATCH", "/admin/config", {
      token: admin.accessToken,
      body: { partner: { mtls: { trustedProxies: ["127.0.0.1", "::1", "::ffff:127.0.0.1"] } } },
    });
  });
});

describe("Webhooks", () => {
  test("delivered with a valid HMAC signature, retried after a failure, logged", async () => {
    const received = [];
    let calls = 0;
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        calls += 1;
        if (calls === 1) {
          res.writeHead(500).end();
          return;
        }
        received.push({ headers: req.headers, body });
        res.writeHead(200).end("ok");
      });
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${server.address().port}/hook`;

    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { partner: { webhooks: { baseDelayMs: 50 } } } });
    const hook = await api("POST", `/partner/admin/clients/${clients.roadsOnly.id}/webhooks`, {
      token: admin.accessToken,
      body: { url, events: ["road.updated"] },
    });
    assert.equal(hook.status, 201);
    const secret = hook.data.webhook.secret;

    // Not allowed: event outside the client's scopes
    const bad = await api("POST", `/partner/admin/clients/${clients.roadsOnly.id}/webhooks`, {
      token: admin.accessToken,
      body: { url, events: ["incident.created"] },
    });
    assert.equal(bad.status, 400);

    await api("POST", "/simulation/roads/random-close", { token: dispatcher.accessToken });
    const got = await waitFor(() => received[0], 8000);

    assert.equal(got.headers["x-safeflow-event"], "road.updated");
    assert.ok(
      verifySignature({
        secret,
        timestamp: got.headers["x-safeflow-timestamp"],
        body: got.body,
        signature: got.headers["x-safeflow-signature"],
      }),
    );
    const payload = JSON.parse(got.body);
    assert.equal(payload.event, "road.updated");
    assert.equal(payload.data[0].status, "closed");
    assert.deepEqual(findForbiddenKeys(payload), []);

    const log = await waitFor(async () => {
      const r = await api("GET", `/partner/admin/clients/${clients.roadsOnly.id}/deliveries`, { token: admin.accessToken });
      return r.data.deliveries.find((d) => d.status === "delivered");
    });
    assert.equal(log.attempts, 2);
    server.close();
  });
});

describe("Partner WebSocket channel", () => {
  test("scoped rooms: roads-only client gets road events, not incidents", async () => {
    const token = await getToken(clients.roadsOnly);
    const socket = io(`${ORIGIN}/partner`, { auth: { token }, transports: ["websocket"], forceNew: true, reconnection: false });
    const events = [];
    socket.on("evt", (e) => events.push(e));
    await new Promise((resolve, reject) => {
      socket.on("hello", resolve);
      socket.on("connect_error", reject);
    });

    await api("POST", "/simulation/reset", { token: dispatcher.accessToken });
    await sleep(150);
    for (let i = 0; i < 4; i++) await sendSos({ type: "fire" });
    await api("POST", "/simulation/roads/random-close", { token: dispatcher.accessToken });
    await waitFor(() => events.find((e) => e.type === "road.updated"));
    await sleep(300);
    assert.equal(events.some((e) => e.type.startsWith("incident.")), false);
    socket.close();
  });

  test("invalid partner token is rejected at the handshake", async () => {
    const socket = io(`${ORIGIN}/partner`, { auth: { token: admin.accessToken }, transports: ["websocket"], forceNew: true, reconnection: false });
    const err = await new Promise((resolve) => socket.on("connect_error", resolve));
    assert.match(err.message, /invalid_token|access_denied/);
    socket.close();
  });
});

describe("Suspend / rotate and audit", () => {
  test("suspended client: live token revoked and no new token", async () => {
    const victim = await createClient({ name: "Test qurum", scopes: ["roads:read"] });
    const token = await getToken(victim);
    assert.equal((await partnerGet("/roads", token)).status, 200);

    const s = await api("POST", `/partner/admin/clients/${victim.id}/status`, { token: admin.accessToken, body: { status: "suspended" } });
    assert.equal(s.data.client.status, "suspended");
    assert.ok([401, 403].includes((await partnerGet("/roads", token)).status));
    const t = await tokenRequest({ grant_type: "client_credentials", client_id: victim.clientId, client_secret: victim.secret });
    assert.equal(t.status, 401);

    await api("POST", `/partner/admin/clients/${victim.id}/status`, { token: admin.accessToken, body: { status: "active" } });
    const rotated = await api("POST", `/partner/admin/clients/${victim.id}/rotate-secret`, { token: admin.accessToken });
    const old = await tokenRequest({ grant_type: "client_credentials", client_id: victim.clientId, client_secret: victim.secret });
    assert.equal(old.status, 401);
    const fresh = await tokenRequest({ grant_type: "client_credentials", client_id: victim.clientId, client_secret: rotated.data.clientSecret });
    assert.equal(fresh.status, 200);
  });

  test("limited client: read-only scopes", async () => {
    const c = await createClient({ name: "Limitli", scopes: ["roads:read", "requests:write"] });
    await api("POST", `/partner/admin/clients/${c.id}/status`, { token: admin.accessToken, body: { status: "limited" } });
    const t = await tokenRequest({ grant_type: "client_credentials", client_id: c.clientId, client_secret: c.secret });
    assert.equal(t.body.scope, "roads:read");
  });

  test("every partner request is in the audit log (who, when, which endpoint)", async () => {
    const r = await api("GET", `/partner/admin/clients/${clients.full.id}/activity`, { token: admin.accessToken });
    const entries = r.data.entries;
    const call = entries.find((e) => e.action === "partner.request" && e.details.path.endsWith("/assembly-points"));
    assert.ok(call, "assembly-points call audited");
    assert.equal(call.actor.role, "partner");
    assert.equal(call.actor.username, `partner:${clients.full.clientId}`);
    assert.ok(call.at);
    assert.ok(entries.some((e) => e.action === "partner.token_issued"));
  });
});

describe("Feature flag", () => {
  test("partnerApi off → Partner API answers 404", async () => {
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { features: { partnerApi: false } } });
    const r = await tokenRequest({ grant_type: "client_credentials", client_id: clients.full.clientId, client_secret: clients.full.secret });
    assert.equal(r.status, 404);
    assert.equal((await api("GET", "/partner/admin/clients", { token: admin.accessToken })).status, 404);
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { features: { partnerApi: true } } });
    const back = await tokenRequest({ grant_type: "client_credentials", client_id: clients.full.clientId, client_secret: clients.full.secret });
    assert.equal(back.status, 200);
  });

  test("OpenAPI document is served", async () => {
    const r = await fetch(`${BASE}/partner/v1/openapi.json`).then((x) => x.json());
    assert.equal(r.openapi, "3.1.0");
    assert.ok(r.paths["/oauth/token"]);
  });
});
