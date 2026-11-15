import { Shelter, RoadEdge } from "#models";
import { ConfigService } from "#services/ConfigService.js";
import { ShelterService } from "#services/ShelterService.js";
import { RoadService } from "#services/RoadService.js";
import { eventBus } from "#services/EventBus.js";
import { EdgeOutbox } from "../models.js";
import { edgeEnv } from "../env.js";
import { isDue, nextBackoffMs, orderForPush } from "../engine.js";
import { EdgeOutboxService } from "./EdgeOutboxService.js";
import { EDGE_EVENTS } from "../events.js";

/**
 * Edge side: drains the outbox to the center and pulls a fresh snapshot.
 *
 *   connectivity = "the center answers HTTP" (internet, satellite or a radio
 *   bridge all look the same to us). Each cycle:
 *     1. GET  /api/edge/v1/ping      → online / offline
 *     2. POST /api/edge/v1/sync      → due outbox items (oldest first)
 *          ok          → marked synced
 *          permanent   → marked synced with lastError (dead letter, visible)
 *          retryable / transport failure → attempts+1, exponential backoff
 *     3. GET  /api/edge/v1/snapshot  → shelters occupancy, roads applied
 *                                      locally (center is authoritative)
 */
class EdgeSyncService {
  static state = {
    online: false,
    lastAttemptAt: null,
    lastSyncAt: null,
    lastPullAt: null,
    lastError: null,
    lastPushed: 0,
  };
  static #timer = null;
  static #running = null;

  static cfg() {
    return ConfigService.get("edge");
  }

