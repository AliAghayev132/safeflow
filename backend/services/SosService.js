import { SosSignal, Citizen } from "#models";
import { domainEvents, sosNeeds, vulnerableFlags, accessibilityFlags, sosTypes } from "#constants";
import { AppError, toPoint } from "#utils";
import { assessSpam } from "#engine";
import { eventBus } from "./EventBus.js";
import { ConfigService } from "./ConfigService.js";
import { ZoneService } from "./ZoneService.js";
import { TriageService } from "./TriageService.js";
import { SpamTracker } from "./SpamTracker.js";
import { ProfileService } from "./ProfileService.js";

const cleanNeeds = (needs) =>
  Array.isArray(needs) ? [...new Set(needs.filter((n) => sosNeeds.includes(n)))] : undefined;

const cleanVulnerable = (v) =>
  v && typeof v === "object"
    ? Object.fromEntries(vulnerableFlags.map((f) => [f, Boolean(v[f])]))
    : undefined;

const cleanHeadcount = (h) => {
  if (h === undefined || h === null || h === "") return undefined;
  const n = Math.round(Number(h));
  if (!Number.isFinite(n) || n < 1) throw AppError.badRequest("headcount must be ≥ 1");
  return Math.min(500, n);
};

/** Apply optional triage details onto a document. */
const applyDetails = (sos, d) => {
  const needs = cleanNeeds(d.needs);
  if (needs) sos.needs = [...new Set([...(sos.needs ?? []), ...needs])];
  const vulnerable = cleanVulnerable(d.vulnerable);
  if (vulnerable) {
    for (const f of vulnerableFlags) sos.vulnerable[f] = sos.vulnerable[f] || vulnerable[f];
  }
  // Special needs: OR-merge (a profile flag is never switched off by an SOS)
  if (d.accessibility && typeof d.accessibility === "object") {
    for (const f of accessibilityFlags) {
      if (d.accessibility[f]) sos.accessibility[f] = true;
    }
  }
  const headcount = cleanHeadcount(d.headcount);
  if (headcount) sos.headcount = Math.max(sos.headcount ?? 1, headcount);
  if (typeof d.injuries === "string" && d.injuries.trim()) sos.injuries = d.injuries.trim().slice(0, 280);
  if (typeof d.note === "string" && d.note.trim()) sos.note = d.note.trim().slice(0, 500);
  if (typeof d.transcript === "string" && d.transcript.trim()) {
    sos.transcript = d.transcript.trim().slice(0, 1000);
  }
};

const publishUpdated = (docs) => {
  const list = (Array.isArray(docs) ? docs : [docs]).map((d) => d.toPublic());
  if (list.length) eventBus.publish(domainEvents.SOS_UPDATED, { sos: list });
  return list;
};

/**
 * SOS intake.
 *
 *  1. Idempotency — `clientId` (generated on the device) is unique: a network
 *     retry returns the original ticket, never a second one.
 *  2. Repeated taps — same device + same type inside the duplicate window are
 *     merged into the open ticket (genuine SOS is never rejected).
 *  3. Spam heuristics — flagged, not blocked; flagged tickets don't count
 *     toward clusters.
 *  4. Triage priority + brigade recommendation.
 */
