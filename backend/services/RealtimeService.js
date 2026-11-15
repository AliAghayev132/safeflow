import { domainEvents as E, socketEvents as S, channels as C } from "#constants";
import { eventBus } from "./EventBus.js";
import socketService from "./SocketService.js";
import { EventLogService } from "./EventLogService.js";
import { StatsService } from "./StatsService.js";

/**
 * Bridges domain events to the sequenced realtime log + Socket.IO rooms.
 * The only place that maps "what happened" → "who receives which event".
 */
class RealtimeService {
  static #statsTimer = null;

  static publish({ type, data, channel = null, deviceId = null }) {
    const entry = EventLogService.append({ type, data, channel, deviceId });
    socketService.deliver(entry);
    return entry;
  }

  static init() {
    const on = (event, handler) => eventBus.subscribe(event, handler);
    const pub = RealtimeService.publish;

    // Spam-flagged SOS are not pushed to dispatchers (a flood cannot flood the panel)
    on(E.SOS_CREATED, ({ sos }) => {
      if (!sos.spamFlagged) pub({ type: S.SOS_NEW, data: sos, channel: C.SOS });
    });
    on(E.SOS_UPDATED, ({ sos }) => pub({ type: S.SOS_UPDATED, data: sos, channel: C.SOS }));
    on(E.BRIGADE_UPDATED, ({ brigade }) =>
      pub({ type: S.BRIGADE_UPDATED, data: brigade, channel: C.BRIGADES }),
    );
    on(E.ALERT_CREATED, ({ alert }) => pub({ type: S.ALERT_NEW, data: alert, channel: C.ALERTS }));
    on(E.ALERT_UPDATED, ({ alert }) =>
      pub({ type: S.ALERT_UPDATED, data: alert, channel: C.ALERTS }),
    );
    on(E.SHELTER_UPDATED, ({ shelter }) =>
      pub({ type: S.SHELTER_UPDATED, data: shelter, channel: C.SHELTERS }),
    );
    on(E.ROAD_UPDATED, ({ edges }) => pub({ type: S.ROAD_UPDATED, data: edges, channel: C.ROADS }));
    on(E.CONFIG_UPDATED, ({ config }) =>
      pub({ type: S.CONFIG_UPDATED, data: config, channel: C.CONFIG }),
    );
    on(E.SCENARIO_UPDATED, ({ scenario }) =>
      pub({ type: S.SCENARIO_UPDATED, data: scenario, channel: C.SCENARIO }),
    );
    on(E.SYSTEM_RESET, () => pub({ type: S.SYSTEM_RESET, data: {}, channel: C.SYSTEM }));

    // Personal: a citizen's own SOS status changes + automatic reroutes
    on(E.SOS_UPDATED, ({ sos }) => {
      for (const s of sos) pub({ type: S.SOS_UPDATED, data: s, deviceId: s.deviceId });
    });
    on(E.CITIZEN_ROUTE_UPDATED, ({ _event, _at, deviceId, ...payload }) =>
      pub({ type: S.ROUTE_UPDATED, data: { ...payload, at: _at }, deviceId }),
    );

    // Coalesced headline numbers (max one push per 2.5 s)
    eventBus.subscribe("*", ({ _event }) => {
      if (_event === E.CITIZEN_ROUTE_UPDATED || _event === E.CONFIG_UPDATED) return;
      RealtimeService.#scheduleStats();
    });
  }

  static #scheduleStats() {
    if (RealtimeService.#statsTimer) return;
    RealtimeService.#statsTimer = setTimeout(async () => {
      RealtimeService.#statsTimer = null;
      try {
        const [summary, zones] = await Promise.all([
          StatsService.summary(),
          StatsService.zoneLoad(),
        ]);
        RealtimeService.publish({
          type: S.STATS_UPDATED,
          data: { summary, zones },
          channel: C.STATS,
        });
      } catch (error) {
        console.error("❌ [Realtime] stats push failed:", error.message);
      }
    }, 2500);
    RealtimeService.#statsTimer.unref?.();
  }
}

export { RealtimeService };
