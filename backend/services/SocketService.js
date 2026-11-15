import { SocketServer } from "#lib";
import { corsConfig } from "#config";
import { socketRooms } from "#constants";
import { isDeviceId } from "#utils";
import { Operator } from "#models";
import { AuthTokenService } from "./AuthTokenService.js";
import { RbacService } from "./RbacService.js";
import { EventLogService } from "./EventLogService.js";

/**
 * SocketService (singleton)
 *
 * Handshake auth:
 *   staff:   { client: "operator", token }   (legacy "dispatcher" accepted)
 *   citizen: { client: "citizen", deviceId }
 *
 * Each socket joins one room per realtime channel its role may receive
 * (config/rbac.json → channels) plus a personal device room. Permission is
 * therefore enforced on the WebSocket channel too, not only in the UI.
 *
 * All deliveries are `evt` messages { seq, type, data, at, epoch }.
 * After a reconnect the client emits `sync` { afterSeq, epoch } and receives
 * the missed events through the ack.
 */
class SocketService {
  constructor() {
    this.io = null;
  }

  init(httpServer) {
    this.io = new SocketServer(httpServer, {
      cors: { origin: corsConfig.origin, methods: ["GET", "POST"], credentials: true },
      pingTimeout: 20000,
      pingInterval: 25000,
      connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
    });

    this.io.use((socket, next) => {
      this.#authenticate(socket)
        .then(() => next())
        .catch((error) => next(error));
    });
    this.io.on("connection", (socket) => this.#onConnection(socket));
    return this.io;
  }

  async #authenticate(socket) {
    const { client, token, deviceId } = socket.handshake.auth ?? {};

    if (client === "operator" || client === "dispatcher") {
      let decoded;
      try {
        decoded = AuthTokenService.verify(token);
      } catch {
        throw new Error("Invalid token");
      }
      const operator = await Operator.findById(decoded.id);
      if (!operator?.isActive) throw new Error("Operator not found");
      socket.data.principal = RbacService.operatorPrincipal(operator);
      return;
    }

    if (client === "citizen" && isDeviceId(deviceId)) {
      socket.data.principal = RbacService.citizenPrincipal(deviceId);
      return;
    }

    throw new Error("Authentication required");
  }

  #onConnection(socket) {
    const principal = socket.data.principal;
    for (const channel of RbacService.channelsFor(principal)) {
      socket.join(socketRooms.channel(channel));
    }
    if (principal.deviceId) socket.join(socketRooms.device(principal.deviceId));

    socket.emit("hello", {
      epoch: EventLogService.epoch,
      lastSeq: EventLogService.lastSeq,
      role: principal.role,
      channels: RbacService.channelsFor(principal),
    });

    // Missed-event replay after reconnect
    socket.on("sync", (payload, ack) => {
      if (typeof ack !== "function") return;
      ack(EventLogService.since(principal, payload?.afterSeq, { epoch: payload?.epoch }));
    });
  }

  /** Deliver a logged event to everyone allowed to see it. */
  deliver(entry) {
    if (!this.io) return;
    const room = entry.deviceId
      ? socketRooms.device(entry.deviceId)
      : socketRooms.channel(entry.channel);
    this.io.to(room).emit("evt", EventLogService.toWire(entry));
  }

  connectionCount() {
    return this.io?.engine?.clientsCount ?? 0;
  }

  async close() {
    await this.io?.close();
  }
}

const socketService = new SocketService();
export default socketService;
