import { crypto } from "#lib";
import { AppError, toPoint, haversineMeters, fromPoint } from "#utils";
import { RoadService } from "#services/RoadService.js";
import { ZoneService } from "#services/ZoneService.js";
import { ConfigService } from "#services/ConfigService.js";
import { routingService } from "#services/RoutingService.js";
import { VisionService } from "../providers/VisionService.js";
import { AI_EVENTS, background, publish } from "../common.js";
import { DamageAssessment } from "./damageAssessment.model.js";

const cfg = () => ConfigService.get("ai").vision;

/** Midpoint of a road segment (graph nodes are in memory). */
const midpoint = (edge) => {
  const a = routingService.nodes.get(edge.from);
  const b = routingService.nodes.get(edge.to);
  if (!a || !b) return null;
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
};

/** Road segments whose midpoint lies within `radius` of the point, nearest first. */
export const edgesNear = (point, radius) =>
  [...routingService.edges.values()]
    .map((e) => ({ edge: e, mid: midpoint(e) }))
    .filter((x) => x.mid)
    .map((x) => ({ ...x, d: haversineMeters(point, x.mid) }))
    .filter((x) => x.d <= radius)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.edge);

/**
 * AI damage assessment of drone frames / photos.
 *
 * The request only stores the job (fast, < 300 ms even under load); the
 * vision model runs in the background. A confident "blocked"/"collapsed"
 * result closes the nearby road segments, "partial" marks them damaged
 * (barrier-free routes avoid them) — the dispatcher map updates through
 * the normal road:updated events, plus an `ai:damage` event.
 */
class DamageService {
  static async submit({ buffer, mime, lat, lng, source = "drone", droneCode = null, operator = null, synthetic = false }) {
    if (!buffer?.length) throw AppError.badRequest("Şəkil tələb olunur", "IMAGE_REQUIRED");
    const doc = await DamageAssessment.create({
      source,
      droneCode,
      location: toPoint(lat, lng),
      imageHash: crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16),
      imageBytes: buffer.length,
      createdBy: operator?.username ?? "system",
    });
    background("damage assessment", () => DamageService.#run(doc._id, buffer, mime, synthetic));
    return doc;
  }

  static async #run(id, buffer, mime, synthetic) {
    const started = Date.now();
    const doc = await DamageAssessment.findById(id);
    if (!doc) return;
    try {
      const r = await VisionService.assess({ buffer, mimeType: mime, synthetic });
      Object.assign(doc, {
        status: "done",
        severity: r.severity,
        passable: r.passable,
        confidence: r.confidence,
        summary: r.summary,
        hazards: r.hazards,
        detections: r.detections,
        provider: r.provider,
        mock: r.mock,
        durationMs: Date.now() - started,
      });
      await doc.save();
      if (cfg().autoApply && (doc.confidence ?? 0) >= cfg().autoApplyMinConfidence) await DamageService.#apply(doc);
    } catch (error) {
      doc.status = "failed";
      doc.summary = error.message;
      await doc.save();
    }
    publish(AI_EVENTS.DAMAGE_ASSESSED, doc.toPublic(), "damage");
  }

  /** Map hazard status from the result (closed / damaged segments). */
  static async #apply(doc) {
    const c = cfg();
    if (!["partial", "blocked", "collapsed"].includes(doc.severity)) return;
    const point = fromPoint(doc.location);
    const near = edgesNear(point, c.affectRadiusMeters).slice(0, doc.severity === "collapsed" ? 4 : 2);
    const applied = [];
    for (const edge of near) {
      if (doc.severity === "partial") {
        if (edge.damaged) continue;
        await RoadService.setBarrier(edge.edgeId, "damaged", true);
        applied.push({ edgeId: edge.edgeId, action: "damaged" });
      } else if (edge.status !== "closed") {
        await RoadService.close(edge.edgeId, `AI: ${doc.severity === "collapsed" ? "bina uçub" : "yol bağlıdır"}`);
        applied.push({ edgeId: edge.edgeId, action: "closed" });
      }
    }
    if (applied.length) {
      doc.applied = applied;
      await doc.save();
    }
  }

  /** Dispatcher approves an AI proposal → the map changes (human in the loop). */
  static async approve(id) {
    const doc = await DamageAssessment.findById(id);
    if (!doc) throw AppError.notFound("Qiymətləndirmə tapılmadı");
    if (doc.status !== "done") throw AppError.conflict("Analiz hələ hazır deyil və ya artıq emal olunub");
    if (doc.applied.length) return doc;
    await DamageService.#apply(doc);
    publish(AI_EVENTS.DAMAGE_ASSESSED, doc.toPublic(), "damage");
    return doc;
  }

  /** Undo what an assessment changed on the road network (false positive). */
  static async revert(id) {
    const doc = await DamageAssessment.findById(id);
    if (!doc) throw AppError.notFound("Qiymətləndirmə tapılmadı");
    for (const a of doc.applied) {
      if (a.action === "closed") await RoadService.open(a.edgeId).catch(() => null);
      else await RoadService.setBarrier(a.edgeId, "damaged", false).catch(() => null);
    }
    doc.status = "reverted";
    await doc.save();
    publish(AI_EVENTS.DAMAGE_ASSESSED, doc.toPublic(), "damage");
    return doc;
  }

  static async list({ limit = 100 } = {}) {
    const rows = await DamageAssessment.find().sort({ createdAt: -1 }).limit(Math.min(500, limit));
    return rows.map((d) => d.toPublic());
  }

  /**
   * Simulated drone survey (demo): a drone flies over a zone or point and
   * sends `frames` images of road segments; each frame is analysed like a
   * real one. With a real YOLO/vision provider the same pipeline runs on the
   * drone's actual frames (POST /api/ai/damage/assess).
   */
  static async droneSurvey({ zoneCode, lat, lng, frames = 6, droneCode = "SURVEY-1", operator }) {
    const zone = zoneCode ? ZoneService.findByCode(zoneCode) : null;
    const center = zone ? fromPoint(zone.center) : Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    if (!center) throw AppError.badRequest("Zona və ya koordinat tələb olunur", "SURVEY_TARGET");
    const n = Math.max(1, Math.min(20, Math.round(frames)));
    const edges = edgesNear(center, 1500).filter((e) => e.status === "open").slice(0, n * 2);
    if (!edges.length) throw AppError.conflict("Ərazidə açıq yol seqmenti yoxdur");
    const picked = edges.filter((_, i) => i % 2 === 0).slice(0, n);
    const seed = Date.now().toString(36);
    const docs = [];
    for (const edge of picked) {
      const mid = midpoint(edge);
      // Synthetic frame bytes (deterministic per segment + survey)
      const frame = crypto.createHash("sha512").update(`${edge.edgeId}:${seed}`).digest();
      docs.push(
        await DamageService.submit({ buffer: frame, mime: "image/jpeg", lat: mid.lat, lng: mid.lng, source: "drone", droneCode, operator, synthetic: true }),
      );
    }
    return docs;
  }
}

export { DamageService };
