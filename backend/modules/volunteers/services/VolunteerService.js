import { crypto, path } from "#lib";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { Citizen } from "#models";
import { AppError, toPoint, fromPoint } from "#utils";
import {
  ConfigService,
  RealtimeService,
  AuditService,
  ZoneService,
  ShelterService,
} from "#services";
import { VolunteerProfile } from "../models/index.js";
import { PROFESSIONS, MEDICAL_PROFESSIONS, DOCUMENT_TYPES, EVENTS } from "../constants.js";
import { initialVerification, matchesMagic, coarseLocation } from "../engine.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
// Private storage — never served statically; admins download via an
// authorised, audited endpoint.
export const UPLOAD_DIR = path.resolve(MODULE_DIR, "../../../uploads/volunteers");

const cfg = () => ConfigService.get("volunteers");

/** Audit actor for a volunteer device (no operator account). */
const deviceActor = (deviceId) => ({
  _id: null,
  username: `device:${String(deviceId).slice(0, 8)}`,
  role: "volunteer",
});

/**
 * Volunteer registration, consent, availability, location, documents and
 * verification. Keeps an in-memory set of active (consented) volunteer
 * devices so the RBAC principal resolver stays synchronous.
 */
class VolunteerService {
  static #active = new Set();

  static async load() {
    const rows = await VolunteerProfile.find({ "consent.given": true }, { deviceId: 1 }).lean();
    VolunteerService.#active = new Set(rows.map((r) => r.deviceId));
  }

  /** RBAC device-role resolver: consented volunteer → "volunteer". */
  static resolveRole(deviceId) {
    if (!ConfigService.isEnabled("volunteers")) return null;
    return VolunteerService.#active.has(deviceId) ? "volunteer" : null;
  }

