import { Worker } from "node:worker_threads";
import { latencySince, latencyStats } from "#middlewares/latency.js";
import { SosSignal } from "#models";
import { AppError } from "#utils";

/**
 * Challenge Drop #3 demo — SOS flood / spam attack against the REAL HTTP
 * endpoint (POST /api/citizen/sos), so every protection layer is exercised
 * exactly as in production:
 *
 *   1. rate limiting per IP and per device → 429 + Retry-After
 *   2. duplicate filtering (same clientId replay, same device repeat taps merged)
 *   3. spam detection (device burst, device-id rotation from one IP) → the SOS
 *      is kept but flagged and hidden from the dispatcher queue / clusters
 *
 * While the bots attack, genuine citizens (one SOS each, own IP and device)
 * send at the same time — all of them must get through.
 * The report includes the average and p95 response time of every request.
 */
const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0);

class FloodSimulationService {
  static port = null; // set by app.js after listen
  static #running = false;

  static async run({ attack = 600, genuine = 20, waves = 6, waveGapMs = 150 } = {}) {
    if (!FloodSimulationService.port) throw AppError.conflict("Server portu hələ məlum deyil", "FLOOD_NOT_READY");
    if (FloodSimulationService.#running) throw AppError.conflict("Hücum simulyasiyası artıq gedir", "FLOOD_RUNNING");
    FloodSimulationService.#running = true;
    try {
      return await FloodSimulationService.#run({ attack, genuine, waves, waveGapMs });
    } finally {
      FloodSimulationService.#running = false;
    }
  }

  static async #run({ attack, genuine, waves, waveGapMs }) {
    const url = `http://127.0.0.1:${FloodSimulationService.port}/api/citizen/sos`;
    const started = Date.now();
    // Attackers run in a worker thread — like real external clients they do
    // not share the API server's event loop, so the timings are the server's
    const results = await new Promise((resolve, reject) => {
      const worker = new Worker(new URL("./floodWorker.mjs", import.meta.url), {
        workerData: { url, attack, genuine, waves, waveGapMs },
      });
      worker.once("message", resolve);
      worker.once("error", reject);
    });

    const server = latencyStats(latencySince("sos", started));
    const bots = results.filter((r) => r.kind === "bot");
    const humans = results.filter((r) => r.kind === "genuine");
    const times = results.map((r) => r.ms).sort((a, b) => a - b);
    const avg = times.reduce((s, v) => s + v, 0) / (times.length || 1);

    // Spam-flagged records created by the attack (kept for audit, hidden from dispatchers)
    const botDevices = [...new Set(bots.map((b) => b.deviceId))];
    const flagged = await SosSignal.countDocuments({ deviceId: { $in: botDevices }, spamFlagged: true });
    const botRecords = await SosSignal.countDocuments({ deviceId: { $in: botDevices } });

    return {
      durationMs: Date.now() - started,
      requests: results.length,
      attack: {
        sent: bots.length,
        rateLimited: bots.filter((b) => b.status === 429).length,
        duplicatesMerged: bots.filter((b) => b.code === "SOS_DUPLICATE").length,
        accepted: bots.filter((b) => b.status === 201).length,
        storedRecords: botRecords,
        spamFlagged: flagged,
        hiddenFromDispatcher: flagged,
      },
      genuine: {
        sent: humans.length,
        accepted: humans.filter((h) => h.status === 201 || h.status === 200).length,
        rejected: humans.filter((h) => !(h.status === 201 || h.status === 200)).length,
      },
      // Server response time: request reaches the API → response written
      // (rate limit, DB, event-loop wait). This is the "system latency".
      latency: { ...server, targetMs: 300, avgUnderTarget: server.avgMs < 300 },
      // What the attacking clients observed end-to-end (includes their own
      // socket queue: 128 keep-alive connections for 600+ requests)
      clientObserved: {
        avgMs: Math.round(avg),
        p50Ms: Math.round(pct(times, 0.5)),
        p95Ms: Math.round(pct(times, 0.95)),
        maxMs: Math.round(times.at(-1) ?? 0),
      },
      genuineFailures: humans.filter((h) => !(h.status === 201 || h.status === 200)).map((h) => `${h.status}:${h.code}`).slice(0, 5),
      errors: results.filter((r) => r.status === 0 || r.status >= 500).length,
    };
  }
}

export { FloodSimulationService };
