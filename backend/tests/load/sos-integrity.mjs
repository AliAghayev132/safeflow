/**
 * Stress integrity: while spammer devices flood the SOS endpoint, genuine
 * citizens (one SOS each, behaving like the real app — retry after
 * Retry-After) must ALL get through, and every genuine SOS must exist exactly
 * once in the database.
 *
 *   node tests/load/sos-integrity.mjs [genuine=500] [spammers=20] [spamPerDevice=60]
 */
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";

const TARGET = process.env.TARGET || "http://localhost:5000";
const GENUINE = Number(process.argv[2] ?? 500);
const SPAMMERS = Number(process.argv[3] ?? 20);
const SPAM_PER_DEVICE = Number(process.argv[4] ?? 60);
const TYPES = ["collapse", "medical", "fire", "flood", "general"];
const ip = () => `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${1 + Math.floor(Math.random() * 253)}`;

const sos = async (body, xff) => {
  const res = await fetch(`${TARGET}/api/citizen/sos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": xff },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, retryAfter: Number(res.headers.get("retry-after")) || 0, json };
};

/** Real-app behaviour: same clientId, honour Retry-After, give up after 5 tries. */
const genuineCitizen = async () => {
  const body = {
    clientId: randomUUID(),
    deviceId: randomUUID(),
    type: TYPES[Math.floor(Math.random() * TYPES.length)],
    lat: 40.372 + Math.random() * 0.05,
    lng: 49.8 + Math.random() * 0.09,
  };
  const xff = ip();
  let attempts = 0;
  for (;;) {
    attempts += 1;
    const r = await sos(body, xff).catch(() => ({ status: 0, retryAfter: 1 }));
    if (r.status === 200 || r.status === 201) return { ok: true, attempts, id: r.json.data.sos.id, clientId: body.clientId };
    if (attempts >= 5) return { ok: false, attempts, status: r.status, clientId: body.clientId };
    await new Promise((res) => setTimeout(res, Math.min(5, r.retryAfter || 1) * 1000));
  }
};

const spammer = async () => {
  const deviceId = randomUUID();
  const xff = ip();
  const counts = { accepted: 0, limited: 0, other: 0 };
  await Promise.all(
    Array.from({ length: SPAM_PER_DEVICE }, async (_, i) => {
      const r = await sos(
        { clientId: randomUUID(), deviceId, type: TYPES[i % TYPES.length], lat: 40.39, lng: 49.84 },
        xff,
      ).catch(() => ({ status: 0 }));
      if (r.status === 429) counts.limited += 1;
      else if (r.status === 200 || r.status === 201) counts.accepted += 1;
      else counts.other += 1;
    }),
  );
  return counts;
};

const main = async () => {
  const login = await fetch(`${TARGET}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "dispatcher", password: process.env.DISPATCHER_PASSWORD || "Dispatcher123!" }),
  }).then((r) => r.json());
  const token = login.data.accessToken;
  await fetch(`${TARGET}/api/simulation/reset`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });

  const started = performance.now();
  const [genuine, spam] = await Promise.all([
    Promise.all(Array.from({ length: GENUINE }, genuineCitizen)),
    Promise.all(Array.from({ length: SPAMMERS }, spammer)),
  ]);
  const durationMs = Math.round(performance.now() - started);

  // Verify through the dispatcher API: every accepted genuine ticket exists,
  // and retries never produced a second ticket (one id per clientId).
  const accepted = genuine.filter((g) => g.ok);
  let missingInQueue = 0;
  for (let i = 0; i < accepted.length; i += 25) {
    const chunk = accepted.slice(i, i + 25);
    const found = await Promise.all(
      chunk.map((g) =>
        fetch(`${TARGET}/api/dispatcher/sos/${g.id}`, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json())
          .then((b) => b.data?.sos?.clientId === g.clientId)
          .catch(() => false),
      ),
    );
    missingInQueue += found.filter((f) => !f).length;
  }
  const duplicateTickets = accepted.length - new Set(accepted.map((g) => g.id)).size;

  const spamTotals = spam.reduce(
    (acc, c) => ({ accepted: acc.accepted + c.accepted, limited: acc.limited + c.limited, other: acc.other + c.other }),
    { accepted: 0, limited: 0, other: 0 },
  );

  const report = {
    at: new Date().toISOString(),
    durationMs,
    genuine: {
      sent: GENUINE,
      accepted: accepted.length,
      lost: GENUINE - accepted.length,
      neededRetry: genuine.filter((g) => g.attempts > 1).length,
      missingInDb: missingInQueue,
      duplicateTickets,
    },
    spam: { devices: SPAMMERS, requests: SPAMMERS * SPAM_PER_DEVICE, ...spamTotals },
    verdict:
      accepted.length === GENUINE && missingInQueue === 0 && duplicateTickets === 0 && spamTotals.limited > 0
        ? "PASS — no genuine SOS lost; spam stopped by the device limit"
        : "FAIL",
  };
  await mkdir(new URL("./reports/", import.meta.url), { recursive: true });
  await writeFile(new URL(`./reports/integrity-${Date.now()}.json`, import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.verdict.startsWith("PASS") ? 0 : 1);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
