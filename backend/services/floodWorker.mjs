/**
 * Attacker side of the SOS flood simulation, running in a worker thread so
 * the bots do not share the API server's event loop (like a real external
 * attacker). Sends real HTTP requests and reports per-request timings.
 */
import { parentPort, workerData } from "node:worker_threads";
import { randomUUID } from "node:crypto";
import http from "node:http";

// Bots reuse keep-alive connections (a real botnet does too); without this
// hundreds of simultaneous TCP handshakes are refused by the OS on Windows
const agent = new http.Agent({ keepAlive: true, maxSockets: 128 });

const post = (target, body, ip) =>
  new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(target, { method: "POST", agent, headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data), "X-Forwarded-For": ip } }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => resolve({ status: res.statusCode, raw }));
    });
    req.on("error", reject);
    req.end(data);
  });

const { url, attack, genuine, waves, waveGapMs } = workerData;
const BOT_IPS = ["203.0.113.10", "203.0.113.11", "203.0.113.12"];
const CENTER = { lat: 40.384, lng: 49.815 };
const jitter = (v, d) => v + (Math.random() - 0.5) * d;

const fixedBots = Array.from({ length: 10 }, () => randomUUID());
const replayIds = Array.from({ length: 20 }, () => randomUUID());

const send = async (body, ip, kind) => {
  const t0 = performance.now();
  try {
    const res = await post(url, body, ip);
    let code = null;
    try {
      code = JSON.parse(res.raw).code ?? null;
    } catch {
      code = null;
    }
    return { kind, status: res.status, code, ms: performance.now() - t0, deviceId: body.deviceId };
  } catch (e) {
    return { kind, status: 0, code: `NETWORK:${e.cause?.code ?? e.message}`, ms: performance.now() - t0, deviceId: body.deviceId };
  }
};

// Bots: 50% repeat taps from 10 fixed devices, 30% device-id rotation,
// 20% exact replays of the same clientId (duplicates)
const botRequest = (i) => {
  const ip = BOT_IPS[i % BOT_IPS.length];
  const r = i % 10;
  let deviceId;
  let clientId;
  if (r < 5) {
    deviceId = fixedBots[i % fixedBots.length];
    clientId = randomUUID();
  } else if (r < 8) {
    deviceId = randomUUID();
    clientId = randomUUID();
  } else {
    const k = i % replayIds.length;
    deviceId = fixedBots[k % fixedBots.length];
    clientId = replayIds[k];
  }
  return send({ clientId, deviceId, type: "general", lat: jitter(CENTER.lat, 0.004), lng: jitter(CENTER.lng, 0.004) }, ip, "bot");
};

// Genuine citizens: own device, own IP, one SOS each (retry once on 429 like the app)
const genuineRequest = async (i) => {
  const body = {
    clientId: randomUUID(),
    deviceId: randomUUID(),
    type: ["medical", "fire", "collapse", "flood"][i % 4],
    lat: jitter(40.38, 0.06),
    lng: jitter(49.84, 0.08),
  };
  return send(body, `198.51.100.${10 + i}`, "genuine");
};

const jobs = [];
const perWave = Math.ceil(attack / waves);
let g = 0;
for (let w = 0; w < waves; w++) {
  for (let i = w * perWave; i < Math.min(attack, (w + 1) * perWave); i++) jobs.push(botRequest(i));
  for (let k = 0; k < Math.ceil(genuine / waves) && g < genuine; k++, g++) jobs.push(genuineRequest(g));
  if (w < waves - 1) await new Promise((r) => setTimeout(r, waveGapMs));
}
const results = await Promise.all(jobs);
agent.destroy();
parentPort.postMessage(results);
