/**
 * Builds tests/load/reports/REPORT.md from the latest Artillery (load / stress)
 * JSON outputs and the realtime / integrity runs.
 *   npm run test:report
 */
import { readFile, readdir, writeFile } from "node:fs/promises";

const dir = new URL("./reports/", import.meta.url);
const readJson = async (name) => {
  try {
    return JSON.parse(await readFile(new URL(name, dir), "utf8"));
  } catch {
    return null;
  }
};
const latest = async (prefix) => {
  const files = (await readdir(dir)).filter((f) => f.startsWith(prefix) && f.endsWith(".json")).sort();
  return files.length ? readJson(files.at(-1)) : null;
};

const n = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : "—");
const errorsOf = (counters = {}) =>
  Object.entries(counters)
    .filter(([k]) => k.startsWith("errors.") || k === "http.codes.429" || /^http\.codes\.5\d\d$/.test(k))
    .reduce((s, [, v]) => s + v, 0);

const artillerySection = (title, data, { breakAt } = {}) => {
  if (!data) return `## ${title}\n\n_Not run._\n`;
  const a = data.aggregate;
  const c = a.counters;
  const rt = a.summaries?.["http.response_time"] ?? {};
  const requests = c["http.requests"] ?? 0;
  const errors = errorsOf(c);
  const codes = Object.entries(c)
    .filter(([k]) => k.startsWith("http.codes."))
    .map(([k, v]) => `${k.replace("http.codes.", "")}: ${v}`)
    .join(", ");
  const errorKinds = Object.entries(c)
    .filter(([k]) => k.startsWith("errors."))
    .map(([k, v]) => `${k.replace("errors.", "")}: ${v}`)
    .join(", ");

  const rows = (data.intermediate ?? []).map((p, i) => {
    const pc = p.counters ?? {};
    const req = pc["http.requests"] ?? 0;
    const err = errorsOf(pc);
    const prt = p.summaries?.["http.response_time"] ?? {};
    return { i, req, rps: p.rates?.["http.request_rate"], p50: prt.median, p95: prt.p95, p99: prt.p99, err, errPct: req ? (err / req) * 100 : 0 };
  });
  const broken = breakAt ? rows.find((r) => r.errPct > breakAt.errPct || r.p95 > breakAt.p95) : null;

  let md = `## ${title}\n\n`;
  md += `| Metric | Value |\n|---|---|\n`;
  md += `| Requests | ${requests} |\n`;
  md += `| Mean request rate | ${n(a.rates?.["http.request_rate"])} req/s |\n`;
  md += `| Latency p50 / p95 / p99 | ${n(rt.median)} / ${n(rt.p95)} / ${n(rt.p99)} ms |\n`;
  md += `| Error rate | ${n((errors / Math.max(1, requests)) * 100, 2)} % (${errors}) |\n`;
  md += `| HTTP codes | ${codes || "—"} |\n`;
  md += `| Transport errors | ${errorKinds || "none"} |\n\n`;

  const endpoints = Object.entries(a.summaries ?? {}).filter(([k]) => k.startsWith("plugins.metrics-by-endpoint.response_time."));
  if (endpoints.length) {
    md += `| Endpoint | p50 | p95 | p99 |\n|---|---|---|---|\n`;
    for (const [k, s] of endpoints) {
      md += `| ${k.replace("plugins.metrics-by-endpoint.response_time.", "")} | ${n(s.median)} | ${n(s.p95)} | ${n(s.p99)} |\n`;
    }
    md += "\n";
  }

  md += `Timeline (10 s windows):\n\n| # | req | req/s | p50 ms | p95 ms | p99 ms | errors | error % |\n|---|---|---|---|---|---|---|---|\n`;
  for (const r of rows) {
    md += `| ${r.i + 1} | ${r.req} | ${n(r.rps)} | ${n(r.p50)} | ${n(r.p95)} | ${n(r.p99)} | ${r.err} | ${n(r.errPct, 1)} |\n`;
  }
  if (breakAt) {
    md += broken
      ? `\n**Breaking point:** window #${broken.i + 1} at ~${n(broken.rps)} req/s offered — first window with error rate > ${breakAt.errPct}% or p95 > ${breakAt.p95} ms.\n`
      : `\n**Breaking point:** not reached in this run.\n`;
  }
  return md + "\n";
};

const main = async () => {
  const [load, stress, realtime, integrity] = await Promise.all([
    readJson("load.json"),
    readJson("stress.json"),
    latest("realtime-"),
    latest("integrity-"),
  ]);

  let md = `# Load & stress test report\n\nGenerated ${new Date().toISOString()}. Tooling: Artillery (HTTP), Node + socket.io-client (WebSocket, alert latency, SOS integrity).\n\n`;
  md += `> Measured on a single developer machine (API, MongoDB, the load generator and two Vite dev servers on the same host, Windows). Absolute numbers are hardware-bound; use them as a baseline and for regressions.\n\n`;

  md += artillerySection("Load — normal and peak traffic", load);
  md += artillerySection("Stress — ramp to failure", stress, { breakAt: { errPct: 5, p95: 2000 } });

  md += `## Realtime (WebSocket)\n\n`;
  if (realtime) {
    md += `| Metric | Value |\n|---|---|\n`;
    md += `| Concurrent sockets | ${realtime.connections.requested} (failed ${realtime.connections.failed}) |\n`;
    md += `| Connect p50 / p95 | ${realtime.connections.connectMs.p50} / ${realtime.connections.connectMs.p95} ms |\n`;
    md += `| SOS → dispatcher fan-out p50 / p95 / p99 | ${realtime.sosFanoutMs.p50} / ${realtime.sosFanoutMs.p95} / ${realtime.sosFanoutMs.p99} ms (lost: ${realtime.sosFanoutLost}) |\n`;
    md += `| **Alert creation time** (4th SOS response → \`alert:new\`) p50 / p95 | ${realtime.alertCreationMs.p50} / ${realtime.alertCreationMs.p95} ms (${realtime.alertCreationMs.n} runs) |\n\n`;
  } else md += `_Not run._\n\n`;

  md += `## Stress integrity — genuine SOS under a spam flood\n\n`;
  if (integrity) {
    const g = integrity.genuine;
    md += `| Metric | Value |\n|---|---|\n`;
    md += `| Genuine citizens (1 SOS each, retry on Retry-After) | ${g.sent} |\n`;
    md += `| Accepted / lost | ${g.accepted} / ${g.lost} |\n`;
    md += `| Needed a retry | ${g.neededRetry} |\n`;
    md += `| Missing in DB / duplicate tickets | ${g.missingInDb} / ${g.duplicateTickets} |\n`;
    md += `| Spam devices × requests | ${integrity.spam.devices} × ${integrity.spam.requests / integrity.spam.devices} |\n`;
    md += `| Spam accepted / 429 / transport errors | ${integrity.spam.accepted} / ${integrity.spam.limited} / ${integrity.spam.other} |\n`;
    md += `| **Verdict** | ${integrity.verdict} |\n\n`;
  } else md += `_Not run._\n\n`;

  await writeFile(new URL("REPORT.md", dir), md);
  console.log(md);
};

main();
