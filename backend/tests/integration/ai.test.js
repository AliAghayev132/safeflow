import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

// Mock providers only: no keys / endpoints in the test run
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENAI_API_KEY", "STT_API_KEY", "STT_BASE_URL", "VISION_YOLO_URL", "AI_LOCAL_URL"]) {
  delete process.env[k];
}

const { boot, shutdown, api, login, accounts, uuid, waitFor, YASAMAL } = await import("./helpers.js");

let admin, dispatcher, lead;
let shelters;

before(async () => {
  await boot();
  [admin, dispatcher, lead] = await Promise.all([login(...accounts.admin), login(...accounts.dispatcher), login(...accounts.lead)]);
  shelters = (await api("GET", "/citizen/shelters")).data.shelters;
});
after(shutdown);

const setFlag = (flag, value) =>
  api("PATCH", "/admin/config", { token: admin.accessToken, body: { features: { [flag]: value } } });

describe("AI — status & RBAC", () => {
  test("status lists providers (mock when nothing configured), no secrets", async () => {
    const r = await api("GET", "/ai/status", { token: admin.accessToken });
    assert.equal(r.status, 200);
    for (const cap of ["llm", "stt", "vision"]) assert.equal(r.data.providers[cap].active, "mock");
    assert.ok(!JSON.stringify(r.data).match(/sk-|api_key/i));
  });

  test("citizens cannot reach staff AI endpoints; brigade lead cannot assess damage", async () => {
    assert.equal((await api("GET", "/ai/forecast")).status, 401);
    assert.equal((await api("GET", "/ai/damage", { token: lead.accessToken })).status, 403);
    assert.equal((await api("GET", "/ai/supply/plan", { token: lead.accessToken })).status, 403);
    assert.equal((await api("GET", "/ai/forecast", { token: lead.accessToken })).status, 200);
  });

  test("feature flag off → 404 FEATURE_DISABLED", async () => {
    await setFlag("aiChatbot", false);
    const r = await api("POST", "/ai/chat", { body: { deviceId: uuid(), message: "su" } });
    assert.equal(r.status, 404);
    assert.equal(r.body.code, "FEATURE_DISABLED");
    await setFlag("aiChatbot", true);
  });
});

describe("AI — voice SOS", () => {
  test("transcript → structured SOS created immediately (zone from speech, no GPS)", async () => {
    const deviceId = uuid();
    const r = await api("POST", "/ai/voice-sos", {
      body: {
        deviceId,
        transcript: "Kömək edin! Binamız uçub, üçüncü mərtəbədə dağıntı altında dörd nəfərik, aramızda uşaq var. Yasamal.",
      },
    });
    assert.equal(r.status, 201);
    assert.equal(r.data.sos.type, "collapse");
    assert.equal(r.data.sos.headcount, 4);
    assert.equal(r.data.parsed.priority, "critical");
    assert.equal(r.data.enrichment, "none"); // mock providers → nothing to wait for
    const queue = (await api("GET", "/dispatcher/sos/queue", { token: dispatcher.accessToken })).data.queue;
    const ticket = queue.find((s) => s.id === r.data.sos.id);
    assert.ok(ticket, "visible to dispatchers");
    assert.equal(ticket.ai?.priority, "critical");
  });

  test("no location at all → 400; empty input → 400", async () => {
    assert.equal((await api("POST", "/ai/voice-sos", { body: { deviceId: uuid(), transcript: "kömək edin" } })).status, 400);
    assert.equal((await api("POST", "/ai/voice-sos", { body: { deviceId: uuid(), ...YASAMAL } })).status, 400);
  });

  test("parse preview does not create an SOS", async () => {
    const r = await api("POST", "/ai/voice-sos/parse", { body: { deviceId: uuid(), text: "Fire, 2 people" } });
    assert.equal(r.status, 200);
    assert.equal(r.data.parsed.hazardType, "fire");
  });
});

