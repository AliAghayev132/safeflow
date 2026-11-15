/**
 * Integration test harness: boots the real API (Express + Socket.IO + rule
 * engine) on a random port against a dedicated test database.
 *
 * Env must be set BEFORE importing app.js (config reads it at import time).
 */
import http from "node:http";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || "mongodb://localhost:27017/crisis_engine_test";
process.env.ENABLE_BRIGADE_TICKER = "false";

// Fake external routing API (OSRM-shaped). Mode is switched by tests.
export const fakeRouting = { mode: "error", hits: 0 };
const fakeServer = http.createServer((req, res) => {
  fakeRouting.hits += 1;
  if (fakeRouting.mode === "error") {
    res.writeHead(500).end("boom");
    return;
  }
  if (fakeRouting.mode === "503") {
    res.writeHead(503).end("Service Unavailable");
    return;
  }
  if (fakeRouting.mode === "slow") {
    // answers after > 5 s (Challenge Drop #2)
    setTimeout(() => !res.writableEnded && res.writeHead(200).end("{}"), 6000).unref();
    return;
  }
  if (fakeRouting.mode === "hang") return; // never answers → timeout
  const m = req.url.match(/\/route\/v1\/\w+\/([\d.]+),([\d.]+);([\d.]+),([\d.]+)/);
  const [lng1, lat1, lng2, lat2] = m.slice(1).map(Number);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      routes: [{ distance: 1234, duration: 900, geometry: { coordinates: [[lng1, lat1], [lng2, lat2]] } }],
    }),
  );
});
await new Promise((r) => fakeServer.listen(0, "127.0.0.1", r));
process.env.ROUTING_EXTERNAL_URL = `http://127.0.0.1:${fakeServer.address().port}`;

const { startApp, stopApp } = await import("../../app.js");
const { mongoose } = await import("#lib");
const { io } = await import("socket.io-client");

export let BASE = "";
export let ORIGIN = "";

// With --test-isolation=none every integration file runs in ONE process and
// their top-level before/after hooks interleave — so the server is booted
// once (shared) and shut down when the last file is done.
let booting = null;
let users = 0;

export const boot = async () => {
  users += 1;
  booting ??= (async () => {
    // Fresh test database for the run
    await mongoose.connect(process.env.MONGODB_URI);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();

    const { port } = await startApp({ port: 0 });
    ORIGIN = `http://127.0.0.1:${port}`;
    BASE = `${ORIGIN}/api`;
  })();
  return booting;
};

export const shutdown = async () => {
  users -= 1;
  if (users > 0) return;
  await stopApp();
  await new Promise((r) => fakeServer.close(r));
};

export const api = async (method, path, { body, token, headers = {} } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, body: json, data: json.data };
};

export const login = async (username, password) => {
  const r = await api("POST", "/auth/login", { body: { username, password } });
  if (r.status !== 200) throw new Error(`login ${username} failed: ${r.status}`);
  return r.data;
};

export const accounts = {
  admin: ["admin", "Admin123!"],
  dispatcher: ["dispatcher", "Dispatcher123!"],
  lead: ["brigade1", "Brigade123!"],
};

export const uuid = () => crypto.randomUUID();
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wait until `fn` returns truthy (polling), or throw after `timeoutMs`. */
export const waitFor = async (fn, timeoutMs = 4000, stepMs = 50) => {
  const start = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timeout");
    await sleep(stepMs);
  }
};

export const YASAMAL = { lat: 40.384, lng: 49.815 };

export const sendSos = (over = {}) =>
  api("POST", "/citizen/sos", {
    body: {
      clientId: uuid(),
      deviceId: uuid(),
      type: "collapse",
      ...YASAMAL,
      ...over,
    },
  });

/** Socket.IO client that collects `evt` messages. */
export const connectSocket = (auth) =>
  new Promise((resolve, reject) => {
    const socket = io(ORIGIN, { auth, transports: ["websocket"], reconnection: false, forceNew: true });
    socket.events = [];
    socket.on("evt", (e) => socket.events.push(e));
    socket.on("hello", (h) => {
      socket.hello = h;
      resolve(socket);
    });
    socket.on("connect_error", reject);
  });
