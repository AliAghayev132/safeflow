import { domainEvents } from "#constants";
import { SupplyService } from "../services/SupplyService.js";

/**
 * When an active shelter fills past `drones.autoPropose.occupancyRate`, the
 * system proposes a supply request from its occupancy (once per shelter while
 * a request is open). Dispatch still needs a dispatcher's one-click approval.
 */
export const autoProposeRule = {
  id: "drones-auto-propose",
  name: "rule.dronesAutoPropose",
  events: [domainEvents.SHELTER_UPDATED],
  enabled: true,

  describe: ({ drones }) =>
    `Məntəqə ${Math.round(drones.autoPropose.occupancyRate * 100)}% dolduqda təchizat sorğusu avtomatik təklif olunur`,

  async handle({ payload: { shelter, previousRate }, config }) {
    const cfg = config.drones?.autoPropose;
    if (!cfg?.enabled || !shelter.isActive) return;
    if (shelter.occupancyRate < cfg.occupancyRate) return;
    // Only on the crossing (or first sight), not on every arrival
    if (Number.isFinite(previousRate) && previousRate >= cfg.occupancyRate) return;
    await SupplyService.autoPropose(shelter);
  },
};
