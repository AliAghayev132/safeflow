import { AppError } from "#utils";
import { ShelterService } from "#services/ShelterService.js";
import { ConfigService } from "#services/ConfigService.js";
import { Drone, SupplyRequest } from "../../drones/models/index.js";
import { dronesDefaults } from "../../drones/defaults.js";
import { SupplyService } from "../../drones/services/SupplyService.js";
import { ForecastService } from "../forecast/ForecastService.js";
import { AI_EVENTS, publish } from "../common.js";
import { planDistribution } from "./planner.js";

const DEFAULT_FLEET_SPEED = 60;

/**
 * AI supply chain & resource distribution: deficits per assembly point
 * (forecast occupancy × per-person ratios − stock − already requested) →
 * prioritised drone delivery schedule. Recomputed in the background with
 * every forecast sample and cached; GET is O(1).
 */
class SupplyPlanService {
  static #cache = null;
  static #computing = null;

  static async #stock() {
    // Delivered quantities (scaled by delivered share) minus consumption since delivery
    const cfg = ConfigService.get("drones") ?? dronesDefaults;
    const rows = await SupplyRequest.find({ status: { $in: ["delivered", "pending", "in_progress"] } }, { shelter: 1, items: 1, status: 1, totalKg: 1, deliveredKg: 1, updatedAt: 1 }).lean();
    const stock = new Map();
    const outstanding = new Map();
    for (const r of rows) {
      const key = String(r.shelter);
      const target = r.status === "delivered" ? stock : outstanding;
      const share = r.status === "delivered" ? 1 : Math.max(0, 1 - (r.deliveredKg || 0) / (r.totalKg || 1));
      const acc = target.get(key) ?? {};
      for (const i of r.items) acc[i.kind] = (acc[i.kind] ?? 0) + Math.round(i.quantity * share);
      target.set(key, acc);
      if (r.status !== "delivered" && r.deliveredKg > 0) {
        // the delivered part of an in-progress request is stock already
        const s = stock.get(key) ?? {};
        for (const i of r.items) s[i.kind] = (s[i.kind] ?? 0) + Math.round(i.quantity * (r.deliveredKg / (r.totalKg || 1)));
        stock.set(key, s);
      }
    }
    return { stock, outstanding, ratios: cfg.ratios, unitWeightKg: cfg.unitWeightKg, loadingSec: cfg.loadingSec ?? 60 };
  }

  static async compute() {
    SupplyPlanService.#computing ??= (async () => {
      const ai = ConfigService.get("ai").supply;
      const [forecast, shelters, inv, drones] = await Promise.all([
        ForecastService.get(),
        ShelterService.list({ isActive: true }),
        SupplyPlanService.#stock(),
        Drone.find().lean(),
      ]);
      const h = ai.horizonMin;
      const fc = new Map(
        (forecast?.shelters ?? []).map((s) => {
          const key = Object.keys(s.predictions).map(Number).sort((a, b) => Math.abs(a - h) - Math.abs(b - h))[0];
          return [s.id, s.predictions[key]?.occupancy ?? s.occupancy];
        }),
      );
      const fleet = drones
        .filter((d) => d.status !== "charging" || d.batteryPct > 40)
        .map((d) => ({
          id: d._id.toString(),
          code: d.code,
          payloadKg: d.payloadKg,
          speedKmh: d.speedKmh || DEFAULT_FLEET_SPEED,
          base: { lat: d.base.coordinates[1], lng: d.base.coordinates[0] },
          freeInSec: d.status === "idle" ? 0 : 15 * 60, // busy drones: conservative estimate
        }));
      const plan = planDistribution(
        shelters.map((s) => ({
          id: s.id,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          people: s.occupancy,
          forecastPeople: fc.get(s.id) ?? s.occupancy,
          stock: inv.stock.get(s.id) ?? {},
          outstanding: inv.outstanding.get(s.id) ?? {},
        })),
        fleet,
        { ratios: inv.ratios, unitWeightKg: inv.unitWeightKg, targetHours: ai.targetHours, criticalHours: ai.criticalHours, loadingSec: inv.loadingSec },
      );
      SupplyPlanService.#cache = {
        generatedAt: new Date(),
        horizonMin: h,
        fleet: fleet.length,
        forecastAt: forecast?.generatedAt ?? null,
        ...plan,
      };
      publish(AI_EVENTS.SUPPLY_PLAN_UPDATED, { generatedAt: SupplyPlanService.#cache.generatedAt, totals: plan.totals }, "ai");
      return SupplyPlanService.#cache;
    })().finally(() => {
      SupplyPlanService.#computing = null;
    });
    return SupplyPlanService.#computing;
  }

  static async get() {
    return SupplyPlanService.#cache ?? SupplyPlanService.compute();
  }

  static reset() {
    SupplyPlanService.#cache = null;
  }

  /**
   * Turn plan rows into real supply requests (drones module flow: the
   * dispatcher still approves each drone dispatch).
   */
  static async apply({ shelterIds, operator }) {
    if (!ConfigService.isEnabled("drones")) throw AppError.conflict("Dron modulu söndürülüb", "DRONES_DISABLED");
    const plan = await SupplyPlanService.get();
    const wanted = shelterIds?.length ? new Set(shelterIds.map(String)) : null;
    const rows = plan.shelters.filter((r) => r.deficitKg > 0 && (!wanted || wanted.has(r.shelterId)));
    const created = [];
    for (const r of rows) {
      const items = Object.entries(r.deficit)
        .filter(([, q]) => q > 0)
        .map(([kind, quantity]) => ({ kind, quantity }));
      if (!items.length) continue;
      const req = await SupplyService.create({
        shelterId: r.shelterId,
        items,
        priority: r.critical ? "urgent" : "normal",
        note: `AI plan · prioritet ${r.priority}${r.coverageHours != null ? ` · ehtiyat ~${r.coverageHours} saat` : ""}`.slice(0, 280),
        source: "auto",
        createdBy: operator,
      });
      created.push(req.toPublic());
    }
    await SupplyPlanService.compute();
    return created;
  }
}

export { SupplyPlanService };
