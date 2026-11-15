import { Brigade } from "#models";
import { ConfigService } from "./ConfigService.js";
import { rankBrigades } from "#engine";
import { domainEvents } from "#constants";
import {
  AppError,
  toPoint,
  fromPoint,
  stepToward,
  haversineMeters,
} from "#utils";
import { eventBus } from "./EventBus.js";

const publish = (brigade) => {
  const pub = brigade.toPublic();
  BrigadeService.track(pub);
  eventBus.publish(domainEvents.BRIGADE_UPDATED, { brigade: pub });
};

/**
 * Rescue brigades: selection, dispatch, status lifecycle and a simple
 * movement simulation (straight-line travel toward the target).
 *
 *   available → dispatched → on_scene → returning → available
 */
class BrigadeService {
  // Lightweight live snapshot (id → { _id, code, name, type, status, lat, lng })
  // kept in sync by every publish — makes "nearest available brigade" an
  // in-memory lookup instead of two $near queries per SOS.
  static #snapshot = new Map();

  static track(pub) {
    BrigadeService.#snapshot.set(pub.id, {
      _id: pub.id,
      code: pub.code,
      name: pub.name,
      type: pub.type,
      status: pub.status,
      lat: pub.lat,
      lng: pub.lng,
      target: pub.target,
      statusChangedAt: pub.statusChangedAt,
    });
  }

  /**
   * Ranked brigade suggestion for a point (pure engine over the live
   * snapshot): best free brigade + ETA, alternatives, or — when none is
   * free — the one that frees up soonest.
   */
  static suggest(target, preferredType) {
    const cfg = ConfigService.get("brigade");
    return rankBrigades({
      brigades: [...BrigadeService.#snapshot.values()].map((b) => ({ ...b, id: b._id })),
      target,
      preferredType,
      cfg: { ...cfg, alternatives: cfg.suggestionAlternatives },
      now: Date.now(),
    });
  }

  static async load() {
    const docs = await Brigade.find();
    BrigadeService.#snapshot.clear();
    docs.forEach((d) => BrigadeService.track(d.toPublic()));
  }

  static list() {
    return Brigade.find().sort({ code: 1 });
  }

  static async getById(id) {
    const brigade = await Brigade.findById(id);
    if (!brigade) throw AppError.notFound("Briqada tapılmadı");
    return brigade;
  }

  /** Nearest available brigade (lightweight object), preferring the given type. */
  static async findNearestAvailable(origin, preferredType) {
    const pick = (filter) => {
      let best = null;
      let bestD = Infinity;
      for (const b of BrigadeService.#snapshot.values()) {
        if (b.status !== "available" || !filter(b)) continue;
        const d = haversineMeters(origin, b);
        if (d < bestD) {
          best = b;
          bestD = d;
        }
      }
      return best;
    };
    return (preferredType && pick((b) => b.type === preferredType)) || pick(() => true);
  }

  static async dispatch(id, target, alertId = null) {
    const brigade = await BrigadeService.getById(id);
    if (brigade.status !== "available") {
      throw AppError.conflict(`${brigade.name} hazırda boş deyil`);
    }
    brigade.status = "dispatched";
    brigade.target = toPoint(target.lat, target.lng);
    brigade.alert = alertId;
    brigade.statusChangedAt = new Date();
    await brigade.save();
    publish(brigade);
    return brigade;
  }

  /** Manual status change from the dispatcher dashboard. */
  static async setStatus(id, status) {
    const brigade = await BrigadeService.getById(id);
    brigade.status = status;
    brigade.statusChangedAt = new Date();

    if (status === "returning") brigade.target = brigade.base;
    if (status === "available") {
      brigade.target = null;
      brigade.alert = null;
    }
    await brigade.save();
    publish(brigade);
    return brigade;
  }

  /** One simulation step: move travelling brigades toward their target. */
  static async tick() {
    const { speedKmh, tickMs, arrivalMeters } = ConfigService.get("brigade");
    const stepMeters = ((speedKmh * 1000) / 3600) * (tickMs / 1000);

    const moving = await Brigade.find({
      status: { $in: ["dispatched", "returning"] },
      target: { $ne: null },
    });

    for (const brigade of moving) {
      const from = fromPoint(brigade.location);
      const to = fromPoint(brigade.target);
      const next = stepToward(from, to, stepMeters);
      const arrived = next.arrived || haversineMeters(next, to) <= arrivalMeters;

      brigade.location = toPoint(arrived ? to.lat : next.lat, arrived ? to.lng : next.lng);
      if (arrived) {
        brigade.statusChangedAt = new Date();
        if (brigade.status === "dispatched") {
          brigade.status = "on_scene";
        } else {
          brigade.status = "available";
          brigade.target = null;
          brigade.alert = null;
        }
      }
      await brigade.save();
      publish(brigade);
    }
  }
}

export { BrigadeService };
