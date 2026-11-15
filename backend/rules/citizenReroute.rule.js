import { domainEvents } from "#constants";
import { isFull } from "#engine";
import { ReroutingService } from "#services";

/**
 * Citizen safety rule — automatic alternative evacuation route.
 *
 *   - road closed                   → reroute citizens whose route uses it
 *   - shelter >= rerouteThreshold   → reroute citizens heading there
 *   - shelter closed                → reroute citizens heading there
 *   - new shelter opened            → offer it where it is now the best
 */
const citizenRerouteRule = {
  id: "citizen-reroute",
  name: "rule.citizenReroute",
  events: [
    domainEvents.ROAD_UPDATED,
    domainEvents.SHELTER_UPDATED,
    domainEvents.SHELTER_ACTIVATED,
  ],
  enabled: true,

  describe: ({ shelter }) =>
    `Yol bağlandıqda və ya məntəqə ${Math.round(shelter.rerouteThreshold * 100)}% dolduqda vətəndaşa yeni marşrut`,

  async handle({ event, payload, config }) {
    if (event === domainEvents.ROAD_UPDATED) {
      for (const edge of payload.edges) {
        if (edge.status === "closed") await ReroutingService.forClosedEdge(edge);
        else if (edge.obstacle || edge.damaged || edge.stairs || edge.steepSlope) {
          await ReroutingService.forBarrierEdge(edge);
        }
      }
      return;
    }

    if (event === domainEvents.SHELTER_UPDATED) {
      const { shelter } = payload;
      if (isFull(shelter.occupancyRate, config.shelter) || !shelter.isActive) {
        await ReroutingService.forFullShelter(shelter);
      }
      return;
    }

    if (event === domainEvents.SHELTER_ACTIVATED) {
      await ReroutingService.forOpenedShelter(payload.shelter);
    }
  },
};

export { citizenRerouteRule };
