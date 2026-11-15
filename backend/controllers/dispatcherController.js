import { Brigade, SosSignal, Alert } from "#models";
import { brigadeStatus, sosStatus } from "#constants";
import {
  StatsService,
  AlertService,
  BrigadeService,
  SosService,
  ShelterService,
  TriageService,
  ProfileService,
  AuditService,
  RbacService,
  ruleEngine,
} from "#services";
import { asyncHandler, ok, requireEnum, requireCoords, AppError } from "#utils";

/**
 * GET /api/dispatcher/brigades/suggest?lat&lng&type
 * Best free brigade + ETA, alternatives, or the soonest-free brigade.
 */
const suggestBrigade = asyncHandler(async (req, res) => {
  const target = requireCoords(req.query.lat, req.query.lng);
  return ok(res, BrigadeService.suggest(target, req.query.type ? String(req.query.type) : undefined));
});

/** GET /api/dispatcher/overview — dashboard snapshot. */
const getOverview = asyncHandler(async (_req, res) => ok(res, await StatsService.overview()));

/** GET /api/dispatcher/rules — active crisis rules + thresholds. */
const listRules = asyncHandler(async (_req, res) => ok(res, { rules: ruleEngine.list() }));

// ============ TRIAGE ============

/**
 * GET /api/dispatcher/sos/queue — open SOS by priority (highest first) with
 * citizen medical profiles when the operator may triage.
 */
const getQueue = asyncHandler(async (req, res) => {
  const queue = await TriageService.queue();
  const profiles = RbacService.can(req.principal, "sos:triage")
    ? await ProfileService.forDevices(queue.map((s) => s.deviceId))
    : {};
  return ok(res, { queue, profiles });
});

/** GET /api/dispatcher/sos/:id */
const getSos = asyncHandler(async (req, res) => {
  const sos = await SosSignal.findById(req.params.id);
  if (!sos) throw AppError.notFound("SOS tapılmadı");
  const profile = RbacService.can(req.principal, "sos:triage")
    ? await ProfileService.get(sos.deviceId)
    : null;
  return ok(res, { sos: sos.toPublic(), profile });
});

/** POST /api/dispatcher/sos/:id/assign { brigadeId? } — one-click Confirm. */
const assignSos = asyncHandler(async (req, res) => {
  const { sos, brigade } = await TriageService.assign(req.params.id, {
    brigadeId: req.body?.brigadeId ?? undefined,
  });
  await AuditService.fromRequest(
    req,
    "sos.assign",
    { type: "sos", id: sos._id, label: sos.type },
    { brigade: brigade.code, priority: sos.priority, recommended: !req.body?.brigadeId },
  );
  return ok(res, { sos: sos.toPublic(), brigade: brigade.toPublic() }, "Briqada göndərildi", 200, "SOS_ASSIGNED");
});

/** PATCH /api/dispatcher/sos/:id/status { status } */
const updateSosStatus = asyncHandler(async (req, res) => {
  const status = requireEnum(req.body?.status, sosStatus, "status");
  const sos = await SosService.setStatus(req.params.id, status);
  await AuditService.fromRequest(req, "sos.status", { type: "sos", id: req.params.id }, { status });
  return ok(res, { sos }, "SOS statusu yeniləndi", 200, "SOS_STATUS_UPDATED");
});

// ============ ALERTS ============

const listAlerts = asyncHandler(async (req, res) => {
  const alerts = await AlertService.list({ status: req.query.status, limit: 200 });
  return ok(res, { alerts: alerts.map((a) => a.toPublic()) });
});

const decide = (action, fn, code) =>
  asyncHandler(async (req, res) => {
    const choice = req.body?.brigadeId ? { brigadeId: String(req.body.brigadeId) } : {};
    const alert = await fn(req.params.id, req.operator, choice);
    await AuditService.fromRequest(
      req,
      `alert.${action}`,
      { type: "alert", id: alert._id, label: alert.title },
      { actions: alert.actions.map((a) => ({ type: a.type, executed: a.executed, result: a.result })) },
    );
    return ok(res, { alert: alert.toPublic() }, undefined, 200, code);
  });

const approveAlert = decide("approve", AlertService.approve, "ALERT_APPROVED");
const rejectAlert = decide("reject", AlertService.reject, "ALERT_REJECTED");
const resolveAlert = decide("resolve", AlertService.resolve, "ALERT_RESOLVED");

// ============ BRIGADES ============

/**
 * PATCH /api/dispatcher/brigades/:id/status { status }
 * `brigade:update` → any brigade; `brigade:update_own` → only the lead's own.
 */
const updateBrigadeStatus = asyncHandler(async (req, res) => {
  const status = requireEnum(req.body?.status, brigadeStatus, "status");
  if (status === "dispatched") {
    throw AppError.badRequest("Briqada yalnız qərar təsdiqi ilə göndərilir", "DISPATCH_VIA_DECISION");
  }
  const canAll = RbacService.can(req.principal, "brigade:update");
  const isOwn = req.principal.brigadeId === String(req.params.id);
  if (!canAll && !(isOwn && RbacService.can(req.principal, "brigade:update_own"))) {
    throw AppError.forbidden();
  }
  const brigade = await BrigadeService.setStatus(req.params.id, status);
  await AuditService.fromRequest(req, "brigade.status", { type: "brigade", id: brigade._id, label: brigade.code }, { status });
  return ok(res, { brigade: brigade.toPublic() }, "Briqada statusu yeniləndi", 200, "BRIGADE_STATUS_UPDATED");
});

/** GET /api/dispatcher/my-brigade — brigade lead's own brigade and tasks. */
const getMyBrigade = asyncHandler(async (req, res) => {
  if (!req.principal.brigadeId) throw AppError.notFound("Sizə briqada təyin olunmayıb", "NO_BRIGADE");
  const brigade = await Brigade.findById(req.principal.brigadeId);
  if (!brigade) throw AppError.notFound("Briqada tapılmadı");
  const [sos, alert] = await Promise.all([
    SosSignal.find({ brigade: brigade._id, status: { $in: ["assigned", "pending"] } }).sort({ priority: -1 }),
    brigade.alert ? Alert.findById(brigade.alert) : null,
  ]);
  return ok(res, {
    brigade: brigade.toPublic(),
    sos: sos.map((s) => s.toPublic()),
    alert: alert?.toPublic() ?? null,
  });
});

// ============ SHELTERS ============

/** PATCH /api/dispatcher/shelters/:id { isActive } */
const updateShelter = asyncHandler(async (req, res) => {
  const { isActive } = req.body ?? {};
  if (typeof isActive !== "boolean") throw AppError.badRequest("isActive (boolean) tələb olunur");
  const shelter = isActive
    ? await ShelterService.activate(req.params.id)
    : await ShelterService.deactivate(req.params.id);
  await AuditService.fromRequest(
    req,
    isActive ? "shelter.open" : "shelter.close",
    { type: "shelter", id: shelter._id, label: shelter.name },
  );
  return ok(res, { shelter: ShelterService.serialize(shelter) }, "Məntəqə yeniləndi", 200, "SHELTER_UPDATED");
});

export {
  suggestBrigade,
  getOverview,
  listRules,
  getQueue,
  getSos,
  assignSos,
  updateSosStatus,
  listAlerts,
  approveAlert,
  rejectAlert,
  resolveAlert,
  updateBrigadeStatus,
  getMyBrigade,
  updateShelter,
};