class SosService {
  static async create({ clientId, deviceId, type, origin, ip = null, details = {}, queuedOffline = false, clientCreatedAt = null, ai = null }) {
    const cfg = ConfigService.get("sos");
    const now = Date.now();

    // 1 + 2 in one round trip: idempotent replay OR an open ticket of the same
    // device + type inside the duplicate window
    const candidates = await SosSignal.find({
      $or: [
        { clientId },
        { mergedClientIds: clientId },
        { deviceId, type, status: "pending", createdAt: { $gte: new Date(now - cfg.duplicateWindowMs) } },
      ],
    }).limit(3);
    const replay = candidates.find((s) => s.clientId === clientId || s.mergedClientIds.includes(clientId));
    if (replay) return { sos: replay.toPublic(), duplicate: true, reason: "idempotent_replay" };
    const open = candidates[0] ?? null;

    if (open) {
      // Flood fast path: repeat taps on a spam-flagged ticket only count the
      // merge (one cheap update), no triage / recommendation / broadcast
      if (open.spamFlagged) {
        await SosSignal.updateOne({ _id: open._id }, { $push: { mergedClientIds: clientId } });
        return { sos: open.toPublic(), duplicate: true, reason: "merged_repeat" };
      }
      open.mergedClientIds.push(clientId);
      applyDetails(open, details);
      TriageService.applyPriority(open);
      await TriageService.applyRecommendation(open);
      await open.save();
      publishUpdated(open);
      return { sos: open.toPublic(), duplicate: true, reason: "merged_repeat" };
    }

    // 3. Spam assessment (in-memory sliding windows)
    const spam = assessSpam(
      SpamTracker.record({
        deviceId,
        ip,
        now,
        deviceWindowMs: cfg.spam.deviceBurstWindowMs,
        ipWindowMs: cfg.spam.ipBurstWindowMs,
      }),
      cfg.spam,
    );

    const zone = ZoneService.resolve(origin);
    const location = toPoint(origin.lat, origin.lng);

    const sos = new SosSignal({
      clientId,
      deviceId,
      ip,
      type,
      location,
      zone: zone?._id ?? null,
      spamFlags: spam.flags,
      spamScore: spam.score,
      spamFlagged: spam.flagged && cfg.spam.excludeFlaggedFromClustering,
      queuedOffline: Boolean(queuedOffline),
      clientCreatedAt: clientCreatedAt ? new Date(clientCreatedAt) : null,
      ai,
    });
    // Profile special needs (limited mobility → Priority #1) + SOS body flags
    // (skipped for spam-flagged requests — a flood must stay cheap)
    const profileNeeds = sos.spamFlagged ? { accessibility: {} } : await ProfileService.needs(deviceId);
    applyDetails(sos, { ...details, accessibility: { ...profileNeeds.accessibility, ...(details.accessibility ?? {}) } });
    TriageService.applyPriority(sos);
    await TriageService.applyRecommendation(sos);

    try {
      await sos.save();
    } catch (error) {
      // Concurrent retry with the same clientId won the race
      if (error.code === 11000) {
        const existing = await SosSignal.findOne({ clientId });
        if (existing) return { sos: existing.toPublic(), duplicate: true, reason: "idempotent_replay" };
      }
      throw error;
    }

    // Device-id rotation detected → retro-flag the burst from this IP
    // Only once per IP burst window — not on every request of a flood
    if (ip && spam.flags.includes("ip_burst") && SpamTracker.claimRetroFlag(ip, now, cfg.spam.ipBurstWindowMs)) {
      const burst = await SosSignal.find({
        ip,
        spamFlagged: false,
        _id: { $ne: sos._id },
        createdAt: { $gte: new Date(now - cfg.spam.ipBurstWindowMs) },
      });
      for (const s of burst) {
        s.spamFlagged = cfg.spam.excludeFlaggedFromClustering;
        s.spamFlags = [...new Set([...s.spamFlags, "ip_burst"])];
        s.spamScore = Math.max(s.spamScore, spam.score);
        s.recommendedBrigade = null;
        await s.save();
      }
      publishUpdated(burst);
    }

    // Citizen status is a side effect — don't hold the SOS response for it
    // (skipped for spam: bots must not create citizen records)
    if (!sos.spamFlagged) Citizen.updateOne(
      { deviceId },
      {
        $set: { status: "needs_help", location, zone: zone?._id ?? null, lastSeenAt: new Date() },
        $setOnInsert: { deviceId },
      },
      { upsert: true },
    ).catch((error) => console.error("❌ [SOS] citizen status update failed:", error.message));

    const pub = sos.toPublic();
    eventBus.publish(domainEvents.SOS_CREATED, { sos: pub });
    return { sos: pub, duplicate: false, zone: zone?.toPublic() ?? null };
  }

  /** Progressive, optional follow-up answers attached to a live ticket. */
  /**
   * @param {string} [type] refine a "general" SOS to a concrete hazard
   *   (voice SOS enrichment) — never overrides a type the citizen chose
   * @param {object} [ai]   AI analysis snapshot shown to dispatchers
   */
  static async updateDetails({ clientId, deviceId, details, type, ai }) {
    const sos = await SosSignal.findOne({ $or: [{ clientId }, { mergedClientIds: clientId }] });
    if (!sos || sos.deviceId !== deviceId) throw AppError.notFound("SOS tapılmadı");
    if (["resolved", "cancelled"].includes(sos.status)) {
      throw AppError.conflict("SOS artıq bağlanıb");
    }
    if (type && sos.type === "general" && sosTypes.includes(type)) sos.type = type;
    if (ai) sos.ai = ai;
    applyDetails(sos, details);
    TriageService.applyPriority(sos);
    await TriageService.applyRecommendation(sos);
    await sos.save();
    publishUpdated(sos);
    return sos.toPublic();
  }

  /**
   * "I am safe": the citizen's open tickets leave cluster counting; pending
   * ones are cancelled, assigned ones stay visible for the brigade.
   */
  static async markCitizenSafe(deviceId) {
    const open = await SosSignal.find({ deviceId, status: { $in: ["pending", "assigned"] } });
    for (const s of open) {
      s.citizenSafe = true;
      if (s.status === "pending") {
        s.status = "cancelled";
        s.recommendedBrigade = null;
      }
      await s.save();
    }
    return publishUpdated(open);
  }

  static list({ since, status, limit = 300 } = {}) {
    const filter = {};
    if (since) filter.createdAt = { $gte: since };
    if (status) filter.status = status;
    return SosSignal.find(filter).sort({ createdAt: -1 }).limit(limit);
  }

  static listByDevice(deviceId, limit = 20) {
    return SosSignal.find({ deviceId }).sort({ createdAt: -1 }).limit(limit);
  }

  /** Bulk patch + one event carrying the updated signals. */
  static async setStatusMany(ids, patch) {
    if (!ids.length) return [];
    const set = { ...patch };
    if (patch.status === "resolved") set.resolvedAt = new Date();
    if (patch.status && patch.status !== "pending") set.recommendedBrigade = null;
    await SosSignal.updateMany({ _id: { $in: ids } }, { $set: set });
    const updated = await SosSignal.find({ _id: { $in: ids } });
    return publishUpdated(updated);
  }

  static async setStatus(id, status) {
    const sos = await SosSignal.findById(id);
    if (!sos) throw AppError.notFound("SOS siqnalı tapılmadı");
    const [updated] = await SosService.setStatusMany([sos._id], { status });
    return updated;
  }
}

export { SosService };
