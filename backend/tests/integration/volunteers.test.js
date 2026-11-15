import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, api, login, accounts, uuid, waitFor, BASE } from "./helpers.js";

let admin, dispatcher, lead, shelter;

const dev = (deviceId) => ({ headers: { "X-Device-Id": deviceId } });
const near = (m) => ({ lat: shelter.lat + m / 111195, lng: shelter.lng });

const register = async (deviceId, { profession = "doctor", at = null, pos = null } = {}) => {
  const r = await api("PUT", "/volunteers/me", { body: { deviceId, profession, consent: true, displayName: "V" } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await api("PATCH", "/volunteers/me/availability", { body: { deviceId, availability: "ready" } });
  const loc = { deviceId };
  if (at) loc.shelterId = at;
  if (pos) Object.assign(loc, pos);
  await api("POST", "/volunteers/me/location", { body: loc });
  return deviceId;
};

const upload = (deviceId, buffer, type, name = "doc") =>
  fetch(`${BASE}/volunteers/me/documents?deviceId=${deviceId}&name=${name}`, {
    method: "POST",
    headers: { "Content-Type": type },
    body: buffer,
  }).then(async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) }));

before(async () => {
  await boot();
  [admin, dispatcher, lead] = await Promise.all([
    login(...accounts.admin),
    login(...accounts.dispatcher),
    login(...accounts.lead),
  ]);
  shelter = (await api("GET", "/citizen/shelters")).data.shelters.find((s) => s.code === "SH-06");
});

after(shutdown);

describe("Volunteers — registration, consent, RBAC", () => {
  test("consent is required to register", async () => {
    const r = await api("PUT", "/volunteers/me", { body: { deviceId: uuid(), profession: "nurse" } });
    assert.equal(r.status, 400);
    assert.equal(r.body.code, "VOLUNTEER_CONSENT_REQUIRED");
  });

  test("a plain citizen cannot read volunteer requests or create them", async () => {
    const citizen = uuid();
    assert.equal((await api("GET", "/volunteers/me/requests", dev(citizen))).status, 403);
    assert.equal((await api("POST", "/volunteers/requests", { body: { deviceId: citizen } })).status, 401);
    assert.equal((await api("GET", "/volunteers", dev(citizen))).status, 401);
  });

  test("registered + consented device becomes a volunteer principal", async () => {
    const v = await register(uuid(), { profession: "electrician" });
    assert.equal((await api("GET", "/volunteers/me/requests", dev(v))).status, 200);
    const me = (await api("GET", "/volunteers/me", dev(v))).data.profile;
    assert.equal(me.verification, "not_required");
  });

  test("brigade lead has no volunteer permissions", async () => {
    assert.equal((await api("GET", "/volunteers", { token: lead.accessToken })).status, 403);
  });
});

describe("Volunteers — request → notify → accept → closed", () => {
  let atShelter, near1, near2, far;

  before(async () => {
    atShelter = await register(uuid(), { at: shelter.id, pos: near(10) });
    near1 = await register(uuid(), { pos: near(600) });
    near2 = await register(uuid(), { pos: near(900) });
    far = await register(uuid(), { pos: near(20000) });
  });

  test("count 1 → only the volunteer at the shelter is notified", async () => {
    const r = await api("POST", "/volunteers/requests", {
      token: dispatcher.accessToken,
      body: { shelterId: shelter.id, professions: ["doctor"], count: 1, urgency: "urgent" },
    });
    assert.equal(r.status, 201);
    assert.equal(r.data.request.notifiedCount, 1);
    assert.deepEqual(r.data.request.notifiedByStage, { 1: 1 });
    const mine = (await api("GET", "/volunteers/me/requests", dev(atShelter))).data.requests;
    assert.ok(mine.some((q) => q.id === r.data.request.id));
    const others = (await api("GET", "/volunteers/me/requests", dev(near1))).data.requests;
    assert.ok(!others.some((q) => q.id === r.data.request.id));
    await api("POST", `/volunteers/requests/${r.data.request.id}/cancel`, { token: dispatcher.accessToken });
  });

  test("concurrent accepts never exceed the count; the rest are closed", async () => {
    const r = await api("POST", "/volunteers/requests", {
      token: dispatcher.accessToken,
      body: { shelterId: shelter.id, professions: ["doctor"], count: 2 },
    });
    const id = r.data.request.id;
    assert.equal(r.data.request.notifiedCount, 3); // shelter + 2 within radius, not the far one
    const results = await Promise.all(
      [atShelter, near1, near2].map((d) => api("POST", `/volunteers/requests/${id}/accept`, { body: { deviceId: d } })),
    );
    const okCount = results.filter((x) => x.status === 200).length;
    assert.equal(okCount, 2);
    assert.equal(results.filter((x) => x.status === 409).length, 1);

    const staff = (await api("GET", "/volunteers/requests", { token: dispatcher.accessToken })).data.requests.find(
      (q) => q.id === id,
    );
    assert.equal(staff.status, "filled");
    assert.equal(staff.acceptedCount, 2);

    // The one who lost got a "closed" push in their device room
    const loserIdx = results.findIndex((x) => x.status === 409);
    const loser = [atShelter, near1, near2][loserIdx];
    const events = await waitFor(async () => {
      const e = (await api("GET", `/events?after=0&deviceId=${loser}`)).data.events;
      return e.some((x) => x.type === "volunteer:request_closed" && x.data.requestId === id) ? e : null;
    });
    assert.ok(events);

    // Winner gets a route to the assembly point
    const winner = results.find((x) => x.status === 200);
    assert.ok(winner.data.shelter.id === shelter.id);
    assert.ok(winner.data.route?.distanceMeters >= 0);

    // the far volunteer was never notified
    const farReqs = (await api("GET", "/volunteers/me/requests", dev(far))).data.requests;
    assert.ok(!farReqs.some((q) => q.id === id));
  });

  test("volunteer views never expose other volunteers", async () => {
    const mine = JSON.stringify((await api("GET", "/volunteers/me/requests", dev(near1))).body);
    for (const other of [atShelter, near2, far]) assert.ok(!mine.includes(other));
  });

  test("exact location only for dispatchers and only for accepted volunteers", async () => {
    const list = (await api("GET", "/volunteers", { token: dispatcher.accessToken })).data.volunteers;
    const accepted = list.filter((v) => v.exactLocation);
    assert.equal(accepted.length, 2);
    const farRow = list.find((v) => v.deviceId === far);
    assert.equal(farRow.exactLocation, null);
    assert.ok(farRow.location === null || !("lat" in farRow.location));
  });

  test("withdrawn consent is excluded from new requests", async () => {
    await api("POST", "/volunteers/me/withdraw", { body: { deviceId: near2 } });
    const r = await api("POST", "/volunteers/requests", {
      token: dispatcher.accessToken,
      body: { shelterId: shelter.id, professions: ["doctor"], count: 5 },
    });
    const mine = (await api("GET", "/volunteers/me/requests", dev(near2)));
    // no longer a volunteer principal → 403, and was not notified
    assert.equal(mine.status, 403);
    const staff = (await api("GET", "/volunteers/requests", { token: dispatcher.accessToken })).data.requests.find(
      (q) => q.id === r.data.request.id,
    );
    assert.equal(staff.notifiedCount, 2); // atShelter + near1 (far is out of reach)
  });

  test("medical SOS call-out requires the dispatcher permission", async () => {
    const sos = await api("POST", "/citizen/sos", {
      body: { clientId: uuid(), deviceId: uuid(), type: "medical", ...near(300) },
    });
    const id = sos.data.sos.id;
    assert.equal((await api("POST", `/volunteers/medical-sos/${id}`, { token: lead.accessToken })).status, 403);
    const r = await api("POST", `/volunteers/medical-sos/${id}`, { token: dispatcher.accessToken });
    assert.equal(r.status, 201);
    assert.equal(r.data.request.kind, "medical_sos");
  });
});

