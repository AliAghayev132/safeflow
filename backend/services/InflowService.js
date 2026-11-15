import { inflowPerMinute, fillEtaMinutes } from "#engine";
import { ConfigService } from "./ConfigService.js";

/**
 * Live shelter inflow tracking (in-memory, per process).
 * Every occupancy change is recorded as a sample; inflow = net arrivals per
 * minute over the configured window; fill ETA = remaining / inflow.
 */
class InflowService {
  static #samples = new Map(); // shelterId -> [{ at, delta }]

  static record(shelterId, delta, at = Date.now()) {
    if (!delta) return;
    const key = String(shelterId);
    const list = InflowService.#samples.get(key) ?? [];
    list.push({ at, delta });
    // Drop samples older than 2 windows
    const keepFrom = at - 2 * ConfigService.get("shelter").inflowWindowMs;
    while (list.length && list[0].at < keepFrom) list.shift();
    InflowService.#samples.set(key, list);
  }

  static stats(shelter, now = Date.now()) {
    const { inflowWindowMs } = ConfigService.get("shelter");
    const samples = InflowService.#samples.get(String(shelter.id ?? shelter._id)) ?? [];
    const inflow = inflowPerMinute(samples, now, inflowWindowMs);
    return {
      inflowPerMin: Math.round(inflow * 10) / 10,
      fillEtaMin: fillEtaMinutes({
        capacity: shelter.capacity,
        occupancy: shelter.occupancy,
        inflow,
      }),
    };
  }

  static clear() {
    InflowService.#samples.clear();
  }
}

export { InflowService };
