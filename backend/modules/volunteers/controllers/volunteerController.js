import { readFile } from "node:fs/promises";
import { asyncHandler, ok, requireDeviceId, optionalCoords, AppError } from "#utils";
import { RbacService, AuditService } from "#services";
import { VolunteerService, RequestService } from "../services/index.js";

/** Exact volunteer positions: dispatchers only (permission sos:assign). */
const canSeeExact = (req) => RbacService.can(req.principal, "sos:assign");

// ============ VOLUNTEER (device) ============

/** GET /api/volunteers/me?deviceId */
const getMe = asyncHandler(async (req, res) => {
  const profile = await VolunteerService.get(requireDeviceId(req.deviceId));
  return ok(res, { profile: profile?.toSelf() ?? null });
});

/** PUT /api/volunteers/me { deviceId, profession, skills, displayName, phone, consent } */
const saveMe = asyncHandler(async (req, res) => {
  const profile = await VolunteerService.upsert(requireDeviceId(req.deviceId), req.body ?? {});
  return ok(res, { profile: profile.toSelf() }, "Könüllü profili yadda saxlanıldı", 200, "VOLUNTEER_SAVED");
});

/** POST /api/volunteers/me/withdraw — withdraw consent */
const withdraw = asyncHandler(async (req, res) => {
  const profile = await VolunteerService.withdrawConsent(requireDeviceId(req.deviceId));
  return ok(res, { profile: profile.toSelf() }, "Razılıq geri götürüldü", 200, "VOLUNTEER_WITHDRAWN");
});

/** PATCH /api/volunteers/me/availability { availability } */
const setAvailability = asyncHandler(async (req, res) => {
  const profile = await VolunteerService.setAvailability(requireDeviceId(req.deviceId), req.body?.availability);
  return ok(res, { profile: profile.toSelf() }, undefined, 200, "VOLUNTEER_AVAILABILITY");
});

/** POST /api/volunteers/me/location { lat?, lng?, shelterId? } */
const updateLocation = asyncHandler(async (req, res) => {
  const b = req.body ?? {};
  const profile = await VolunteerService.updateLocation(requireDeviceId(req.deviceId), {
    origin: optionalCoords(b.lat, b.lng),
    shelterId: b.shelterId,
  });
  return ok(res, { profile: profile.toSelf() });
});

/**
 * POST /api/volunteers/me/documents?deviceId&name=<file name>
 * Raw body (Content-Type application/pdf | image/png | image/jpeg).
 */
const uploadDocument = asyncHandler(async (req, res) => {
  const deviceId = requireDeviceId(req.deviceId);
  if (!Buffer.isBuffer(req.body)) {
    throw AppError.badRequest("Fayl növü dəstəklənmir (PDF, PNG, JPEG)", "VOLUNTEER_DOC_TYPE");
  }
  const profile = await VolunteerService.addDocument(deviceId, {
    buffer: req.body,
    mime: String(req.headers["content-type"] ?? "").split(";")[0].trim(),
    originalName: req.query.name ?? req.headers["x-filename"],
  });
  return ok(res, { profile: profile.toSelf() }, "Sənəd yükləndi", 201, "VOLUNTEER_DOC_UPLOADED");
});

/** GET /api/volunteers/me/requests?deviceId */
const myRequests = asyncHandler(async (req, res) =>
  ok(res, { requests: await RequestService.forVolunteer(requireDeviceId(req.deviceId)) }),
);

/** POST /api/volunteers/requests/:id/accept { deviceId } */
const accept = asyncHandler(async (req, res) => {
  const result = await RequestService.accept(req.params.id, requireDeviceId(req.deviceId));
  return ok(res, result, "Sorğu qəbul edildi", 200, "VOLUNTEER_ACCEPTED");
});

/** POST /api/volunteers/requests/:id/decline { deviceId } */
const decline = asyncHandler(async (req, res) => {
  const request = await RequestService.decline(req.params.id, requireDeviceId(req.deviceId));
  return ok(res, { request }, undefined, 200, "VOLUNTEER_DECLINED");
});

