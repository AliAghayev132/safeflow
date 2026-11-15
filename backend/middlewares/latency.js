/**
 * Server-side response-time recorder: time from the request reaching the
 * API until the response is fully written (includes rate limiting, DB work
 * and any wait in the event loop). Kept in a small ring buffer per route
 * group so load / flood reports can quote the server's real latency.
 */
const BUFFER = 5000;
const samples = new Map(); // group → [{ at, ms, status }]

export const recordLatency = (group) => (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const list = samples.get(group) ?? [];
    list.push({ at: Date.now(), ms: Number(process.hrtime.bigint() - start) / 1e6, status: res.statusCode });
    if (list.length > BUFFER) list.splice(0, list.length - BUFFER);
    samples.set(group, list);
  });
  next();
};

/** Samples of a group recorded since `sinceMs` (epoch ms). */
export const latencySince = (group, sinceMs) => (samples.get(group) ?? []).filter((s) => s.at >= sinceMs);

/** avg / p50 / p95 / max of a list of samples. */
export const latencyStats = (list) => {
  const ms = list.map((s) => s.ms).sort((a, b) => a - b);
  const at = (p) => (ms.length ? ms[Math.min(ms.length - 1, Math.floor(ms.length * p))] : 0);
  const avg = ms.reduce((s, v) => s + v, 0) / (ms.length || 1);
  return { count: ms.length, avgMs: Math.round(avg), p50Ms: Math.round(at(0.5)), p95Ms: Math.round(at(0.95)), maxMs: Math.round(ms.at(-1) ?? 0) };
};
