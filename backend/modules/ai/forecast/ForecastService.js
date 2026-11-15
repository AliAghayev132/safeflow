import { SosSignal, Citizen } from "#models";
import { haversineMeters } from "#utils";
import { ShelterService } from "#services/ShelterService.js";
import { ZoneService } from "#services/ZoneService.js";
import { ConfigService } from "#services/ConfigService.js";
import { routingService } from "#services/RoutingService.js";
import { AI_EVENTS, publish } from "../common.js";
import { holtFit, holtForecast, interval, occupancyRisk } from "./holt.js";

const cfg = () => ConfigService.get("ai").forecast;

/**
 * Predictive crowd analytics (15–30 min ahead).
 *
 * A sampler records, every `sampleMs`, the occupancy of every assembly
 * point, the number of new SOS per zone, the number of people evacuating and
 * the people routed over each road segment. Holt's model is fitted per
 * series; the forecast + warnings + routing recommendations are recomputed
 * on every sample and CACHED — the API only returns the cache (O(1), well
 * under 300 ms under load).
 */
class ForecastService {
  static #series = { shelters: new Map(), zones: new Map(), evacuating: [], edges: new Map() };
  static #cache = null;
  static #timer = null;
  static #ticking = null;

  static start() {
    ForecastService.stop();
    const every = Math.max(5000, cfg().sampleMs);
    ForecastService.#timer = setInterval(() => ForecastService.tick().catch((e) => console.error("⚠️  [AI] forecast:", e.message)), every);
    ForecastService.#timer.unref?.();
  }

  static stop() {
    clearInterval(ForecastService.#timer);
    ForecastService.#timer = null;
  }

  static reset() {
    ForecastService.#series = { shelters: new Map(), zones: new Map(), evacuating: [], edges: new Map() };
    ForecastService.#cache = null;
  }

  static #push(map, key, value) {
    const list = map.get(key) ?? [];
    list.push(value);
    const max = cfg().historySamples;
    if (list.length > max) list.splice(0, list.length - max);
    map.set(key, list);
  }

