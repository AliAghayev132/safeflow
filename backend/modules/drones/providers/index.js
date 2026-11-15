import { DroneProvider } from "./DroneProvider.js";
import { SimulatedDroneProvider } from "./SimulatedDroneProvider.js";

/**
 * Provider registry — config `drones.provider` picks the implementation.
 * Adding a real fleet = one new subclass + one entry here.
 */
const PROVIDERS = {
  simulated: SimulatedDroneProvider,
};

export const createDroneProvider = (name, hooks) => {
  const Impl = PROVIDERS[name];
  if (!Impl) throw new Error(`Unknown drone provider "${name}"`);
  return new Impl(hooks);
};

export { DroneProvider, SimulatedDroneProvider };
