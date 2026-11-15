import { Citizen, Zone } from "#models";
import { sosTypes, citizenStatus } from "#constants";
import { isDeviceId, requireCoords, haversineMeters } from "#utils";
import { ConfigService } from "#services/ConfigService.js";
import { SosService } from "#services/SosService.js";
import { CitizenService } from "#services/CitizenService.js";
import { ShelterService } from "#services/ShelterService.js";
import { RoadService } from "#services/RoadService.js";
import { resolveStatusConflict, orderForPush } from "../engine.js";

class ItemError extends Error {
  constructor(message, permanent = true) {
    super(message);
    this.permanent = permanent;
  }
}

/**
 * Central side: applies a batch pushed by an edge node.
 *
 *   sos        → SosService.create — idempotent on clientId, so a re-sent
 *                SOS (lost ack, retry, two nodes) is never stored twice
 *   sosDetails → SosService.updateDetails (merging, idempotent)
 *   status     → latest status wins (device timestamp vs central statusAt)
 *
 * Every item gets its own result; a bad item never blocks the batch.
 * `permanent: false` tells the node to retry the item later.
 */
class EdgeIngestService {
  static async #applySos(p) {
    if (!isDeviceId(p.clientId) || !isDeviceId(p.deviceId)) throw new ItemError("invalid ids");
    if (!sosTypes.includes(p.type)) throw new ItemError("invalid type");
    const origin = requireCoords(p.lat, p.lng);
    const r = await SosService.create({
      clientId: p.clientId,
      deviceId: p.deviceId,
      type: p.type,
      origin,
      ip: null,
      details: p.details ?? {},
      queuedOffline: true,
      clientCreatedAt: p.clientCreatedAt ?? null,
    });
    return { duplicate: r.duplicate, sosId: r.sos.id };
  }

  static async #applyDetails(p) {
    if (!isDeviceId(p.clientId) || !isDeviceId(p.deviceId)) throw new ItemError("invalid ids");
    try {
      const sos = await SosService.updateDetails({
        clientId: p.clientId,
        deviceId: p.deviceId,
        details: p.details ?? {},
      });
      return { sosId: sos.id };
    } catch (error) {
      // Ticket closed meanwhile → nothing to merge, not an error worth retrying
      if (error.statusCode === 409) return { skipped: "closed" };
      // Not found yet (SOS item still in flight) → retry later
      if (error.statusCode === 404) throw new ItemError("sos not found yet", false);
      throw error;
    }
  }

  static async #applyStatus(p) {
    if (!isDeviceId(p.deviceId)) throw new ItemError("invalid deviceId");
    if (!citizenStatus.includes(p.status)) throw new ItemError("invalid status");
    const current = await Citizen.findOne({ deviceId: p.deviceId }, { status: 1, statusAt: 1 }).lean();
    const decision = resolveStatusConflict(
      current ? { status: current.status, at: current.statusAt } : null,
      { status: p.status, at: p.at },
    );
    if (decision.apply) {
      await CitizenService.setStatus({ deviceId: p.deviceId, status: p.status, at: p.at });
    }
    return { applied: decision.apply, reason: decision.reason };
  }

  /**
   * @param {object} node   EdgeNode document
   * @param {object[]} items [{ kind, key, payload, occurredAt }]
   */
  static async apply(node, items) {
    const max = ConfigService.get("edge").pushBatchSize;
    const list = orderForPush((Array.isArray(items) ? items : []).slice(0, max));
    const results = [];
    const counts = { sos: 0, sosDuplicates: 0, statuses: 0, statusesStale: 0, details: 0 };

    for (const item of list) {
      const key = String(item?.key ?? "");
      try {
        let out;
        if (item.kind === "sos") {
          out = await EdgeIngestService.#applySos(item.payload ?? {});
          counts.sos += 1;
          if (out.duplicate) counts.sosDuplicates += 1;
        } else if (item.kind === "sosDetails") {
          out = await EdgeIngestService.#applyDetails(item.payload ?? {});
          counts.details += 1;
        } else if (item.kind === "status") {
          out = await EdgeIngestService.#applyStatus(item.payload ?? {});
          counts.statuses += 1;
          if (!out.applied) counts.statusesStale += 1;
        } else {
          throw new ItemError("unknown kind");
        }
        results.push({ key, ok: true, ...out });
      } catch (error) {
        const permanent = error.permanent ?? (error.statusCode ? error.statusCode < 500 : false);
        results.push({ key, ok: false, permanent, error: error.message });
      }
    }

    for (const [k, v] of Object.entries(counts)) node.stats[k] = (node.stats[k] ?? 0) + v;
    node.stats.batches = (node.stats.batches ?? 0) + 1;
    return { results, counts };
  }

  /** Data the node caches for offline use (no personal data). */
  static async snapshot(node) {
    const [shelters, zones, roads] = await Promise.all([
      ShelterService.list(),
      Zone.find().sort({ name: 1 }),
      RoadService.traffic(),
    ]);
    const home = shelters.find((s) => s.code === node.shelterCode) ?? null;
    const nearby = home
      ? shelters
          .filter((s) => s.isActive && s.id !== home.id)
          .map((s) => ({ id: s.id, code: s.code, distanceMeters: Math.round(haversineMeters(home, s)) }))
          .sort((a, b) => a.distanceMeters - b.distanceMeters)
          .slice(0, 5)
      : [];
    return {
      generatedAt: new Date().toISOString(),
      nodeId: node.nodeId,
      shelterCode: node.shelterCode,
      shelters,
      nearby,
      zones: zones.map((z) => z.toPublic()),
      roads,
      features: ConfigService.features(),
      config: {
        shelter: ConfigService.get("shelter"),
        sosCluster: ConfigService.get("sosCluster"),
      },
      // Survival guides ship inside the citizen app bundle; version lets the
      // node know whether its cached bundle matches the center.
      guidesVersion: 1,
    };
  }
}

export { EdgeIngestService };