  static #headers() {
    return { "Content-Type": "application/json", "X-Edge-Token": edgeEnv.token };
  }

  static async #request(method, path, body) {
    const res = await fetch(`${edgeEnv.centralUrl}/api/edge/v1${path}`, {
      method,
      headers: EdgeSyncService.#headers(),
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(EdgeSyncService.cfg().requestTimeoutMs),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(json?.message || `HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }
    return json.data;
  }

  static #setOnline(online, error = null) {
    const changed = EdgeSyncService.state.online !== online;
    EdgeSyncService.state.online = online;
    EdgeSyncService.state.lastError = error;
    if (changed) eventBus.publish(EDGE_EVENTS.CONNECTIVITY, { online, error });
  }

  /** Push due outbox items. Returns how many were acknowledged. */
  static async #push({ force }) {
    const cfg = EdgeSyncService.cfg();
    const now = Date.now();
    const due = orderForPush((await EdgeOutboxService.pending()).filter((i) => isDue(i, now, { force }))).slice(
      0,
      cfg.pushBatchSize,
    );
    if (!due.length) return 0;

    const queued = await EdgeOutboxService.countPending();
    let response;
    try {
      response = await EdgeSyncService.#request("POST", "/sync", {
        nodeId: edgeEnv.nodeId,
        queued,
        items: due.map(({ kind, key, payload, occurredAt }) => ({ kind, key, payload, occurredAt })),
      });
    } catch (error) {
      // Whole batch failed in transit → back off every item
      await Promise.all(due.map((item) => EdgeSyncService.#retryLater(item, error.message)));
      throw error;
    }

    const byKey = new Map((response?.results ?? []).map((r) => [r.key, r]));
    let acked = 0;
    for (const item of due) {
      const r = byKey.get(item.key);
      if (r?.ok) {
        await EdgeOutbox.updateOne(
          { _id: item._id, updatedAt: item.updatedAt },
          { $set: { syncedAt: new Date(), lastError: null, result: r } },
        );
        acked += 1;
      } else if (r && r.permanent) {
        await EdgeOutbox.updateOne(
          { _id: item._id, updatedAt: item.updatedAt },
          { $set: { syncedAt: new Date(), lastError: r.error ?? "rejected", result: r } },
        );
      } else {
        await EdgeSyncService.#retryLater(item, r?.error ?? "no result");
      }
    }
    return acked;
  }

  static async #retryLater(item, message) {
    const attempts = (item.attempts ?? 0) + 1;
    const delay = nextBackoffMs(attempts, EdgeSyncService.cfg());
    // Guard on updatedAt: a newer version of the item (coalesced update)
    // must not inherit the old failure.
    await EdgeOutbox.updateOne(
      { _id: item._id, updatedAt: item.updatedAt },
      { $set: { attempts, nextAttemptAt: new Date(Date.now() + delay), lastError: message } },
    );
  }

  /** Apply the center's snapshot to the local database. */
  static async applySnapshot(snap) {
    let shelters = 0;
    for (const s of snap.shelters ?? []) {
      const local = await Shelter.findOne({ code: s.code }, { _id: 1, occupancy: 1, isActive: 1 }).lean();
      if (!local) continue;
      if (s.isActive && !local.isActive) await ShelterService.activate(local._id);
      if (!s.isActive && local.isActive) await ShelterService.deactivate(local._id);
      if (Number.isFinite(s.occupancy) && s.occupancy !== local.occupancy) {
        await ShelterService.updateOccupancy(local._id, { occupancy: s.occupancy });
        shelters += 1;
      }
    }

    // Roads: center reports closed / congested segments; anything we have as
    // closed / congested that the center no longer reports is reopened.
    const reported = new Map((snap.roads ?? []).map((e) => [e.edgeId, e]));
    const localDisrupted = await RoadEdge.find(
      { $or: [{ status: "closed" }, { congestion: { $gt: 0 } }] },
      { edgeId: 1, status: 1, congestion: 1 },
    ).lean();
    const ids = new Set([...reported.keys(), ...localDisrupted.map((e) => e.edgeId)]);
    let roads = 0;
    for (const edgeId of ids) {
      const local = await RoadEdge.findOne({ edgeId }, { status: 1, congestion: 1 }).lean();
      if (!local) continue;
      const target = reported.get(edgeId) ?? { status: "open", congestion: 0 };
      if (target.status !== local.status) {
        if (target.status === "closed") await RoadService.close(edgeId, target.closedReason || "Mərkəzdən");
        else await RoadService.open(edgeId);
        roads += 1;
      }
      if ((target.congestion ?? 0) !== (local.congestion ?? 0)) {
        await RoadService.setCongestion([edgeId], target.congestion ?? 0);
        roads += 1;
      }
    }
    return { shelters, roads };
  }

  /**
   * One sync cycle. Concurrent calls share the running cycle.
   * @param {{ force?: boolean }} opts force = ignore backoff windows
   */
  static syncOnce(opts = {}) {
    if (!EdgeSyncService.#running) {
      EdgeSyncService.#running = EdgeSyncService.#cycle(opts).finally(() => {
        EdgeSyncService.#running = null;
      });
    }
    return EdgeSyncService.#running;
  }

  static async #cycle({ force = false } = {}) {
    const st = EdgeSyncService.state;
    st.lastAttemptAt = new Date().toISOString();
    if (!edgeEnv.centralUrl || !edgeEnv.token) {
      EdgeSyncService.#setOnline(false, "CENTRAL_URL / EDGE_TOKEN not configured");
      return { online: false, pushed: 0 };
    }
    try {
      await EdgeSyncService.#request("GET", "/ping");
    } catch (error) {
      EdgeSyncService.#setOnline(false, error.message);
      return { online: false, pushed: 0 };
    }
    EdgeSyncService.#setOnline(true);

    let pushed = 0;
    try {
      // Drain in batches while there is due work
      for (let i = 0; i < 20; i += 1) {
        const n = await EdgeSyncService.#push({ force });
        pushed += n;
        if (n === 0) break;
      }
      st.lastSyncAt = new Date().toISOString();
      st.lastPushed = pushed;
    } catch (error) {
      EdgeSyncService.#setOnline(false, error.message);
      return { online: false, pushed };
    }

    let applied = null;
    try {
      const snap = await EdgeSyncService.#request("GET", "/snapshot");
      applied = await EdgeSyncService.applySnapshot(snap);
      st.lastPullAt = new Date().toISOString();
    } catch (error) {
      st.lastError = `snapshot: ${error.message}`;
    }
    eventBus.publish(EDGE_EVENTS.SYNCED, { pushed, applied });
    return { online: true, pushed, applied };
  }

  static start() {
    EdgeSyncService.stop();
    const every = edgeEnv.syncIntervalMs ?? EdgeSyncService.cfg().syncIntervalMs;
    const tick = () =>
      EdgeSyncService.syncOnce().catch((e) => console.error("❌ [Edge] sync failed:", e.message));
    EdgeSyncService.#timer = setInterval(tick, every);
    EdgeSyncService.#timer.unref?.();
    setTimeout(tick, 500).unref?.();
  }

  static stop() {
    clearInterval(EdgeSyncService.#timer);
    EdgeSyncService.#timer = null;
  }
}

export { EdgeSyncService };