  /** One sample + recompute (serialised: concurrent calls share one run). */
  static tick() {
    ForecastService.#ticking ??= ForecastService.#sample()
      .then(() => ForecastService.#compute())
      .finally(() => {
        ForecastService.#ticking = null;
      });
    return ForecastService.#ticking;
  }

  static async #sample() {
    const c = cfg();
    const since = new Date(Date.now() - c.sampleMs);
    const [shelters, sosByZone, evacuating, edgeLoad] = await Promise.all([
      ShelterService.list(),
      SosSignal.aggregate([{ $match: { createdAt: { $gte: since }, spamFlagged: { $ne: true } } }, { $group: { _id: "$zone", n: { $sum: 1 } } }]),
      Citizen.countDocuments({ status: "evacuating" }),
      Citizen.aggregate([
        { $match: { status: "evacuating", "route.edgeIds.0": { $exists: true } } },
        { $unwind: "$route.edgeIds" },
        { $group: { _id: "$route.edgeIds", n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 200 },
      ]),
    ]);
    for (const s of shelters) ForecastService.#push(ForecastService.#series.shelters, s.id, s.occupancy);
    const counts = new Map(sosByZone.map((r) => [String(r._id), r.n]));
    for (const z of ZoneService.list()) ForecastService.#push(ForecastService.#series.zones, z._id.toString(), counts.get(z._id.toString()) ?? 0);
    ForecastService.#series.evacuating.push(evacuating);
    if (ForecastService.#series.evacuating.length > c.historySamples) ForecastService.#series.evacuating.shift();
    const loads = new Map(edgeLoad.map((r) => [r._id, r.n]));
    // Track known hot edges + the current top list
    for (const id of new Set([...ForecastService.#series.edges.keys(), ...loads.keys()])) {
      ForecastService.#push(ForecastService.#series.edges, id, loads.get(id) ?? 0);
    }
  }

  static async #compute() {
    const c = cfg();
    const stepMin = c.sampleMs / 60000;
    const opts = { alpha: c.alpha, beta: c.beta };
    const shelters = await ShelterService.list();
    const horizons = c.horizonsMin;
    const steps = (h) => h / stepMin;

    // ---- Shelters
    const shelterRows = shelters
      .filter((s) => s.isActive)
      .map((s) => {
        const model = holtFit(ForecastService.#series.shelters.get(s.id) ?? [s.occupancy], opts);
        const predictions = Object.fromEntries(
          horizons.map((h) => {
            const value = Math.round(holtForecast(model, steps(h), { min: 0 }));
            const rate = s.capacity ? value / s.capacity : 0;
            return [h, { occupancy: value, rate, band: Math.round(interval(model, steps(h))), risk: occupancyRisk(rate, c.warnOccupancy) }];
          }),
        );
        return {
          id: s.id,
          code: s.code,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          capacity: s.capacity,
          occupancy: s.occupancy,
          rate: s.occupancyRate,
          trendPerMin: Math.round((model.trend / stepMin) * 10) / 10,
          samples: model.n,
          predictions,
        };
      });

    // ---- Zones (SOS surge)
    const zoneRows = ZoneService.list().map((z) => {
      const id = z._id.toString();
      const model = holtFit(ForecastService.#series.zones.get(id) ?? [0], opts);
      const h = horizons.at(-1);
      // expected new SOS over the horizon = sum of per-step forecasts
      let expected = 0;
      for (let k = 1; k <= steps(h); k++) expected += holtForecast(model, k, { min: 0 });
      return { id, code: z.code, name: z.name, sosPerMin: Math.round((model.level / stepMin) * 10) / 10, expectedSos: Math.round(expected), surge: expected >= c.surgeSosPerZone };
    });

    // ---- Road bottlenecks (people routed over a segment)
    const evModel = holtFit(ForecastService.#series.evacuating, opts);
    const evNow = ForecastService.#series.evacuating.at(-1) ?? 0;
    const growth = evNow > 0 ? holtForecast(evModel, steps(horizons.at(-1)), { min: 0 }) / evNow : 1;
    const bottlenecks = [...ForecastService.#series.edges.entries()]
      .map(([edgeId, list]) => {
        const model = holtFit(list, opts);
        const now = list.at(-1) ?? 0;
        const predicted = Math.round(Math.max(holtForecast(model, steps(horizons.at(-1)), { min: 0 }), now * growth));
        const edge = routingService.getEdge(edgeId);
        const a = edge && routingService.nodes.get(edge.from);
        const b = edge && routingService.nodes.get(edge.to);
        return {
          edgeId,
          name: edge?.name ?? edgeId,
          status: edge?.status ?? "open",
          now,
          predicted,
          congested: predicted >= c.bottleneckPeople,
          path: a && b ? [[a.lat, a.lng], [b.lat, b.lng]] : null,
        };
      })
      .filter((e) => e.now > 0 || e.predicted > 0)
      .sort((x, y) => y.predicted - x.predicted)
      .slice(0, 30);

    const { warnings, recommendations } = ForecastService.#advise(shelterRows, zoneRows, bottlenecks, shelters);

    ForecastService.#cache = {
      generatedAt: new Date(),
      model: { name: "holt-linear", alpha: c.alpha, beta: c.beta, sampleMs: c.sampleMs, samples: ForecastService.#series.evacuating.length },
      horizons,
      evacuating: { now: evNow, predicted: Math.round(evNow * growth) },
      shelters: shelterRows,
      zones: zoneRows,
      bottlenecks,
      warnings,
      recommendations,
    };
    publish(AI_EVENTS.FORECAST_UPDATED, { generatedAt: ForecastService.#cache.generatedAt, warnings: warnings.length }, "ai");
    return ForecastService.#cache;
  }

  /** Proactive warnings + routing recommendations from the forecast. */
  static #advise(shelterRows, zoneRows, bottlenecks, allShelters) {
    const c = cfg();
    const h = c.horizonsMin.at(-1);
    const warnings = [];
    const recommendations = [];
    const spare = shelterRows
      .map((s) => ({ ...s, spare: s.capacity - s.predictions[h].occupancy }))
      .filter((s) => s.predictions[h].rate < c.warnOccupancy - 0.1 && s.spare > 0);

    for (const s of shelterRows) {
      const p = s.predictions[h];
      if (p.risk === "normal" || p.risk === "elevated") continue;
      warnings.push({ kind: "shelter_overflow", severity: p.risk === "overflow" ? "critical" : "high", shelterId: s.id, name: s.name, inMinutes: h, predictedRate: p.rate });
      const alt = spare
        .filter((x) => x.id !== s.id)
        .map((x) => ({ ...x, d: haversineMeters(s, x) }))
        .sort((a, b) => a.d - b.d)[0];
      if (alt) {
        recommendations.push({ kind: "redirect", from: { id: s.id, name: s.name }, to: { id: alt.id, name: alt.name }, distanceMeters: Math.round(alt.d), capacityLeft: alt.spare });
      } else {
        const reserve = allShelters.find((x) => !x.isActive);
        if (reserve) recommendations.push({ kind: "open_reserve", near: { id: s.id, name: s.name }, shelter: { id: reserve.id, name: reserve.name } });
      }
    }
    for (const b of bottlenecks.filter((x) => x.congested)) {
      warnings.push({ kind: "bottleneck", severity: b.predicted >= c.bottleneckPeople * 2 ? "critical" : "high", edgeId: b.edgeId, name: b.name, predicted: b.predicted, inMinutes: h });
      recommendations.push({ kind: "reroute", edgeId: b.edgeId, name: b.name, people: b.predicted });
    }
    for (const z of zoneRows.filter((x) => x.surge)) {
      warnings.push({ kind: "sos_surge", severity: "high", zoneId: z.id, name: z.name, expectedSos: z.expectedSos, inMinutes: h });
      recommendations.push({ kind: "preposition_brigade", zone: { id: z.id, name: z.name }, expectedSos: z.expectedSos });
    }
    const rank = { critical: 0, high: 1 };
    warnings.sort((a, b) => rank[a.severity] - rank[b.severity]);
    return { warnings, recommendations };
  }

  /** Cached forecast (computed once on first use). */
  static async get() {
    if (!ForecastService.#cache) await ForecastService.tick();
    return ForecastService.#cache;
  }
}

export { ForecastService };
