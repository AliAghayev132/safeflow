import { Alert } from "#models";
import { AppError, toPoint, optionalCoords } from "#utils";
import { StatsService } from "#services/StatsService.js";
import { ShelterService } from "#services/ShelterService.js";
import { RoadService } from "#services/RoadService.js";
import { routingService } from "#services/RoutingService.js";
import { eventBus } from "#services/EventBus.js";
import {
  PartnerRequest,
  REQUEST_TYPES,
  REQUEST_PRIORITIES,
  REQUEST_STATUS,
} from "../models/partnerRequest.model.js";
import {
  serializeIncident,
  serializeZoneLoad,
  serializeAssemblyPoint,
  serializeRoad,
  serializeRequest,
} from "../core/serializers.js";

export const PARTNER_REQUEST_EVENT = "partner.request_updated";

const edgePath = (edge) => {
  const a = routingService.nodes.get(edge.from);
  const b = routingService.nodes.get(edge.to);
  return a && b ? [[a.lat, a.lng], [b.lat, b.lng]] : null;
};

/**
 * Read models and request intake for partner organisations. Every response
 * goes through the explicit serializers in core/serializers.js.
 */
class PartnerDataService {
  static async incidents() {
    const [alerts, zones] = await Promise.all([
      Alert.find({ status: "active" }).sort({ createdAt: -1 }).limit(200),
      StatsService.zoneLoad(),
    ]);
    return {
      incidents: alerts.map((a) => serializeIncident(a.toPublic())),
      zones: zones.map(serializeZoneLoad),
      generatedAt: new Date().toISOString(),
    };
  }

  static async assemblyPoints() {
    const shelters = await ShelterService.list({});
    return { assemblyPoints: shelters.map(serializeAssemblyPoint), generatedAt: new Date().toISOString() };
  }

  static async roads() {
    const edges = await RoadService.traffic();
    return {
      roads: edges.map((e) => serializeRoad(e, edgePath(e))),
      generatedAt: new Date().toISOString(),
    };
  }

  // ============ REQUESTS (requests:write) ============

  static async createRequest(client, body = {}) {
    const type = body.type;
    if (!REQUEST_TYPES.includes(type)) {
      throw AppError.badRequest(`type: ${REQUEST_TYPES.join(", ")}`, "PARTNER_REQUEST_TYPE");
    }
    const title = String(body.title ?? "").trim();
    if (!title) throw AppError.badRequest("title tələb olunur", "PARTNER_REQUEST_TITLE");
    const coords = optionalCoords(body.location?.lat, body.location?.lng);
    const quantity = body.quantity === undefined || body.quantity === null ? null : Number(body.quantity);
    if (quantity !== null && !(quantity >= 0)) throw AppError.badRequest("quantity ≥ 0", "PARTNER_REQUEST_QTY");

    const request = await PartnerRequest.create({
      client: client._id,
      partnerName: client.name,
      type,
      priority: REQUEST_PRIORITIES.includes(body.priority) ? body.priority : "normal",
      title: title.slice(0, 160),
      description: String(body.description ?? "").slice(0, 2000),
      quantity,
      unit: body.unit ? String(body.unit).slice(0, 30) : null,
      location: coords ? toPoint(coords.lat, coords.lng) : null,
    });
    PartnerDataService.#publish(request, "created");
    return request;
  }

  static async listOwnRequests(client, { limit = 50 } = {}) {
    const rows = await PartnerRequest.find({ client: client._id })
      .sort({ createdAt: -1 })
      .limit(Math.min(200, Number(limit) || 50));
    return rows.map(serializeRequest);
  }

  static async getOwnRequest(client, id) {
    const request = await PartnerRequest.findOne({ _id: id, client: client._id });
    if (!request) throw AppError.notFound("Sorğu tapılmadı", "PARTNER_REQUEST_NOT_FOUND");
    return serializeRequest(request);
  }

  // ============ CRISIS-CENTER SIDE ============

  static async listAll({ status, limit = 100 } = {}) {
    const filter = REQUEST_STATUS.includes(status) ? { status } : {};
    const rows = await PartnerRequest.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(500, Number(limit) || 100));
    return rows.map((r) => ({ ...serializeRequest(r), partner: r.partnerName, clientRef: r.client.toString() }));
  }

  static async updateStatus(id, { status, response }, operator) {
    if (!REQUEST_STATUS.includes(status)) throw AppError.badRequest("Status yanlışdır", "PARTNER_REQUEST_STATUS");
    const request = await PartnerRequest.findById(id);
    if (!request) throw AppError.notFound("Sorğu tapılmadı", "PARTNER_REQUEST_NOT_FOUND");
    request.status = status;
    if (typeof response === "string") request.response = response.slice(0, 1000);
    request.handledBy = operator?._id ?? null;
    await request.save();
    PartnerDataService.#publish(request, "updated");
    return request;
  }

  static #publish(request, change) {
    eventBus.publish(PARTNER_REQUEST_EVENT, {
      change,
      clientId: request.client.toString(),
      request: { ...serializeRequest(request), partner: request.partnerName },
    });
  }
}

export { PartnerDataService };
