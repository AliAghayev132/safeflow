import { sosTypes, citizenStatus } from "#constants";
import {
  ZoneService,
  CitizenService,
  SosService,
  ShelterService,
  RoadService,
  ProfileService,
  SafeShareService,
} from "#services";
import {
  asyncHandler,
  ok,
  AppError,
  requireDeviceId,
  requireCoords,
  optionalCoords,
  requireEnum,
  isDeviceId,
} from "#utils";

/** Origin from ?lat&lng, or from ?zone=<code> (district center). */
const resolveOrigin = async ({ lat, lng, zone }) => {
  const coords = optionalCoords(lat, lng);
  if (coords) return coords;
  if (zone) {
    const found = await ZoneService.findByCode(zone);
    if (!found) throw AppError.notFound("Rayon tapılmadı", "ZONE_NOT_FOUND");
    return { lat: found.center.coordinates[1], lng: found.center.coordinates[0] };
  }
  throw AppError.badRequest("Koordinat (lat, lng) və ya rayon (zone) tələb olunur", "ORIGIN_REQUIRED");
};

const requireClientId = (value) => {
  if (!isDeviceId(value)) throw AppError.badRequest("clientId (UUID) tələb olunur", "CLIENT_ID_REQUIRED");
  return value;
};

const pickDetails = (b = {}) => ({
  accessibility: b.accessibility,
  needs: b.needs,
  headcount: b.headcount,
  vulnerable: b.vulnerable,
  injuries: b.injuries,
  note: b.note,
  transcript: b.transcript,
});

/** GET /api/citizen/zones */
const listZones = asyncHandler(async (_req, res) => {
  const zones = await ZoneService.list();
  return ok(res, { zones: zones.map((z) => z.toPublic()) });
});

/** GET /api/citizen/shelters — all active shelters with live inflow / fill ETA. */
const listShelters = asyncHandler(async (_req, res) => {
  const shelters = await ShelterService.list({ isActive: true });
  return ok(res, { shelters, generatedAt: new Date() });
});

/**
 * GET /api/citizen/evacuation?lat&lng | ?zone=CODE [&deviceId]
 * Weighted shelter options + recommended route (with routing provider and
 * an `approximate` flag when the fallback answered).
 */
const getEvacuationPlan = asyncHandler(async (req, res) => {
  const origin = await resolveOrigin(req.query);
  const deviceId = isDeviceId(req.query.deviceId) ? req.query.deviceId : null;
  const mode = req.query.mode === "accessible" ? "accessible" : undefined;
  return ok(res, await CitizenService.planEvacuation({ deviceId, origin, mode }));
});

/** GET /api/citizen/state?deviceId — status + active route + own SOS. */
const getState = asyncHandler(async (req, res) => {
  const deviceId = requireDeviceId(req.query.deviceId);
  const [state, sos] = await Promise.all([
    CitizenService.getState(deviceId),
    SosService.listByDevice(deviceId, 10),
  ]);
  return ok(res, { state, sos: sos.map((s) => s.toPublic()) });
});

/**
 * POST /api/citizen/sos
 * { clientId, deviceId, type, lat, lng, needs?, headcount?, vulnerable?,
 *   injuries?, note?, transcript?, queuedOffline?, clientCreatedAt? }
 * Idempotent on clientId: a retry returns the original ticket (200).
 */
const sendSos = asyncHandler(async (req, res) => {
  const b = req.body ?? {};
  const result = await SosService.create({
    clientId: requireClientId(b.clientId),
    deviceId: requireDeviceId(b.deviceId),
    type: requireEnum(b.type, sosTypes, "type"),
    origin: requireCoords(b.lat, b.lng),
    ip: req.ip,
    details: pickDetails(b),
    queuedOffline: b.queuedOffline === true,
    clientCreatedAt: b.clientCreatedAt,
  });
  return ok(
    res,
    result,
    result.duplicate ? "SOS siqnalınız artıq qəbul edilib" : "SOS siqnalı göndərildi",
    result.duplicate ? 200 : 201,
    result.duplicate ? "SOS_DUPLICATE" : "SOS_CREATED",
  );
});

/** PATCH /api/citizen/sos/:clientId — optional follow-up answers. */
const updateSosDetails = asyncHandler(async (req, res) => {
  const sos = await SosService.updateDetails({
    clientId: requireClientId(req.params.clientId),
    deviceId: requireDeviceId(req.body?.deviceId),
    details: pickDetails(req.body),
  });
  return ok(res, { sos }, "Məlumat əlavə olundu", 200, "SOS_DETAILS_SAVED");
});

/** PATCH /api/citizen/status { deviceId, status, lat?, lng? } */
const updateStatus = asyncHandler(async (req, res) => {
  const { deviceId, status, lat, lng } = req.body ?? {};
  const state = await CitizenService.setStatus({
    deviceId: requireDeviceId(deviceId),
    status: requireEnum(status, citizenStatus, "status"),
    origin: optionalCoords(lat, lng),
  });
  return ok(res, { state }, "Status yeniləndi", 200, "STATUS_UPDATED");
});

/** POST /api/citizen/checkin { deviceId } — arrived at the shelter. */
const checkIn = asyncHandler(async (req, res) => {
  const state = await CitizenService.checkIn(requireDeviceId(req.body?.deviceId));
  return ok(res, { state }, "Məntəqəyə çatdığınız qeydə alındı", 200, "CHECKED_IN");
});

/** GET /api/citizen/roads — network + live traffic for the map. */
const getRoads = asyncHandler(async (_req, res) => ok(res, RoadService.network()));

// ============ PROFILE (optional) ============

const getProfile = asyncHandler(async (req, res) =>
  ok(res, { profile: await ProfileService.get(requireDeviceId(req.query.deviceId)) }),
);

const saveProfile = asyncHandler(async (req, res) => {
  const profile = await ProfileService.upsert(requireDeviceId(req.body?.deviceId), req.body);
  return ok(res, { profile }, "Profil yadda saxlanıldı", 200, "PROFILE_SAVED");
});

const deleteProfile = asyncHandler(async (req, res) => {
  await ProfileService.remove(requireDeviceId(req.query.deviceId ?? req.body?.deviceId));
  return ok(res, null, "Profil silindi", 200, "PROFILE_DELETED");
});

// ============ SAFE SHARE ============

/** POST /api/citizen/safe-share { deviceId, lat?, lng?, displayName?, message? } */
const createSafeShare = asyncHandler(async (req, res) => {
  const b = req.body ?? {};
  const share = await SafeShareService.create({
    deviceId: requireDeviceId(b.deviceId),
    origin: optionalCoords(b.lat, b.lng),
    displayName: b.displayName ?? "",
    message: b.message ?? "",
  });
  return ok(res, { share }, "Təhlükəsiz olduğunuz qeydə alındı", 201, "SAFE_SHARED");
});

/** GET /api/public/safe/:token */
const getSafeShare = asyncHandler(async (req, res) =>
  ok(res, { share: await SafeShareService.get(String(req.params.token)) }),
);

export {
  listZones,
  listShelters,
  getEvacuationPlan,
  getState,
  sendSos,
  updateSosDetails,
  updateStatus,
  checkIn,
  getRoads,
  getProfile,
  saveProfile,
  deleteProfile,
  createSafeShare,
  getSafeShare,
};
