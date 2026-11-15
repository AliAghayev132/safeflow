import { Alert } from "#models";
import { domainEvents } from "#constants";
import { haversineMeters } from "#utils";
import { eventBus } from "./EventBus.js";
import { ConfigService } from "./ConfigService.js";
import { routingService } from "./RoutingService.js";

/**
 * Structural-damage zones for barrier-free routing.
 *
 * An active SOS-cluster incident whose dominant hazard is a collapse marks a
 * circle (cluster radius) as a damage zone. Wheelchair / medical-transport
 * routes avoid every road segment whose midpoint lies inside such a zone
 * (debris, unstable buildings), on top of segments flagged damaged/obstacle.
 * Kept in memory and refreshed on alert events.
 */
class HazardService {
  static #zones = []; // [{ alertId, lat, lng, radius }]
  static #blocked = new Set(); // edgeIds inside a zone

  static async init() {
    await HazardService.reload();
    const refresh = () => HazardService.reload().catch((e) => console.error("Hazard reload:", e.message));
    eventBus.subscribe(domainEvents.ALERT_CREATED, refresh);
    eventBus.subscribe(domainEvents.ALERT_UPDATED, refresh);
    eventBus.subscribe(domainEvents.SYSTEM_RESET, refresh);
  }

  static async reload() {
    const radius = ConfigService.get("sosCluster").radiusMeters;
    const alerts = await Alert.find({
      type: "sos_cluster",
      status: { $in: ["active", "approved"] },
      "i18n.params.hazard": "collapse",
    }).lean();
    HazardService.#zones = alerts.map((a) => ({
      alertId: a._id.toString(),
      lat: a.location.coordinates[1],
      lng: a.location.coordinates[0],
      radius,
    }));
    HazardService.#recompute();
  }

  static #recompute() {
    const blocked = new Set();
    if (HazardService.#zones.length) {
      for (const edge of routingService.edges.values()) {
        const a = routingService.nodes.get(edge.from);
        const b = routingService.nodes.get(edge.to);
        if (!a || !b) continue;
        const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
        if (HazardService.#zones.some((z) => haversineMeters(mid, z) <= z.radius)) blocked.add(edge.edgeId);
      }
    }
    HazardService.#blocked = blocked;
  }

  /** Edge ids inside structural-damage zones (avoid for barrier-free routes). */
  static blockedEdges() {
    return HazardService.#blocked;
  }

  static zones() {
    return HazardService.#zones;
  }
}

export { HazardService };
