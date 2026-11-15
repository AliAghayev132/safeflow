import { Shelter } from "#models";
import { domainEvents } from "#constants";
import { AppError, fromPoint, haversineMeters } from "#utils";
import { scoreShelter, rankShelters, shelterLevel, isFull } from "#engine";
import { eventBus } from "./EventBus.js";
import { ConfigService } from "./ConfigService.js";
import { RouteService } from "./RouteService.js";
import { InflowService } from "./InflowService.js";

/**
 * Assembly points: weighted selection with routing, occupancy, inflow
 * prediction, activation.
 */
class ShelterService {
  /** Public shape + live inflow / fill-time / level. */
  static serialize(shelter) {
    const pub = shelter.toPublic();
    const cfg = ConfigService.get("shelter");
    const { inflowPerMin, fillEtaMin } = InflowService.stats(pub);
    return {
      ...pub,
      level: shelterLevel(pub.occupancyRate, cfg),
      inflowPerMin,
      fillEtaMin,
      fillingFast: Number.isFinite(fillEtaMin) && fillEtaMin <= cfg.fillWarningMinutes,
    };
  }

  // ============ IN-MEMORY CACHE ============
  // Shelters are few and change only through this service, so reads are
  // served from memory (reloaded on boot / reseed). All writes go through
  // updateOccupancy / activate / deactivate, which save and keep the cache.
  static #cache = new Map(); // id → hydrated document

  static async load() {
    const docs = await Shelter.find().sort({ code: 1 });
    ShelterService.#cache = new Map(docs.map((d) => [d._id.toString(), d]));
  }

  static #all() {
    return [...ShelterService.#cache.values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  static async list(filter = {}) {
    const docs = ShelterService.#all().filter(
      (s) => filter.isActive === undefined || s.isActive === filter.isActive,
    );
    return docs.map(ShelterService.serialize);
  }

  static async getById(id) {
    const key = String(id);
    let shelter = ShelterService.#cache.get(key);
    if (!shelter) {
      shelter = await Shelter.findById(id);
      if (shelter) ShelterService.#cache.set(key, shelter);
    }
    if (!shelter) throw AppError.notFound("Toplanış məntəqəsi tapılmadı");
    return shelter;
  }

  /**
   * Candidate shelters near `origin`, each with a route and a weighted score:
   *   Score = w1·distance + w2·occupancy_penalty + w3·road_status_penalty
   * The recommendation is the best non-full shelter — not blindly the nearest.
   */
  static async findNearest(origin, { excludeIds = [] } = {}) {
    const routingCfg = ConfigService.get("routing");
    const shelterCfg = ConfigService.get("shelter");

    const excluded = new Set(excludeIds.map(String));
    const shelters = ShelterService.#all()
      .filter((s) => s.isActive && !excluded.has(s._id.toString()))
      .map((s) => ({ s, d: haversineMeters(origin, fromPoint(s.location)) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, routingCfg.candidateShelters)
      .map(({ s }) => s);

    const scored = await Promise.all(
      shelters.map(async (doc) => {
        const shelter = ShelterService.serialize(doc);
        const route = await RouteService.route(origin, shelter);
        const { score, parts } = scoreShelter(
          {
            distanceMeters: route.distanceMeters,
            occupancyRate: shelter.occupancyRate,
            roadPenalty: route.roadPenalty ?? 0,
            fillEtaMin: shelter.fillEtaMin,
          },
          { weights: routingCfg.weights, shelter: shelterCfg },
        );
        return {
          shelter,
          route,
          score,
          scoreParts: parts,
          isFull: isFull(shelter.occupancyRate, shelterCfg),
        };
      }),
    );

    const ranked = rankShelters(scored);
    const best = ranked.find((o) => !o.isFull) ?? null;

    return {
      options: ranked.map(({ shelter, route, isFull: full, score, scoreParts }) => ({
        shelter,
        isFull: full,
        score,
        scoreParts,
        distanceMeters: route.distanceMeters,
        durationSec: route.durationSec,
        provider: route.provider,
        approximate: route.approximate,
      })),
      recommended: best ? { shelter: best.shelter, route: best.route, score: best.score } : null,
      routing: best
        ? { provider: best.route.provider, approximate: best.route.approximate, fallback: best.route.fallback }
        : null,
    };
  }

  /** Set an absolute occupancy or apply a delta, then publish the change. */
  static async updateOccupancy(id, { occupancy, delta }) {
    const shelter = await ShelterService.getById(id);
    const previous = shelter.occupancy;
    const previousRate = shelter.occupancyRate;

    let next = shelter.occupancy;
    if (Number.isFinite(occupancy)) next = occupancy;
    if (Number.isFinite(delta)) next += delta;
    shelter.occupancy = Math.max(0, Math.min(shelter.capacity, Math.round(next)));
    await shelter.save();

    InflowService.record(shelter._id, shelter.occupancy - previous);

    eventBus.publish(domainEvents.SHELTER_UPDATED, {
      shelter: ShelterService.serialize(shelter),
      previousRate,
    });
    return shelter;
  }

  /** Open a (reserve) shelter. Idempotent. */
  static async activate(id) {
    const shelter = await ShelterService.getById(id);
    if (shelter.isActive) return shelter;

    shelter.isActive = true;
    shelter.openedAt = new Date();
    await shelter.save();

    const payload = { shelter: ShelterService.serialize(shelter), previousRate: shelter.occupancyRate };
    eventBus.publish(domainEvents.SHELTER_UPDATED, payload);
    eventBus.publish(domainEvents.SHELTER_ACTIVATED, payload);
    return shelter;
  }

  static async deactivate(id) {
    const shelter = await ShelterService.getById(id);
    if (!shelter.isActive) return shelter;
    shelter.isActive = false;
    await shelter.save();
    eventBus.publish(domainEvents.SHELTER_UPDATED, {
      shelter: ShelterService.serialize(shelter),
      previousRate: shelter.occupancyRate,
    });
    return shelter;
  }

  /** Nearest closed reserve shelter to a point (for "open new point"). */
  static async findReserveNear(origin) {
    let best = null;
    let bestD = Infinity;
    for (const s of ShelterService.#cache.values()) {
      if (s.isActive || !s.isReserve) continue;
      const d = haversineMeters(origin, fromPoint(s.location));
      if (d < bestD) {
        best = s;
        bestD = d;
      }
    }
    return best;
  }
}

export { ShelterService };