  static #track(profile) {
    if (profile.consent?.given) VolunteerService.#active.add(profile.deviceId);
    else VolunteerService.#active.delete(profile.deviceId);
  }

  static async get(deviceId) {
    return VolunteerProfile.findOne({ deviceId });
  }

  static async require(deviceId) {
    const p = await VolunteerService.get(deviceId);
    if (!p) throw AppError.notFound("Könüllü profili yoxdur", "VOLUNTEER_NOT_FOUND");
    return p;
  }

  /** Staff-safe projection — coarse location unless `exact` is allowed. */
  static async toStaff(profile, { exact = false } = {}) {
    let shelterName = null;
    if (profile.currentShelter) {
      shelterName = (await ShelterService.getById(profile.currentShelter).catch(() => null))?.name ?? null;
    }
    const zoneName = profile.zone
      ? ZoneService.list().find((z) => z._id.toString() === profile.zone.toString())?.name ?? null
      : null;
    return {
      id: profile._id.toString(),
      deviceRef: profile.deviceId.slice(0, 8),
      deviceId: profile.deviceId,
      displayName: profile.displayName,
      profession: profile.profession,
      skills: profile.skills,
      consent: profile.consent?.given === true,
      availability: profile.availability,
      verification: profile.verification,
      unverifiedMedical:
        MEDICAL_PROFESSIONS.includes(profile.profession) && profile.verification !== "verified",
      documents: profile.documents.length,
      location: coarseLocation({ shelterName, zoneName }),
      exactLocation: exact && profile.lastLocation ? fromPoint(profile.lastLocation) : null,
      updatedAt: profile.updatedAt,
    };
  }

  static #publishStaff(staffView) {
    // Coarse only on the broadcast channel — exact positions are fetched on demand
    RealtimeService.publish({
      type: EVENTS.VOLUNTEER_UPDATED,
      data: { ...staffView, exactLocation: null },
      channel: "volunteers",
    });
  }

  static async #afterChange(profile) {
    VolunteerService.#track(profile);
    VolunteerService.#publishStaff(await VolunteerService.toStaff(profile));
  }

  /** Register / update (consent must be explicit to become active). */
  static async upsert(deviceId, body = {}) {
    const existing = await VolunteerService.get(deviceId);
    const profession = body.profession ?? existing?.profession;
    if (!PROFESSIONS.includes(profession)) {
      throw AppError.badRequest("Peşə seçilməyib", "VOLUNTEER_PROFESSION");
    }
    if (!existing && body.consent !== true) {
      throw AppError.badRequest("Könüllü olmaq üçün açıq razılıq tələb olunur", "VOLUNTEER_CONSENT_REQUIRED");
    }

    const profile = existing ?? new VolunteerProfile({ deviceId, profession });
    if (typeof body.displayName === "string") profile.displayName = body.displayName.trim().slice(0, 80);
    if (typeof body.phone === "string") profile.phone = body.phone.trim().slice(0, 32);
    if (Array.isArray(body.skills)) {
      profile.skills = body.skills.map((s) => String(s).trim()).filter(Boolean).slice(0, 12);
    }
    if (profession !== profile.profession || !existing) {
      profile.profession = profession;
      // Changing profession resets verification (documents must match it)
      profile.verification = initialVerification(profession);
      if (MEDICAL_PROFESSIONS.includes(profession) && profile.documents.length) {
        profile.verification = "pending";
      }
    }
    if (body.consent === true && !profile.consent?.given) {
      profile.consent = { given: true, at: new Date(), withdrawnAt: null };
    }
    await profile.save();

    await AuditService.record({
      operator: deviceActor(deviceId),
      action: existing ? "volunteer.update" : "volunteer.register",
      target: { type: "volunteer", id: profile._id, label: profile.profession },
      details: { profession: profile.profession, consent: profile.consent?.given === true },
    });
    await VolunteerService.#afterChange(profile);
    return profile;
  }

  /** Withdraw consent: hidden from every matching immediately. */
  static async withdrawConsent(deviceId) {
    const profile = await VolunteerService.require(deviceId);
    profile.consent = { given: false, at: profile.consent?.at ?? null, withdrawnAt: new Date() };
    profile.availability = "not_ready";
    await profile.save();
    await AuditService.record({
      operator: deviceActor(deviceId),
      action: "volunteer.consent_withdraw",
      target: { type: "volunteer", id: profile._id },
    });
    await VolunteerService.#afterChange(profile);
    return profile;
  }

  static async setAvailability(deviceId, availability) {
    if (!["ready", "not_ready"].includes(availability)) {
      throw AppError.badRequest("Yanlış status", "VOLUNTEER_AVAILABILITY");
    }
    const profile = await VolunteerService.require(deviceId);
    if (!profile.consent?.given) {
      throw AppError.conflict("Əvvəlcə könüllü razılığını verin", "VOLUNTEER_CONSENT_REQUIRED");
    }
    profile.availability = availability;
    await profile.save();
    await AuditService.record({
      operator: deviceActor(deviceId),
      action: "volunteer.availability",
      target: { type: "volunteer", id: profile._id },
      details: { availability },
    });
    await VolunteerService.#afterChange(profile);
    return profile;
  }

  /**
   * Private position update. `shelterId` marks the assembly point the
   * volunteer is at; otherwise it is derived from a citizen check-in.
   */
  static async updateLocation(deviceId, { origin, shelterId }) {
    const profile = await VolunteerService.require(deviceId);
    if (origin) {
      profile.lastLocation = toPoint(origin.lat, origin.lng);
      profile.lastLocationAt = new Date();
      profile.zone = ZoneService.resolve(origin)?._id ?? null;
    }
    if (shelterId !== undefined) {
      if (shelterId) {
        const shelter = await ShelterService.getById(shelterId);
        profile.currentShelter = shelter._id;
        if (!origin) profile.zone = shelter.zone;
      } else {
        profile.currentShelter = null;
      }
    } else {
      const citizen = await Citizen.findOne({ deviceId }, { status: 1, targetShelter: 1 }).lean();
      if (citizen?.status === "safe" && citizen.targetShelter) profile.currentShelter = citizen.targetShelter;
    }
    await profile.save();
    await VolunteerService.#afterChange(profile);
    return profile;
  }

  // ============ DOCUMENTS ============

  /** Store a verification document (raw body). Medical → verification pending. */
  static async addDocument(deviceId, { buffer, mime, originalName }) {
    const profile = await VolunteerService.require(deviceId);
    const { maxDocumentBytes, maxDocuments } = cfg();
    const signature = DOCUMENT_TYPES[mime];
    if (!signature) throw AppError.badRequest("Fayl növü dəstəklənmir (PDF, PNG, JPEG)", "VOLUNTEER_DOC_TYPE");
    if (!buffer?.length) throw AppError.badRequest("Fayl boşdur", "VOLUNTEER_DOC_EMPTY");
    if (buffer.length > maxDocumentBytes) {
      throw new AppError("Fayl çox böyükdür", 413, "VOLUNTEER_DOC_TOO_LARGE");
    }
    if (!matchesMagic(buffer, signature)) {
      throw AppError.badRequest("Fayl məzmunu növünə uyğun deyil", "VOLUNTEER_DOC_MISMATCH");
    }
    if (profile.documents.length >= maxDocuments) {
      throw AppError.conflict("Sənəd limiti dolub", "VOLUNTEER_DOC_LIMIT");
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const ext = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" }[mime];
    const storedName = `${crypto.randomUUID()}.${ext}`;
    await fs.writeFile(path.join(UPLOAD_DIR, storedName), buffer, { mode: 0o600 });

    profile.documents.push({
      originalName: String(originalName ?? "document").replace(/[^\w.\- ]/g, "_").slice(0, 160),
      mime,
      size: buffer.length,
      storedName,
    });
    if (MEDICAL_PROFESSIONS.includes(profile.profession) && profile.verification !== "verified") {
      profile.verification = "pending";
    }
    await profile.save();
    await AuditService.record({
      operator: deviceActor(deviceId),
      action: "volunteer.document_upload",
      target: { type: "volunteer", id: profile._id },
      details: { mime, size: buffer.length },
    });
    await VolunteerService.#afterChange(profile);
    return profile;
  }

  /** Authorised document read (admin, audited by the controller). */
  static async readDocument(profileId, docId) {
    const profile = await VolunteerProfile.findById(profileId);
    const doc = profile?.documents.id(docId);
    if (!doc) throw AppError.notFound("Sənəd tapılmadı", "VOLUNTEER_DOC_NOT_FOUND");
    const file = path.join(UPLOAD_DIR, path.basename(doc.storedName));
    return { profile, doc, file };
  }

  // ============ VERIFICATION (admin) ============

  static async verify(profileId, { decision, note = "" }, operator) {
    if (!["verified", "rejected"].includes(decision)) {
      throw AppError.badRequest("Qərar: verified | rejected", "VOLUNTEER_DECISION");
    }
    const profile = await VolunteerProfile.findById(profileId);
    if (!profile) throw AppError.notFound("Könüllü tapılmadı", "VOLUNTEER_NOT_FOUND");
    profile.verification = decision;
    profile.verificationNote = String(note).slice(0, 280);
    profile.verifiedAt = new Date();
    await profile.save();
    await AuditService.record({
      operator,
      action: `volunteer.${decision === "verified" ? "verify" : "reject"}`,
      target: { type: "volunteer", id: profile._id, label: profile.profession },
      details: { note: profile.verificationNote },
    });
    await VolunteerService.#afterChange(profile);
    return profile;
  }

  static verificationQueue() {
    return VolunteerProfile.find({ verification: "pending" }).sort({ updatedAt: 1 }).limit(200);
  }

  static list({ profession, availability, verification } = {}) {
    const filter = {};
    if (profession) filter.profession = profession;
    if (availability) filter.availability = availability;
    if (verification) filter.verification = verification;
    return VolunteerProfile.find(filter).sort({ updatedAt: -1 }).limit(500);
  }

  /** Engine-shape candidates for matching (consented + ready only). */
  static async candidates(professions) {
    const rows = await VolunteerProfile.find({
      "consent.given": true,
      availability: "ready",
      profession: { $in: professions },
    });
    return rows.map((r) => r.toEngine());
  }

  static clear() {
    VolunteerService.#active.clear();
  }
}

export { VolunteerService };
