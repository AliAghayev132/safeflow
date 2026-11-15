import { RbacService } from "#services/RbacService.js";
import { AuditService } from "#services/AuditService.js";
import { asyncHandler, ok, AppError } from "#utils";
import { DroneService } from "../services/DroneService.js";
import { SupplyService } from "../services/SupplyService.js";
import { Delivery } from "../models/index.js";

/**
 * Shelter scoping: a principal without `supplies:manage` but linked to a
 * shelter (shelter_manager) only ever sees / acts on its own shelter.
 * Returns the forced shelter id, or null for unrestricted staff.
 */
const scopedShelter = (req) => {
  if (RbacService.can(req.principal, "supplies:manage")) return null;
  if (!req.principal.shelterId) throw AppError.forbidden("Sizə məntəqə təyin olunmayıb", "NO_SHELTER");
  return req.principal.shelterId;
};

// ============ FLEET ============

/** GET /api/drones/fleet */
const listFleet = asyncHandler(async (_req, res) =>
  ok(res, { drones: await DroneService.list(), provider: DroneService.provider?.name ?? null }),
);

// ============ SUPPLY REQUESTS ============

/** GET /api/drones/requests?status= */
const listRequests = asyncHandler(async (req, res) => {
  const shelterId = scopedShelter(req) ?? req.query.shelterId ?? undefined;
  return ok(res, { requests: await SupplyService.list({ shelterId, status: req.query.status }) });
});

/** GET /api/drones/estimate?shelterId= — occupancy-based proposal */
const estimate = asyncHandler(async (req, res) => {
  const shelterId = scopedShelter(req) ?? req.query.shelterId;
  if (!shelterId) throw AppError.badRequest("shelterId tələb olunur", "SHELTER_REQUIRED");
  return ok(res, { estimate: await SupplyService.estimate(shelterId) });
});

/** POST /api/drones/requests { shelterId, items[], priority, note } */
const createRequest = asyncHandler(async (req, res) => {
  const forced = scopedShelter(req);
  const shelterId = forced ?? req.body?.shelterId;
  if (!shelterId) throw AppError.badRequest("shelterId tələb olunur", "SHELTER_REQUIRED");
  const request = await SupplyService.create({
    shelterId,
    items: req.body?.items,
    priority: req.body?.priority ?? "normal",
    note: req.body?.note ?? "",
    createdBy: req.operator,
  });
  await AuditService.fromRequest(
    req,
    "supply.request",
    { type: "supply_request", id: request._id, label: String(shelterId) },
    { items: request.items, priority: request.priority, totalKg: request.totalKg },
  );
  return ok(res, { request: request.toPublic() }, "Təchizat sorğusu yaradıldı", 201, "SUPPLY_CREATED");
});

/** GET /api/drones/requests/:id/suggest — ranked drones for the request */
const suggest = asyncHandler(async (req, res) => ok(res, await DroneService.suggest(req.params.id)));

/** POST /api/drones/requests/:id/approve { droneId? } — one-click dispatch */
const approve = asyncHandler(async (req, res) => {
  const { request, delivery, drone } = await DroneService.approve(req.params.id, { droneId: req.body?.droneId }, req.operator);
  await AuditService.fromRequest(
    req,
    "drone.dispatch",
    { type: "supply_request", id: request._id, label: drone.code },
    { drone: drone.code, loadKg: delivery.loadKg, etaSec: delivery.etaSec, override: Boolean(req.body?.droneId) },
  );
  return ok(
    res,
    { request: request.toPublic(), delivery: delivery.toPublic(), drone },
    "Dron yola salındı",
    200,
    "DRONE_DISPATCHED",
  );
});

/** POST /api/drones/requests/:id/cancel */
const cancel = asyncHandler(async (req, res) => {
  const request = await SupplyService.cancel(req.params.id);
  await AuditService.fromRequest(req, "supply.cancel", { type: "supply_request", id: request._id });
  return ok(res, { request: request.toPublic() }, "Sorğu ləğv edildi", 200, "SUPPLY_CANCELLED");
});

// ============ DELIVERIES ============

/** GET /api/drones/deliveries?active=1 */
const listDeliveries = asyncHandler(async (req, res) => {
  const shelterId = scopedShelter(req) ?? req.query.shelterId ?? undefined;
  return ok(res, { deliveries: await DroneService.deliveries({ shelterId, active: req.query.active === "1" }) });
});

/** POST /api/drones/deliveries/:id/confirm — shelter confirms receipt */
const confirm = asyncHandler(async (req, res) => {
  const forced = scopedShelter(req);
  if (forced) {
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) throw AppError.notFound("Çatdırılma tapılmadı", "DELIVERY_NOT_FOUND");
    if (String(delivery.shelter) !== String(forced)) throw AppError.forbidden();
  }
  const { delivery, request } = await DroneService.confirm(req.params.id, req.operator);
  await AuditService.fromRequest(
    req,
    "supply.receipt",
    { type: "delivery", id: delivery._id },
    { loadKg: delivery.loadKg, requestStatus: request.status },
  );
  return ok(
    res,
    { delivery: delivery.toPublic(), request: request.toPublic() },
    "Qəbul təsdiqləndi",
    200,
    "DELIVERY_CONFIRMED",
  );
});

export {
  listFleet,
  listRequests,
  estimate,
  createRequest,
  suggest,
  approve,
  cancel,
  listDeliveries,
  confirm,
};