describe("Volunteers — documents and verification", () => {
  const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");

  test("type, content and size limits", async () => {
    const v = await register(uuid(), { profession: "nurse" });
    assert.equal((await upload(v, Buffer.from("hello"), "text/plain")).status, 400);
    assert.equal((await upload(v, Buffer.from("not a pdf"), "application/pdf")).body.code, "VOLUNTEER_DOC_MISMATCH");

    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { volunteers: { maxDocumentBytes: 10 } } });
    const big = await upload(v, PDF, "application/pdf");
    assert.equal(big.status, 413);
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { volunteers: { maxDocumentBytes: 5242880 } } });
  });

  test("upload → pending → admin verifies; download is admin-only and audited", async () => {
    const v = await register(uuid(), { profession: "doctor" });
    const up = await upload(v, PDF, "application/pdf", "diploma.pdf");
    assert.equal(up.status, 201);
    assert.equal(up.body.data.profile.verification, "pending");

    const queue = (await api("GET", "/volunteers/verification", { token: admin.accessToken })).data.volunteers;
    const row = queue.find((q) => q.documentsList.length && q.verification === "pending");
    assert.ok(row);
    assert.equal(row.unverifiedMedical, true);

    const docUrl = `${BASE}/volunteers/${row.id}/documents/${row.documentsList[0].id}`;
    const denied = await fetch(docUrl, { headers: { Authorization: `Bearer ${dispatcher.accessToken}` } });
    assert.equal(denied.status, 403);
    const file = await fetch(docUrl, { headers: { Authorization: `Bearer ${admin.accessToken}` } });
    assert.equal(file.status, 200);
    assert.ok(Buffer.from(await file.arrayBuffer()).subarray(0, 4).equals(Buffer.from("%PDF")));

    const verified = await api("POST", `/volunteers/${row.id}/verify`, {
      token: admin.accessToken,
      body: { decision: "verified" },
    });
    assert.equal(verified.data.volunteer.verification, "verified");
    assert.equal(verified.data.volunteer.unverifiedMedical, false);

    const audit = (await api("GET", "/admin/audit?limit=200", { token: admin.accessToken })).data.entries.map((e) => e.action);
    for (const a of ["volunteer.document_upload", "volunteer.document_download", "volunteer.verify", "volunteer.accept"]) {
      assert.ok(audit.includes(a), `audit has ${a}`);
    }
  });
});

describe("Volunteers — feature flag", () => {
  test("flag off → 404 FEATURE_DISABLED", async () => {
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { features: { volunteers: false } } });
    const r = await api("GET", "/volunteers/me", dev(uuid()));
    assert.equal(r.status, 404);
    assert.equal(r.body.code, "FEATURE_DISABLED");
    await api("PATCH", "/admin/config", { token: admin.accessToken, body: { features: { volunteers: true } } });
    assert.equal((await api("GET", "/volunteers/me", dev(uuid()))).status, 200);
  });
});
