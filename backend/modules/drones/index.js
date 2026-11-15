import { config } from "#config";
import { dronesDefaults } from "./defaults.js";
import { DronesRouter } from "./routes/dronesRoutes.js";
import { autoProposeRule } from "./rules/autoPropose.rule.js";
import { DroneService } from "./services/DroneService.js";

/**
 * Feature module: drone supply delivery to assembly points.
 *   models/     Drone, SupplyRequest, Delivery
 *   providers/  DroneProvider interface + SimulatedDroneProvider
 *   logic.js    pure need-estimation / drone-selection / battery maths
 *   services/   SupplyService, DroneService
 *   routes/     /api/drones (flag `drones`)
 */
export default {
  name: "drones",
  feature: "drones",
  defaults: dronesDefaults,
  routers: [{ path: "/drones", router: DronesRouter }],
  rules: [autoProposeRule],

  async init() {
    await DroneService.seedFleet();
    // Ticker follows the same switch as the brigade simulation (off in tests)
    await DroneService.startProvider({ ticker: config.enableBrigadeTicker });
  },

  // "Reset simulation" also parks the fleet and clears missions (awaited)
  reset: () => DroneService.reset(),

  async stop() {
    await DroneService.stopProvider();
  },
};

export { DroneService };
export { SupplyService } from "./services/SupplyService.js";
