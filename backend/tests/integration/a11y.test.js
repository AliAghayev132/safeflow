import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, api, login, accounts, uuid, YASAMAL } from "./helpers.js";

let admin;
const deviceId = uuid();

before(async () => {
  await boot();
  admin = await login(...accounts.admin);
});
after(shutdown);

const issue = (id = deviceId) => api("POST", "/a11y/v1/shortcut-token", { body: { deviceId: id } });
const shortcutSos = (token, { body = {}, key } = {}) =>
  api("POST", "/a11y/v1/sos", {
    body,
    headers: { Authorization: `Bearer ${token}`, ...(key ? { "Idempotency-Key": key } : {}) },
  });

describe("Accessibility module — shortcut token", () => {
  test("issue returns the token once; status shows only a prefix", async () => {
    const r = await issue();
    assert.equal(r.status, 201);
    assert.match(r.data.token.token, /^sfs_/);
    const s = await api("GET", `/a11y/v1/shortcut-token?deviceId=${deviceId}`);
    assert.equal(s.data.token.active, true);
    assert.equal(s.data.token.token, undefined);
    assert.ok(r.data.token.token.startsWith(s.data.token.prefix));
  });

  test("token creation is audited", async () => {
    const audit = (await api("GET", "/admin/audit?action=a11y.shortcut_token.create", { token: admin.accessToken })).data.entries;
    assert.ok(audit.length >= 1);
    assert.ok(!JSON.stringify(audit).includes(deviceId), "full device id is not written to the audit log");
  });

  test("invalid device id is rejected", async () => {
    assert.equal((await issue("nope")).status, 400);
  });
});

describe("Accessibility module — token-authenticated SOS", () => {
  test("given coordinates → SOS created", async () => {
    const { token } = (await issue()).data.token;
    const r = await shortcutSos(token, { body: { ...YASAMAL, type: "medical" } });
    assert.equal(r.status, 201);
    assert.equal(r.data.sos.type, "medical");
    assert.equal(r.data.located, "given");
  });

  test("no coordinates → last known location; default type general", async () => {
    const id = uuid();
    await api("PATCH", "/citizen/status", { body: { deviceId: id, status: "evacuating", lat: 40.41, lng: 49.86 } });
    const { token } = (await issue(id)).data.token;
    const r = await shortcutSos(token);
    assert.equal(r.status, 201);
    assert.equal(r.data.located, "last_known");
    assert.equal(r.data.sos.type, "general");
    assert.ok(Math.abs(r.data.sos.lat - 40.41) < 1e-6);
  });

  test("unknown device location → city centre, flagged", async () => {
    const { token } = (await issue(uuid())).data.token;
    const r = await shortcutSos(token);
    assert.equal(r.data.located, "city_center");
    assert.match(r.data.sos.note, /location_city_center/);
  });

  test("same Idempotency-Key twice → one ticket", async () => {
    const { token } = (await issue(uuid())).data.token;
    const a = await shortcutSos(token, { body: YASAMAL, key: "siri-run-1" });
    const b = await shortcutSos(token, { body: YASAMAL, key: "siri-run-1" });
    assert.equal(a.status, 201);
    assert.equal(b.status, 200);
    assert.equal(a.data.sos.id, b.data.sos.id);
  });

  test("rotated or revoked token → 401", async () => {
    const id = uuid();
    const first = (await issue(id)).data.token.token;
    const second = (await issue(id)).data.token.token;
    assert.equal((await shortcutSos(first)).status, 401, "rotated-out token stops working");
    assert.equal((await shortcutSos(second, { body: YASAMAL })).status, 201);
    await api("DELETE", "/a11y/v1/shortcut-token", { body: { deviceId: id } });
    const r = await shortcutSos(second);
    assert.equal(r.status, 401);
    assert.equal(r.body.code, "SHORTCUT_TOKEN_INVALID");
  });

  test("missing / malformed token → 401", async () => {
    assert.equal((await api("POST", "/a11y/v1/sos", { body: {} })).status, 401);
    assert.equal((await shortcutSos("garbage")).status, 401);
  });

  test("per-token rate limit → 429 + Retry-After", async () => {
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { accessibility: { shortcutRateLimit: { perToken: 2 } } } });
    const { token } = (await issue(uuid())).data.token;
    const types = ["fire", "flood", "medical"];
    const results = [];
    for (const type of types) results.push(await shortcutSos(token, { body: { ...YASAMAL, type } }));
    const limited = results.find((r) => r.status === 429);
    assert.ok(limited, "third call is limited");
    assert.ok(Number(limited.headers.get("retry-after")) > 0);
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { accessibility: { shortcutRateLimit: { perToken: 10 } } } });
  });

  test("feature flag off → 404 FEATURE_DISABLED", async () => {
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { features: { accessibility: false } } });
    const r = await issue();
    assert.equal(r.status, 404);
    assert.equal(r.body.code, "FEATURE_DISABLED");
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { features: { accessibility: true } } });
    assert.equal((await issue()).status, 201);
  });
});
