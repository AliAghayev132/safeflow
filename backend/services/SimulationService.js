import { crypto } from "#lib";
import { domainEvents } from "#constants";
import { AppError, randomPointAround } from "#utils";
import { RoadService } from "./RoadService.js";
import { ShelterService } from "./ShelterService.js";
import { SosService } from "./SosService.js";
import { SeedService } from "./SeedService.js";
import { routingService } from "./RoutingService.js";
import { eventBus } from "./EventBus.js";
import { ScenarioService } from "./ScenarioService.js";
import { InflowService } from "./InflowService.js";
import { RouteService } from "./RouteService.js";
import { ZoneService } from "./ZoneService.js";
import { BrigadeService } from "./BrigadeService.js";
import { SpamTracker } from "./SpamTracker.js";

/**
 * Drives the simulated environment: road closures, traffic, shelter load and
 * SOS waves. Everything goes through the regular services, so the rule
 * engine reacts exactly as it would to real data.
 */
class SimulationService {
  static async closeRoad(edgeId, reason) {
    return RoadService.close(edgeId, reason);
  }

  static async closeRandomRoad() {
    const edgeId = await RoadService.pickEdgeForClosure();
    return RoadService.close(edgeId, "Simulyasiya: dağıntı nəticəsində bağlandı");
  }

  static async openRoad(edgeId) {
    return RoadService.open(edgeId);
  }

  /** Random congestion on a share of the network (traffic feed). */
  static async randomTraffic(share = 0.25) {
    const open = [...routingService.edges.values()].filter(
      (e) => e.status === "open",
    );
    const picked = [...open]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.round(open.length * share));
    const pickedIds = new Set(picked.map((e) => e.edgeId));

    // Clear congestion on edges that are no longer picked
    const cleared = open.filter((e) => e.congestion > 0 && !pickedIds.has(e.edgeId));
    if (cleared.length) {
      await RoadService.setCongestion(cleared.map((e) => e.edgeId), 0);
    }

    const levels = [0.3, 0.6, 0.9];
    for (let i = 0; i < levels.length; i++) {
      const group = picked.filter((_, idx) => idx % levels.length === i);
      if (group.length) {
        await RoadService.setCongestion(group.map((e) => e.edgeId), levels[i]);
      }
    }
    return RoadService.traffic();
  }

  static async setShelterOccupancy(id, { rate, occupancy }) {
    if (Number.isFinite(rate)) {
      const shelter = await ShelterService.getById(id);
      return ShelterService.updateOccupancy(id, {
        occupancy: Math.round(shelter.capacity * Math.max(0, Math.min(1, rate))),
      });
    }
    if (Number.isFinite(occupancy)) {
      return ShelterService.updateOccupancy(id, { occupancy });
    }
    throw AppError.badRequest("rate və ya occupancy tələb olunur");
  }

  /**
   * Burst of SOS signals from distinct (virtual) devices around a point —
   * used to demonstrate the critical-crisis rule.
   */
  static async sosWave({ center, count = 5, type = "collapse", radiusMeters = 300 }) {
    const created = [];
    for (let i = 0; i < count; i++) {
      const origin = randomPointAround(center, radiusMeters);
      const result = await SosService.create({
        clientId: crypto.randomUUID(),
        deviceId: crypto.randomUUID(),
        type,
        origin,
        details: { note: "Simulyasiya" },
      });
      created.push(result.sos);
    }
    return created;
  }

  /** Wipe incidents and reload the city, then tell clients to refetch. */
  static async reset() {
    ScenarioService.stop();
    await SeedService.reseed();
    await Promise.all([
      routingService.load(),
      ZoneService.load(),
      ShelterService.load(),
      BrigadeService.load(),
    ]);
    InflowService.clear();
    SpamTracker.clear();
    RouteService.resetBreakers();
    eventBus.publish(domainEvents.SYSTEM_RESET, {});
  }
}

export { SimulationService };
