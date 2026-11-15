import { domainEvents } from "#constants";
import { eventBus } from "#services/EventBus.js";
import socketService from "#services/SocketService.js";
import { ConfigService } from "#services/ConfigService.js";
import { RealtimeService } from "#services/RealtimeService.js";
import { routingService } from "#services/RoutingService.js";
import { PartnerClient } from "../models/partnerClient.model.js";
import { PartnerTokenService } from "./PartnerTokenService.js";
import { WebhookService } from "./WebhookService.js";
import { PARTNER_REQUEST_EVENT } from "./PartnerDataService.js";
import { EVENT_SCOPES } from "../core/scopes.js";
import { serializeIncident, serializeAssemblyPoint, serializeRoad } from "../core/serializers.js";

const NAMESPACE = "/partner";

/**
 * Realtime for partners, built on EventBus domain events:
 *   - Socket.IO namespace `/partner` (handshake auth: { token: <partner JWT> });
 *     each socket joins `scope:<scope>` rooms for its token scopes and a
 *     private `client:<id>` room (own request updates).
 *   - Webhooks (WebhookService) for the same events.
 * Payloads are produced by the minimising serializers only.
 */
class PartnerRealtime {
  static #nsp = null;
  static #unsubscribe = [];
  static #coalesce = new Map(); // shelterId → timer

  static init() {
    if (PartnerRealtime.#unsubscribe.length) return;

    socketService.registerNamespace((io) => {
      const nsp = io.of(NAMESPACE);
      nsp.use(async (socket, next) => {
        try {
          const claims = PartnerTokenService.verify(socket.handshake.auth?.token);
          const client = await PartnerClient.findById(claims.cid);
          if (!client || client.status === "suspended" || client.tokenVersion !== claims.ver) {
            return next(new Error("access_denied"));
          }
          socket.data.clientId = client._id.toString();
          socket.data.scopes = (claims.scp ?? []).filter((s) => client.scopes.includes(s));
          next();
        } catch {
          next(new Error("invalid_token"));
        }
      });
      nsp.on("connection", (socket) => {
        for (const scope of socket.data.scopes) socket.join(`scope:${scope}`);
        socket.join(`client:${socket.data.clientId}`);
        socket.emit("hello", { scopes: socket.data.scopes });
      });
      PartnerRealtime.#nsp = nsp;
    });

    const on = (event, handler) =>
      PartnerRealtime.#unsubscribe.push(
        eventBus.subscribe(event, (payload) => {
          if (!ConfigService.isEnabled("partnerApi")) return;
          return handler(payload);
        }),
      );

    on(domainEvents.ALERT_CREATED, ({ alert }) =>
      PartnerRealtime.emit("incident.created", serializeIncident(alert)),
    );
    on(domainEvents.ALERT_UPDATED, ({ alert }) =>
      PartnerRealtime.emit("incident.updated", serializeIncident(alert)),
    );
    on(domainEvents.ROAD_UPDATED, ({ edges }) =>
      PartnerRealtime.emit(
        "road.updated",
        edges.map((e) => {
          const a = routingService.nodes.get(e.from);
          const b = routingService.nodes.get(e.to);
          return serializeRoad(e, a && b ? [[a.lat, a.lng], [b.lat, b.lng]] : null);
        }),
      ),
    );
    // Shelter updates can be very frequent during an incident — coalesce per
    // shelter (latest state wins) so partners aren't flooded.
    on(domainEvents.SHELTER_UPDATED, ({ shelter }) => {
      const key = String(shelter.id);
      const existing = PartnerRealtime.#coalesce.get(key);
      if (existing) clearTimeout(existing.timer);
      const wait = ConfigService.get("partner")?.webhooks?.coalesceMs ?? 2000;
      const timer = setTimeout(() => {
        PartnerRealtime.#coalesce.delete(key);
        PartnerRealtime.emit("assembly_point.updated", serializeAssemblyPoint(shelter));
      }, wait);
      timer.unref?.();
      PartnerRealtime.#coalesce.set(key, { timer });
    });

    // Partner request lifecycle → the requesting client only; and the crisis
    // center dashboard (alerts channel) for new / changed requests.
    on(PARTNER_REQUEST_EVENT, ({ clientId, request, change }) => {
      RealtimeService.publish({ type: "partner:request", data: { ...request, change }, channel: "alerts" });
      if (change === "updated") {
        const { partner: _p, ...forPartner } = request;
        PartnerRealtime.emit("request.updated", forPartner, { clientId });
      }
    });
  }

  /** Emit to scoped sockets + webhooks. `clientId` restricts to one client. */
  static emit(event, data, { clientId = null } = {}) {
    const message = { type: event, data, at: new Date().toISOString() };
    if (PartnerRealtime.#nsp) {
      const room = clientId ? `client:${clientId}` : `scope:${EVENT_SCOPES[event]}`;
      PartnerRealtime.#nsp.to(room).emit("evt", message);
    }
    WebhookService.dispatch(event, data, { onlyClientId: clientId }).catch((e) =>
      console.error("❌ [Partner webhook] dispatch failed:", e.message),
    );
  }

  /** Disconnect a client's live sockets (suspend / rotate / delete). */
  static disconnectClient(clientId) {
    PartnerRealtime.#nsp?.in(`client:${clientId}`).disconnectSockets(true);
  }

  static stop() {
    for (const { timer } of PartnerRealtime.#coalesce.values()) clearTimeout(timer);
    PartnerRealtime.#coalesce.clear();
    WebhookService.stop();
  }
}

export { PartnerRealtime };