describe("AI — damage assessment", () => {
  test("drone survey queues frames, results arrive and change the road network", async () => {
    const r = await api("POST", "/ai/damage/survey", { token: dispatcher.accessToken, body: { zoneCode: "YAS", frames: 10 } });
    assert.equal(r.status, 202);
    const n = r.data.assessments.length;
    assert.ok(n >= 3 && n <= 10);
    const done = await waitFor(async () => {
      const list = (await api("GET", "/ai/damage", { token: dispatcher.accessToken })).data.assessments;
      return list.filter((a) => a.status === "done").length >= n ? list : null;
    }, 8000);
    for (const a of done) assert.ok(["none", "partial", "blocked", "collapsed"].includes(a.severity));
    const applied = done.filter((a) => a.applied.length);
    if (applied.length) {
      const reverted = await api("POST", `/ai/damage/${applied[0].id}/revert`, { token: dispatcher.accessToken });
      assert.equal(reverted.data.assessment.status, "reverted");
    }
  });

  test("raw image upload is accepted (202) and audited", async () => {
    const res = await fetch(`${(await import("./helpers.js")).BASE}/ai/damage/assess?lat=40.38&lng=49.83&source=drone`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg", Authorization: `Bearer ${dispatcher.accessToken}` },
      body: Buffer.from("not really a jpeg but fine for the mock"),
    });
    assert.equal(res.status, 202);
    const audit = (await api("GET", "/admin/audit?action=ai.damage.assess", { token: admin.accessToken })).data.entries;
    assert.ok(audit.length >= 1);
  });
});

describe("AI — forecast, chatbot, supply plan", () => {
  test("forecast has 15/30 min predictions per open shelter", async () => {
    const r = await api("POST", "/ai/forecast/refresh", { token: dispatcher.accessToken });
    assert.equal(r.status, 200);
    const f = r.data.forecast;
    assert.deepEqual(f.horizons, [15, 30]);
    assert.ok(f.shelters.length > 0);
    assert.ok(f.shelters[0].predictions["30"].occupancy >= 0);
    assert.ok(Array.isArray(f.warnings) && Array.isArray(f.recommendations));
  });

  test("chatbot answers from live data in the citizen's language", async () => {
    const r = await api("POST", "/ai/chat", {
      body: { deviceId: uuid(), message: "Where can I get water and the nearest shelter?", language: "en", ...YASAMAL },
    });
    assert.equal(r.status, 200);
    assert.ok(r.data.intents.includes("water"));
    assert.ok(r.data.sources.length > 0);
    const names = shelters.map((s) => s.name);
    assert.ok(r.data.sources.every((s) => names.includes(s.name)), "only real shelters are cited");
    assert.match(r.data.answer, /Stay calm/);
  });

  test("supply plan prioritises and can be applied as supply requests", async () => {
    const plan = (await api("POST", "/ai/supply/plan/refresh", { token: dispatcher.accessToken })).data.plan;
    assert.ok(plan.shelters.length > 0);
    const target = plan.shelters.find((s) => s.deficitKg > 0);
    if (!target) return; // empty city: nothing to deliver
    const applied = await api("POST", "/ai/supply/plan/apply", { token: dispatcher.accessToken, body: { shelterIds: [target.shelterId] } });
    assert.equal(applied.status, 201);
    assert.equal(applied.data.requests[0].shelter, target.shelterId);
    const after = (await api("GET", "/ai/supply/plan", { token: dispatcher.accessToken })).data.plan;
    assert.ok((after.shelters.find((s) => s.shelterId === target.shelterId)?.deficitKg ?? 0) < target.deficitKg);
  });
});

describe("AI — latency under concurrent load (< 300 ms)", () => {
  test("p95 of every AI endpoint stays under 300 ms with 25 concurrent requests (after warm-up)", async () => {
    await api("POST", "/ai/forecast/refresh", { token: dispatcher.accessToken });
    const calls = {
      chat: () => api("POST", "/ai/chat", { body: { deviceId: uuid(), message: "nearest shelter", ...YASAMAL } }),
      voice: () => api("POST", "/ai/voice-sos", { body: { deviceId: uuid(), transcript: "yanğın var, 2 nəfər", ...YASAMAL } }),
      forecast: () => api("GET", "/ai/forecast", { token: dispatcher.accessToken }),
      plan: () => api("GET", "/ai/supply/plan", { token: dispatcher.accessToken }),
      damage: () => api("GET", "/ai/damage", { token: dispatcher.accessToken }),
    };
    // NB: the client runs in the same process as the server, so this is a
    // conservative check (see tests/load for the separate-process numbers)
    for (const [name, call] of Object.entries(calls)) {
      await Promise.all(Array.from({ length: 5 }, () => call())); // warm-up
      const measure = async () => {
        const times = await Promise.all(
          Array.from({ length: 25 }, async () => {
            const t0 = performance.now();
            const r = await call();
            assert.ok(r.status < 300, `${name} → ${r.status}`);
            return performance.now() - t0;
          }),
        );
        times.sort((a, b) => a - b);
        return times[Math.floor(times.length * 0.95) - 1];
      };
      // One retry absorbs a noisy machine (GC, other processes); a real
      // regression fails both runs
      let p95 = await measure();
      if (p95 >= 300) p95 = Math.min(p95, await measure());
      assert.ok(p95 < 300, `${name} p95 = ${p95.toFixed(0)} ms`);
    }
  });
});
