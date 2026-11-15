import { ConfigService } from "#services/ConfigService.js";
import { ShelterService } from "#services/ShelterService.js";
import { AppError } from "#utils";
import { SupplyRequest, supplyKinds, supplyPriority } from "../models/index.js";
import { estimateNeeds, itemsWeightKg, UNITS } from "../logic.js";
import { publishSupply } from "./realtime.js";

const LABELS = { water: "su", food: "qida payı", medicine: "dərman dəsti", first_aid: "ilk yardım dəsti" };

/** "500 nəfərə 1500 L su, 1000 qida payı, …" — Azerbaijani fallback text. */
const describeNeeds = (people, items) =>
  `${people} nəfərə ${items.map((i) => `${i.quantity} ${i.unit === "L" ? "L " : ""}${LABELS[i.kind]}`).join(", ")}`;

const cleanItems = (items) => {
  if (!Array.isArray(items) || !items.length) throw AppError.badRequest("Ən azı bir təchizat növü tələb olunur", "SUPPLY_ITEMS_REQUIRED");
  return items.map((i) => {
    const kind = String(i?.kind);
    const quantity = Math.round(Number(i?.quantity));
    if (!supplyKinds.includes(kind)) throw AppError.badRequest(`Naməlum təchizat növü: ${kind}`, "SUPPLY_KIND");
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 1_000_000) {
      throw AppError.badRequest("Miqdar 1 ilə 1 000 000 arasında olmalıdır", "SUPPLY_QUANTITY");
    }
    return { kind, quantity, unit: UNITS[kind] };
  });
};

/**
 * Supply requests for assembly points + need estimation from occupancy.
 */
class SupplyService {
  /** Proposed request for a shelter from its current occupancy. */
  static async estimate(shelterId) {
    const shelter = await ShelterService.getById(shelterId);
    const cfg = ConfigService.get("drones");
    const people = shelter.occupancy;
    const items = estimateNeeds(people, cfg.ratios);
    return {
      shelter: { id: shelter._id.toString(), name: shelter.name, code: shelter.code, occupancy: people, capacity: shelter.capacity },
      people,
      items,
      totalKg: itemsWeightKg(items, cfg.unitWeightKg),
      text: items.length ? describeNeeds(people, items) : "",
      i18n: { key: "drones.estimate", params: { people } },
    };
  }

  static async create({ shelterId, items, priority = "normal", note = "", source = "manual", createdBy = null }) {
    const shelter = await ShelterService.getById(shelterId);
    const clean = cleanItems(items);
    if (!supplyPriority.includes(priority)) throw AppError.badRequest("Yanlış prioritet", "SUPPLY_PRIORITY");
    const request = await SupplyRequest.create({
      shelter: shelter._id,
      items: clean,
      priority,
      note: String(note ?? "").slice(0, 280),
      source,
      totalKg: itemsWeightKg(clean, ConfigService.get("drones").unitWeightKg),
      createdBy: createdBy ? { id: createdBy._id, username: createdBy.username } : { id: null, username: "system" },
    });
    publishSupply(request.toPublic());
    return request;
  }

  static async list({ shelterId, status, limit = 200 } = {}) {
    const filter = {};
    if (shelterId) filter.shelter = shelterId;
    if (status) filter.status = { $in: String(status).split(",") };
    const rows = await SupplyRequest.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .limit(Math.min(500, Number(limit) || 200));
    // urgent first ("urgent" > "normal" alphabetically → desc sort works)
    return rows.map((r) => r.toPublic());
  }

  static async getById(id) {
    const request = await SupplyRequest.findById(id);
    if (!request) throw AppError.notFound("Təchizat sorğusu tapılmadı", "SUPPLY_NOT_FOUND");
    return request;
  }

  static async cancel(id) {
    const request = await SupplyService.getById(id);
    if (!["pending", "in_progress"].includes(request.status)) {
      throw AppError.conflict("Sorğu artıq bağlanıb", "SUPPLY_CLOSED");
    }
    if (request.dispatchedKg > request.deliveredKg) {
      throw AppError.conflict("Yolda olan çatdırılma var", "SUPPLY_IN_FLIGHT");
    }
    request.status = "cancelled";
    await request.save();
    publishSupply(request.toPublic());
    return request;
  }

  /**
   * Rule hook: propose a request when a shelter fills up, unless it already
   * has an open one.
   */
  static async autoPropose(shelter) {
    const open = await SupplyRequest.exists({ shelter: shelter.id, status: { $in: ["pending", "in_progress"] } });
    if (open) return null;
    const estimate = await SupplyService.estimate(shelter.id);
    if (!estimate.items.length) return null;
    return SupplyService.create({
      shelterId: shelter.id,
      items: estimate.items,
      priority: shelter.occupancyRate >= 0.9 ? "urgent" : "normal",
      note: estimate.text,
      source: "auto",
    });
  }
}

export { SupplyService };
