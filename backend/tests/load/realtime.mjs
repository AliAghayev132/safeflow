/**
 * Realtime load + alert latency.
 *
 *  1. Opens N citizen + M dispatcher WebSocket connections (connect p95).
 *  2. Fires SOS and measures fan-out latency: POST → `sos:new` on dispatchers.
 *  3. Fires 4 SOS from distinct devices in one spot and measures the time
 *     from the 4th SOS response to `alert:new` (alert creation time).
 *
 *   node tests/load/realtime.mjs [citizens=1000] [dispatchers=20]
 * Writes tests/load/reports/realtime-<ts>.json
 */
import { io } from "socket.io-client";
import { writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const TARGET = process.env.TARGET || "http://localhost:5000";
const CITIZENS = Number(process.argv[2] ?? 1000);
const DISPATCHERS = Number(process.argv[3] ?? 20);

const pct = (arr, p) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] * 10) / 10;
};
const summary = (arr) => ({ n: arr.length, p50: pct(arr, 50), p95: pct(arr, 95), p99: pct(arr, 99), max: pct(arr, 100) });
const ip = () => `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${1 + Math.floor(Math.random() * 253)}`;

const post = async (path, body, token) => {
  const res = await fetch(`${TARGET}/api${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

const connect = (auth) =>
  new Promise((resolve) => {
    const started = performance.now();
    const socket = io(TARGET, { auth, transports: ["websocket"], reconnection: false, forceNew: true, timeout: 15000 });
    socket.on("hello", () => resolve({ socket, ms: performance.now() - started, ok: true }));
    socket.on("connect_error", () => resolve({ socket, ms: performance.now() - started, ok: false }));
  });

const main = async () => {
  const login = await post("/auth/login", { username: "dispatcher", password: process.env.DISPATCHER_PASSWORD || "Dispatcher123!" });
  const token = login.body.data.accessToken;
  await post("/simulation/reset", {}, token);

  console.log(`Connecting ${CITIZENS} citizens + ${DISPATCHERS} dispatchers…`);
  const conns = [];
  const batch = 100;
  for (let i = 0; i < CITIZENS; i += batch) {
    const group = await Promise.all(
      Array.from({ length: Math.min(batch, CITIZENS - i) }, () => connect({ client: "citizen", deviceId: randomUUID() })),
    );
    conns.push(...group);
  }
  const dispatchers = await Promise.all(
    Array.from({ length: DISPATCHERS }, () => connect({ client: "operator", token })),
  );
  const all = [...conns, ...dispatchers];
  const connectMs = all.map((c) => c.ms);
  const connectFailed = all.filter((c) => !c.ok).length;
  console.log(`  connected: ${all.length - connectFailed}/${all.length}`);

  // ---- SOS fan-out latency ----
  const fanout = [];
  const pending = new Map(); // sos id → sentAt
  const watcher = dispatchers.find((d) => d.ok).socket;
  watcher.on("evt", (e) => {
    if (e.type === "sos:new" && pending.has(e.data.clientId)) {
      fanout.push(performance.now() - pending.get(e.data.clientId));
      pending.delete(e.data.clientId);
    }
  });
  for (let i = 0; i < 200; i++) {
    const clientId = randomUUID();
    pending.set(clientId, performance.now());
    await post("/citizen/sos", {
      clientId,
      deviceId: randomUUID(),
      type: "medical",
      lat: 40.372 + Math.random() * 0.05,
      lng: 49.8 + Math.random() * 0.09,
    });
  }
  await new Promise((r) => setTimeout(r, 1500));

  // ---- Alert creation time (cluster rule) ----
  const alertTimes = [];
  for (let round = 0; round < 5; round++) {
    await post("/simulation/reset", {}, token);
    await new Promise((r) => setTimeout(r, 300));
    const spot = { lat: 40.38 + round * 0.008, lng: 49.81 + round * 0.015 };
    const got = new Promise((resolve) => {
      const onEvt = (e) => {
        if (e.type === "alert:new") {
          watcher.off("evt", onEvt);
          resolve(performance.now());
        }
      };
      watcher.on("evt", onEvt);
      setTimeout(() => resolve(null), 10000);
    });
    let lastAt = 0;
    for (let i = 0; i < 4; i++) {
      await post("/citizen/sos", { clientId: randomUUID(), deviceId: randomUUID(), type: "collapse", lat: spot.lat + i * 0.0003, lng: spot.lng });
      lastAt = performance.now();
    }
    const at = await got;
    if (at) alertTimes.push(at - lastAt);
  }

  all.forEach((c) => c.socket.close());

  const report = {
    at: new Date().toISOString(),
    target: TARGET,
    connections: { requested: all.length, failed: connectFailed, connectMs: summary(connectMs) },
    sosFanoutMs: summary(fanout),
    sosFanoutLost: pending.size,
    alertCreationMs: summary(alertTimes),
  };
  await mkdir(new URL("./reports/", import.meta.url), { recursive: true });
  const file = new URL(`./reports/realtime-${Date.now()}.json`, import.meta.url);
  await writeFile(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
