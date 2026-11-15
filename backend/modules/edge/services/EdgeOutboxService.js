import { domainEvents } from "#constants";
import { eventBus } from "#services/EventBus.js";
import { EdgeOutbox } from "../models.js";

const hasDetails = (s) =>
  (s.needs?.length ?? 0) > 0 ||
  (s.headcount ?? 1) > 1 ||
  Object.values(s.vulnerable ?? {}).some(Boolean) ||
  Boolean(s.injuries) ||
  Boolean(s.transcript) ||
  (Boolean(s.note) && s.note !== "Simulyasiya");

const detailsOf = (s) => ({
  needs: s.needs,
  headcount: s.headcount,
  vulnerable: s.vulnerable,
  injuries: s.injuries || undefined,
  note: s.note || undefined,
  transcript: s.transcript || undefined,
});

/**
 * Edge side: everything citizens do on the local network is accepted by the
 * regular services against the LOCAL database and mirrored into this outbox
 * (store-and-forward). EdgeSyncService drains it when the center is reachable.
 */
class EdgeOutboxService {
  static #subscribed = false;

  static subscribe() {
    if (EdgeOutboxService.#subscribed) return;
    EdgeOutboxService.#subscribed = true;

    // New SOS — immutable once queued (idempotent clientId)
    eventBus.subscribe(domainEvents.SOS_CREATED, ({ sos, _at }) =>
      EdgeOutboxService.enqueueSos(sos, _at),
    );

    // Follow-up details (headcount, needs, ...) — coalesced per ticket
    eventBus.subscribe(domainEvents.SOS_UPDATED, async ({ sos, _at }) => {
      for (const s of sos) {
        if (s.status === "cancelled" || s.status === "resolved" || !hasDetails(s)) continue;
        await EdgeOutboxService.upsert({
          kind: "sosDetails",
          key: `details:${s.clientId}`,
          payload: { clientId: s.clientId, deviceId: s.deviceId, details: detailsOf(s) },
          occurredAt: _at ?? new Date(),
        });
      }
    });

    // Status ("I am safe", evacuating, ...) — only the latest per device
    eventBus.subscribe(domainEvents.CITIZEN_UPDATED, ({ deviceId, status, _at }) =>
      EdgeOutboxService.upsert({
        kind: "status",
        key: `status:${deviceId}`,
        payload: { deviceId, status, at: new Date(_at ?? Date.now()).toISOString() },
        occurredAt: _at ?? new Date(),
      }),
    );
  }

  static async enqueueSos(sos, at = new Date()) {
    await EdgeOutbox.updateOne(
      { key: `sos:${sos.clientId}` },
      {
        $setOnInsert: {
          kind: "sos",
          key: `sos:${sos.clientId}`,
          payload: {
            clientId: sos.clientId,
            deviceId: sos.deviceId,
            type: sos.type,
            lat: sos.lat,
            lng: sos.lng,
            details: detailsOf(sos),
            clientCreatedAt: sos.clientCreatedAt ?? sos.createdAt ?? at,
          },
          occurredAt: at,
        },
      },
      { upsert: true },
    );
  }

  /** Replace an item's payload; a new version must be (re)sent. */
  static async upsert({ kind, key, payload, occurredAt }) {
    await EdgeOutbox.updateOne(
      { key },
      {
        $set: { kind, payload, occurredAt, syncedAt: null, attempts: 0, nextAttemptAt: null, lastError: null },
      },
      { upsert: true },
    );
  }

  static pending() {
    return EdgeOutbox.find({ syncedAt: null }).lean();
  }

  static countPending() {
    return EdgeOutbox.countDocuments({ syncedAt: null });
  }

  static async summary() {
    const [pending, failed, synced] = await Promise.all([
      EdgeOutbox.countDocuments({ syncedAt: null }),
      EdgeOutbox.countDocuments({ syncedAt: { $ne: null }, lastError: { $ne: null } }),
      EdgeOutbox.countDocuments({ syncedAt: { $ne: null }, lastError: null }),
    ]);
    return { pending, failed, synced };
  }
}

export { EdgeOutboxService };
