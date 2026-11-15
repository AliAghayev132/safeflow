/**
 * In-memory sliding-window counters for SOS spam heuristics (per process).
 * Replaces two DB queries per SOS on the hot path.
 */
class SpamTracker {
  static #byDevice = new Map(); // deviceId → [ts]
  static #byIp = new Map(); // ip → Map(deviceId → lastTs)

  /** Record an SOS and return the counts the spam engine needs. */
  static record({ deviceId, ip, now = Date.now(), deviceWindowMs, ipWindowMs }) {
    const times = (SpamTracker.#byDevice.get(deviceId) ?? []).filter((t) => now - t <= deviceWindowMs);
    times.push(now);
    SpamTracker.#byDevice.set(deviceId, times);

    let ipDistinctDevices = 1;
    if (ip) {
      const devices = SpamTracker.#byIp.get(ip) ?? new Map();
      for (const [d, t] of devices) if (now - t > ipWindowMs) devices.delete(d);
      devices.set(deviceId, now);
      SpamTracker.#byIp.set(ip, devices);
      ipDistinctDevices = devices.size;
    }

    SpamTracker.#gc(now, Math.max(deviceWindowMs, ipWindowMs));
    return { deviceRecentCount: times.length, ipDistinctDevices };
  }

  static #lastGc = 0;
  static #gc(now, maxWindow) {
    if (now - SpamTracker.#lastGc < 30000) return;
    SpamTracker.#lastGc = now;
    for (const [k, v] of SpamTracker.#byDevice) {
      if (!v.length || now - v[v.length - 1] > maxWindow) SpamTracker.#byDevice.delete(k);
    }
    for (const [k, m] of SpamTracker.#byIp) {
      for (const [d, t] of m) if (now - t > maxWindow) m.delete(d);
      if (!m.size) SpamTracker.#byIp.delete(k);
    }
  }

  static clear() {
    SpamTracker.#byDevice.clear();
    SpamTracker.#byIp.clear();
  }
}

export { SpamTracker };
