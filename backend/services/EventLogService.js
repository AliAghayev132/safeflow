import { RbacService } from "./RbacService.js";
import { ConfigService } from "./ConfigService.js";

/**
 * Sequenced realtime event log (in-memory ring buffer).
 *
 * Every event delivered to clients gets a monotonic `seq`. A client that was
 * disconnected asks for everything after its last seq — over the socket
 * ("sync") or by polling GET /api/events?after=seq when WebSockets are not
 * available. If the requested seq already fell out of the buffer the client
 * is told to `resync` (full refetch).
 *
 * Entries are scoped to a channel (permission-gated) or a single device.
 */
class EventLogService {
  static #buffer = [];
  static #seq = 0;
  // Server boot id — a restart invalidates client seq numbers
  static epoch = Date.now().toString(36);

  static append({ type, data, channel = null, deviceId = null }) {
    const entry = {
      seq: ++EventLogService.#seq,
      type,
      data,
      channel,
      deviceId,
      at: new Date().toISOString(),
    };
    EventLogService.#buffer.push(entry);
    const max = ConfigService.get("events")?.bufferSize ?? 5000;
    if (EventLogService.#buffer.length > max) {
      EventLogService.#buffer.splice(0, EventLogService.#buffer.length - max);
    }
    return entry;
  }

  static get lastSeq() {
    return EventLogService.#seq;
  }

  static visibleTo(principal, entry) {
    if (entry.deviceId) return principal.deviceId === entry.deviceId;
    return RbacService.canReceive(principal, entry.channel);
  }

  /**
   * Events after `afterSeq` the principal may see.
   * @returns {{ events, lastSeq, epoch, resync }}
   */
  static since(principal, afterSeq, { epoch, limit = 500 } = {}) {
    const after = Number(afterSeq) || 0;
    const oldest = EventLogService.#buffer[0]?.seq ?? EventLogService.#seq + 1;
    const epochChanged = epoch && epoch !== EventLogService.epoch;
    const gap = after > 0 && after < oldest - 1;
    if (epochChanged || gap || after > EventLogService.#seq) {
      return { events: [], lastSeq: EventLogService.#seq, epoch: EventLogService.epoch, resync: true };
    }
    const events = EventLogService.#buffer
      .filter((e) => e.seq > after && EventLogService.visibleTo(principal, e))
      .slice(0, limit)
      .map(EventLogService.toWire);
    return {
      events,
      lastSeq: EventLogService.#seq,
      epoch: EventLogService.epoch,
      resync: false,
      hasMore: events.length === limit,
    };
  }

  static toWire({ seq, type, data, at }) {
    return { seq, type, data, at, epoch: EventLogService.epoch };
  }

  static clear() {
    EventLogService.#buffer = [];
  }
}

export { EventLogService };