// ============ STAFF ============

/** GET /api/volunteers?profession&availability&verification */
const list = asyncHandler(async (req, res) => {
  const [rows, assignees] = await Promise.all([
    VolunteerService.list(req.query),
    canSeeExact(req) ? RequestService.activeAssignees() : new Set(),
  ]);
  const volunteers = await Promise.all(
    rows.map((p) => VolunteerService.toStaff(p, { exact: assignees.has(p.deviceId) })),
  );
  // Device ids are only for dispatchers (needed nowhere else)
  if (!canSeeExact(req)) volunteers.forEach((v) => delete v.deviceId);
  return ok(res, { volunteers });
});

/** GET /api/volunteers/requests?status */
const listRequests = asyncHandler(async (req, res) => {
  const rows = await RequestService.list({ status: req.query.status });
  return ok(res, { requests: rows.map((r) => r.toStaff()) });
});

/** POST /api/volunteers/requests { shelterId, professions[], count, urgency, note } */
const createRequest = asyncHandler(async (req, res) => {
  const request = await RequestService.create(req.body ?? {}, req.operator);
  return ok(res, { request: request.toStaff() }, "Sorğu göndərildi", 201, "VOLUNTEER_REQUEST_CREATED");
});

/** POST /api/volunteers/requests/:id/cancel */
const cancelRequest = asyncHandler(async (req, res) => {
  const request = await RequestService.cancel(req.params.id, req.operator);
  return ok(res, { request: request.toStaff() }, undefined, 200, "VOLUNTEER_REQUEST_CANCELLED");
});

/** POST /api/volunteers/medical-sos/:sosId — dispatcher-approved call-out */
const notifyMedicalSos = asyncHandler(async (req, res) => {
  const request = await RequestService.notifyMedicalSos(req.params.sosId, req.operator);
  return ok(res, { request: request.toStaff() }, undefined, 201, "VOLUNTEER_MEDICAL_NOTIFIED");
});

/** GET /api/volunteers/verification — pending verification queue */
const verificationQueue = asyncHandler(async (_req, res) => {
  const rows = await VolunteerService.verificationQueue();
  const volunteers = await Promise.all(
    rows.map(async (p) => ({
      ...(await VolunteerService.toStaff(p)),
      documentsList: p.toSelf().documents,
    })),
  );
  volunteers.forEach((v) => delete v.deviceId);
  return ok(res, { volunteers });
});

/** POST /api/volunteers/:id/verify { decision: verified|rejected, note } */
const verify = asyncHandler(async (req, res) => {
  const profile = await VolunteerService.verify(req.params.id, req.body ?? {}, req.operator);
  return ok(res, { volunteer: await VolunteerService.toStaff(profile) }, undefined, 200, "VOLUNTEER_VERIFIED");
});

/** GET /api/volunteers/:id/documents/:docId — authorised, audited download */
const downloadDocument = asyncHandler(async (req, res) => {
  const { profile, doc, file } = await VolunteerService.readDocument(req.params.id, req.params.docId);
  await AuditService.fromRequest(
    req,
    "volunteer.document_download",
    { type: "volunteer", id: profile._id },
    { document: doc._id.toString(), mime: doc.mime },
  );
  const buffer = await readFile(file).catch(() => null);
  if (!buffer) throw AppError.notFound("Sənəd faylı tapılmadı", "VOLUNTEER_DOC_NOT_FOUND");
  res.setHeader("Content-Type", doc.mime);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", `attachment; filename="${doc.originalName.replace(/"/g, "")}"`);
  res.end(buffer);
});

export {
  getMe,
  saveMe,
  withdraw,
  setAvailability,
  updateLocation,
  uploadDocument,
  myRequests,
  accept,
  decline,
  list,
  listRequests,
  createRequest,
  cancelRequest,
  notifyMedicalSos,
  verificationQueue,
  verify,
  downloadDocument,
};
