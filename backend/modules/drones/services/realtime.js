import { RealtimeService } from "#services/RealtimeService.js";

/**
 * Realtime events of the drones module (channels from config/rbac.json:
 * `drones` → drones:read, `supplies` → drones:read). Shelter managers hold
 * drones:read and filter their own shelter client-side.
 */
export const DRONE_EVENTS = {
  DRONE_UPDATED: "drone:updated",
  SUPPLY_UPDATED: "supply:updated",
  DELIVERY_UPDATED: "delivery:updated",
};

export const publishDrone = (drone) =>
  RealtimeService.publish({ type: DRONE_EVENTS.DRONE_UPDATED, data: drone, channel: "drones" });

export const publishSupply = (request) =>
  RealtimeService.publish({ type: DRONE_EVENTS.SUPPLY_UPDATED, data: request, channel: "supplies" });

export const publishDelivery = (delivery) =>
  RealtimeService.publish({ type: DRONE_EVENTS.DELIVERY_UPDATED, data: delivery, channel: "supplies" });
