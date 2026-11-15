import { RoadEdge, Citizen } from "#models";
import { domainEvents } from "#constants";
import { AppError } from "#utils";
import { eventBus } from "./EventBus.js";
import { routingService } from "./RoutingService.js";

/**
 * Road network state (closures and congestion). Every change is persisted,
 * mirrored into the in-memory routing graph and published.
 */
class RoadService {
  static network() {
    return routingService.getNetwork();
  }

  /** Lightweight traffic feed — only edges that are not free-flowing. */
  static async traffic() {
    const edges = await RoadEdge.find({
      $or: [{ status: "closed" }, { congestion: { $gt: 0 } }],
    });
    return edges.map((e) => e.toPublic());
  }

  static async #update(edgeIds, patchFn) {
    const edges = await RoadEdge.find({ edgeId: { $in: edgeIds } });
    if (!edges.length) throw AppError.notFound("Yol seqmenti tapılmadı");

    for (const edge of edges) {
      patchFn(edge);
      await edge.save();
      routingService.updateEdge(edge.edgeId, {
        status: edge.status,
        congestion: edge.congestion,
      });
    }

    const pub = edges.map((e) => e.toPublic());
    eventBus.publish(domainEvents.ROAD_UPDATED, { edges: pub });
    return pub;
  }

  static close(edgeId, reason = "Qəza / dağıntı") {
    return RoadService.#update([edgeId], (edge) => {
      edge.status = "closed";
      edge.closedReason = reason;
      edge.closedAt = new Date();
    });
  }

  static open(edgeId) {
    return RoadService.#update([edgeId], (edge) => {
      edge.status = "open";
      edge.closedReason = "";
      edge.closedAt = null;
    });
  }

  static setCongestion(edgeIds, congestion) {
    const value = Math.max(0, Math.min(1, Number(congestion) || 0));
    return RoadService.#update(edgeIds, (edge) => {
      edge.congestion = value;
    });
  }

  /**
   * Pick an open edge to close — prefers edges on active citizen routes so the
   * rerouting flow is visible in a demo.
   */
  static async pickEdgeForClosure() {
    const used = await Citizen.distinct("route.edgeIds", {
      status: { $ne: "safe" },
    });
    const openUsed = used.filter(
      (id) => routingService.getEdge(id)?.status === "open",
    );
    const pool = openUsed.length
      ? openUsed
      : [...routingService.edges.values()]
          .filter((e) => e.status === "open")
          .map((e) => e.edgeId);
    if (!pool.length) throw AppError.conflict("Açıq yol seqmenti qalmayıb");
    return pool[Math.floor(Math.random() * pool.length)];
  }
}

export { RoadService };
