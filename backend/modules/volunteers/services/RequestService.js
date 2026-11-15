import { SosSignal } from "#models";
import { AppError, fromPoint } from "#utils";
import {
  ConfigService,
  RealtimeService,
  AuditService,
  ShelterService,
  RouteService,
} from "#services";
import { VolunteerRequest, VolunteerProfile } from "../models/index.js";
import { PROFESSIONS, MEDICAL_PROFESSIONS, URGENCY, EVENTS } from "../constants.js";
import { rankCandidates, medicalCandidates } from "../engine.js";
import { VolunteerService } from "./VolunteerService.js";

const cfg = () => ConfigService.get("volunteers");

const deviceActor = (deviceId) => ({
  _id: null,
  username: `device:${String(deviceId).slice(0, 8)}`,
  role: "volunteer",
});

const publishStaff = (request) =>
  RealtimeService.publish({ type: EVENTS.REQUEST_UPDATED, data: request.toStaff(), channel: "volunteers" });

const publishDevice = (deviceId, type, data) => RealtimeService.publish({ type, data, deviceId });

/**
 * Volunteer requests: creation → staged notification (shelter first, then
 * radius) → atomic acceptance → close for everyone else.
 */
class RequestService {
  static async #shelterPublic(id) {
    const shelter = await ShelterService.getById(id);
    return ShelterService.serialize(shelter);
  }

  /** Notify candidates (device rooms) and record who was notified. */
  static async #notify(request, candidates) {
    if (!candidates.length) return request;
    const shelter = await RequestService.#shelterPublic(request.shelter);
    const entries = candidates.map((c) => ({ deviceId: c.deviceId, stage: c.stage, at: new Date() }));
    const updated = await VolunteerRequest.findByIdAndUpdate(
      request._id,
      { $push: { notified: { $each: entries } } },
      { new: true },
    );
    for (const c of candidates) {
      publishDevice(c.deviceId, EVENTS.REQUEST_INCOMING, {
        request: updated.toVolunteer(c.deviceId),
        shelter: { id: shelter.id, name: shelter.name, lat: shelter.lat, lng: shelter.lng, address: shelter.address },
        stage: c.stage,
      });
    }
    await AuditService.record({
      operator: null,
      action: "volunteer.notify",
      target: { type: "volunteer_request", id: request._id },
      details: {
        notified: candidates.length,
        byStage: candidates.reduce((a, c) => ({ ...a, [c.stage]: (a[c.stage] ?? 0) + 1 }), {}),
      },
    });
    return updated;
  }

  static async create(body, operator) {
    const professions = (Array.isArray(body.professions) ? body.professions : [body.profession]).filter(
      (p) => PROFESSIONS.includes(p),
    );
    if (!professions.length) throw AppError.badRequest("Peşə seçilməyib", "VOLUNTEER_PROFESSION");
    const count = Math.max(1, Math.min(50, Math.round(Number(body.count) || 1)));
    const urgency = URGENCY.includes(body.urgency) ? body.urgency : "normal";
    const shelter = await RequestService.#shelterPublic(body.shelterId);
    const c = cfg();

    let request = await VolunteerRequest.create({
      kind: "shelter",
      shelter: shelter.id,
      professions: [...new Set(professions)],
      count,
      urgency,
      note: String(body.note ?? "").slice(0, 280),
      createdBy: operator
        ? { id: operator._id, username: operator.username, role: operator.role }
        : undefined,
      expiresAt: new Date(Date.now() + c.requestTtlMinutes * 60000),
    });

    const candidates = rankCandidates({
      volunteers: await VolunteerService.candidates(request.professions),
      shelter,
      professions: request.professions,
      count,
      radiusMeters: c.radiusMeters,
      widenRadiusMeters: c.widenRadius ? c.widenRadiusMeters : 0,
      maxNotify: c.maxNotify,
    });
    request = await RequestService.#notify(request, candidates);

    await AuditService.record({
      operator,
      action: "volunteer.request_create",
      target: { type: "volunteer_request", id: request._id, label: shelter.name },
      details: { professions: request.professions, count, urgency, notified: candidates.length },
    });
    publishStaff(request);
    return request;
  }

  /**
   * Medical SOS call-out (dispatcher approval required by the route's
   * permission). Notifies doctor / nurse / paramedic volunteers near the SOS.
   */
  static async notifyMedicalSos(sosId, operator) {
    const sos = await SosSignal.findById(sosId);
    if (!sos) throw AppError.notFound("SOS tapılmadı");
    const point = fromPoint(sos.location);
    const nearestShelter = (await ShelterService.list({ isActive: true }))
      .map((s) => ({ s, d: (s.lat - point.lat) ** 2 + (s.lng - point.lng) ** 2 }))
      .sort((a, b) => a.d - b.d)[0]?.s;
    if (!nearestShelter) throw AppError.conflict("Aktiv məntəqə yoxdur");
    const c = cfg();

    let request = await VolunteerRequest.create({
      kind: "medical_sos",
      shelter: nearestShelter.id,
      sos: sos._id,
      professions: MEDICAL_PROFESSIONS,
      count: 1,
      urgency: "urgent",
      note: `SOS — ${sos.type}`,
      createdBy: { id: operator._id, username: operator.username, role: operator.role },
      expiresAt: new Date(Date.now() + c.requestTtlMinutes * 60000),
    });
    const candidates = medicalCandidates({
      volunteers: await VolunteerService.candidates(MEDICAL_PROFESSIONS),
      point,
      radiusMeters: c.medicalSosRadiusMeters,
      maxNotify: c.maxNotify,
    });
    request = await RequestService.#notify(request, candidates);
    await AuditService.record({
      operator,
      action: "volunteer.medical_sos_notify",
      target: { type: "sos", id: sos._id },
      details: { request: request._id.toString(), notified: candidates.length },
    });
    publishStaff(request);
    return request;
  }

  /**
   * Accept — atomic: only an open, unexpired request this device was
   * notified about, not yet accepted by it, with free places. Concurrent
   * accepts can never exceed `count`.
   */
  static async accept(requestId, deviceId) {
    const profile = await VolunteerService.require(deviceId);
    if (!profile.consent?.given) throw AppError.conflict("Razılıq geri götürülüb", "VOLUNTEER_CONSENT_REQUIRED");

    const now = new Date();
    const request = await VolunteerRequest.findOneAndUpdate(
      {
        _id: requestId,
        status: "open",
        expiresAt: { $gt: now },
        "notified.deviceId": deviceId,
        "accepted.deviceId": { $ne: deviceId },
        $expr: { $lt: [{ $size: "$accepted" }, "$count"] },
      },
      { $push: { accepted: { deviceId, at: now } }, $pull: { declined: deviceId } },
      { new: true },
    );
    if (!request) {
      throw AppError.conflict("Sorğu artıq bağlanıb və ya dolub", "VOLUNTEER_REQUEST_CLOSED");
    }

    let final = request;
    if (request.accepted.length >= request.count) {
      final =
        (await VolunteerRequest.findOneAndUpdate(
          { _id: request._id, status: "open" },
          { $set: { status: "filled", filledAt: now, closedAt: now } },
          { new: true },
        )) ?? request;
      const acceptedIds = new Set(final.accepted.map((a) => a.deviceId));
      for (const n of final.notified) {
        if (!acceptedIds.has(n.deviceId)) {
          publishDevice(n.deviceId, EVENTS.REQUEST_CLOSED, { requestId: final._id.toString(), reason: "filled" });
        }
      }
    }

    // Route for the volunteer to the assembly point
    const shelter = await RequestService.#shelterPublic(final.shelter);
    const origin = profile.lastLocation ? fromPoint(profile.lastLocation) : null;
    const route = origin ? await RouteService.route(origin, shelter) : null;

    await AuditService.record({
      operator: deviceActor(deviceId),
      action: "volunteer.accept",
      target: { type: "volunteer_request", id: final._id },
      details: { filled: final.status === "filled" },
    });
    publishDevice(deviceId, EVENTS.REQUEST_ACCEPTED, { request: final.toVolunteer(deviceId) });
    publishStaff(final);

    return {
      request: final.toVolunteer(deviceId),
      shelter: { id: shelter.id, name: shelter.name, lat: shelter.lat, lng: shelter.lng, address: shelter.address },
      route,
    };
  }

  static async decline(requestId, deviceId) {
    const request = await VolunteerRequest.findOneAndUpdate(
      { _id: requestId, "notified.deviceId": deviceId, "accepted.deviceId": { $ne: deviceId } },
      { $addToSet: { declined: deviceId } },
      { new: true },
    );
    if (!request) throw AppError.notFound("Sorğu tapılmadı", "VOLUNTEER_REQUEST_NOT_FOUND");
    await AuditService.record({
      operator: deviceActor(deviceId),
      action: "volunteer.decline",
      target: { type: "volunteer_request", id: request._id },
    });
    publishStaff(request);
    return request.toVolunteer(deviceId);
  }

  static async cancel(requestId, operator) {
    const now = new Date();
    const request = await VolunteerRequest.findOneAndUpdate(
      { _id: requestId, status: "open" },
      { $set: { status: "cancelled", closedAt: now } },
      { new: true },
    );
    if (!request) throw AppError.conflict("Sorğu açıq deyil", "VOLUNTEER_REQUEST_CLOSED");
    for (const n of request.notified) {
      publishDevice(n.deviceId, EVENTS.REQUEST_CLOSED, { requestId: request._id.toString(), reason: "cancelled" });
    }
    await AuditService.record({
      operator,
      action: "volunteer.request_cancel",
      target: { type: "volunteer_request", id: request._id },
    });
    publishStaff(request);
    return request;
  }

  /** Requests a volunteer was notified about (open ones + those they accepted). */
  static async forVolunteer(deviceId) {
    const rows = await VolunteerRequest.find({
      "notified.deviceId": deviceId,
      $or: [{ status: "open", expiresAt: { $gt: new Date() } }, { "accepted.deviceId": deviceId }],
    })
      .sort({ createdAt: -1 })
      .limit(30);
    const shelters = new Map();
    const out = [];
    for (const r of rows) {
      const key = r.shelter.toString();
      if (!shelters.has(key)) {
        const s = await RequestService.#shelterPublic(key).catch(() => null);
        shelters.set(key, s && { id: s.id, name: s.name, lat: s.lat, lng: s.lng, address: s.address });
      }
      out.push({ ...r.toVolunteer(deviceId), shelterInfo: shelters.get(key) });
    }
    return out;
  }

  static list({ status, limit = 100 } = {}) {
    const filter = status ? { status } : {};
    return VolunteerRequest.find(filter).sort({ createdAt: -1 }).limit(Math.min(300, limit));
  }

  /** Expire stale open requests (called periodically). */
  static async expire() {
    const now = new Date();
    const stale = await VolunteerRequest.find({ status: "open", expiresAt: { $lte: now } });
    for (const r of stale) {
      r.status = "expired";
      r.closedAt = now;
      await r.save();
      for (const n of r.notified) {
        publishDevice(n.deviceId, EVENTS.REQUEST_CLOSED, { requestId: r._id.toString(), reason: "expired" });
      }
      publishStaff(r);
    }
    return stale.length;
  }

  /**
   * Devices whose exact location a dispatcher may see: volunteers who have
   * accepted a request that is still open or filled (active assignment).
   */
  static async activeAssignees() {
    const rows = await VolunteerRequest.find(
      { status: { $in: ["open", "filled"] }, "accepted.0": { $exists: true } },
      { accepted: 1 },
    ).lean();
    return new Set(rows.flatMap((r) => r.accepted.map((a) => a.deviceId)));
  }

  /** Count of ready, consented medical volunteers near a point (suggestion only). */
  static async medicalNearbyCount(point) {
    return medicalCandidates({
      volunteers: await VolunteerService.candidates(MEDICAL_PROFESSIONS),
      point,
      radiusMeters: cfg().medicalSosRadiusMeters,
      maxNotify: 100,
    }).length;
  }
}

export { RequestService, VolunteerProfile };
