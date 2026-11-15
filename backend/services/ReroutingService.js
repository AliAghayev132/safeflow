import { Citizen } from "#models";
import { domainEvents } from "#constants";
import { fromPoint, haversineMeters } from "#utils";
import { eventBus } from "./EventBus.js";
import { ShelterService } from "./ShelterService.js";

/**
 * Finds citizens affected by a road closure / full shelter / newly opened
 * shelter, computes an alternative evacuation route and publishes it.
 */
class ReroutingService {
  static async #reroute(citizen, reason, context, { excludeIds = [] } = {}) {
    const origin = fromPoint(citizen.location);
    if (!origin) return false;

    const needs = { accessible: Boolean(citizen.needs?.accessible), medical: Boolean(citizen.needs?.medical) };
    const plan = await ShelterService.findNearest(origin, { excludeIds, needs });
    const previousShelterId = citizen.targetShelter?.toString() ?? null;

    citizen.targetShelter = plan.recommended?.shelter.id ?? null;
    citizen.route = plan.recommended
      ? { ...plan.recommended.route, computedAt: new Date() }
      : null;
    await citizen.save();

    eventBus.publish(domainEvents.CITIZEN_ROUTE_UPDATED, {
      deviceId: citizen.deviceId,
      reason,
      context,
      previousShelterId,
      recommended: plan.recommended,
      options: plan.options,
      routing: plan.routing,
      explanation: plan.explanation,
    });
    return true;
  }

  /** Citizens whose active route uses the closed road segment. */
  static async forClosedEdge(edge) {
    const citizens = await Citizen.find({
      "route.edgeIds": edge.edgeId,
      status: { $ne: "safe" },
    });
    const context = { edgeId: edge.edgeId, roadName: edge.name };
    for (const citizen of citizens) {
      await ReroutingService.#reroute(citizen, "road_closed", context);
    }
    return citizens.length;
  }

  /**
   * A barrier appeared on a segment (obstacle / damage / stairs): only
   * citizens on a barrier-free route through it need a new one.
   */
  static async forBarrierEdge(edge) {
    const citizens = await Citizen.find({
      "route.edgeIds": edge.edgeId,
      "needs.accessible": true,
      status: { $ne: "safe" },
    });
    const context = { edgeId: edge.edgeId, roadName: edge.name, barrier: true };
    for (const citizen of citizens) {
      await ReroutingService.#reroute(citizen, "road_closed", context);
    }
    return citizens.length;
  }

  /** Citizens heading to a shelter that crossed the reroute threshold. */
  static async forFullShelter(shelter) {
    const citizens = await Citizen.find({
      targetShelter: shelter.id,
      status: { $ne: "safe" },
    });
    const context = {
      shelterId: shelter.id,
      shelterName: shelter.name,
      occupancyRate: shelter.occupancyRate,
    };
    for (const citizen of citizens) {
      await ReroutingService.#reroute(citizen, "shelter_full", context, {
        excludeIds: [shelter.id],
      });
    }
    return citizens.length;
  }

  /**
   * A new shelter was opened — offer it to nearby citizens for whom it is now
   * the best option (or who had no option at all).
   */
  static async forOpenedShelter(shelter, radiusMeters = 3000) {
    const citizens = await Citizen.find({
      status: { $ne: "safe" },
      location: { $ne: null },
    });
    let affected = 0;
    for (const citizen of citizens) {
      const origin = fromPoint(citizen.location);
      if (!origin || haversineMeters(origin, shelter) > radiusMeters) continue;

      const plan = await ShelterService.findNearest(origin, {
        needs: { accessible: Boolean(citizen.needs?.accessible), medical: Boolean(citizen.needs?.medical) },
      });
      const bestId = plan.recommended?.shelter.id ?? null;
      const currentId = citizen.targetShelter?.toString() ?? null;
      if (bestId === shelter.id && bestId !== currentId) {
        await ReroutingService.#reroute(citizen, "shelter_opened", {
          shelterId: shelter.id,
          shelterName: shelter.name,
        });
        affected += 1;
      }
    }
    return affected;
  }
}

export { ReroutingService };
