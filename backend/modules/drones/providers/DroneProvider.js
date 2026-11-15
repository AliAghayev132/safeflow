/**
 * DroneProvider — the only contract the rest of the drones module uses to
 * command a fleet. Today: SimulatedDroneProvider. A real fleet (vendor API,
 * MAVLink gateway, …) is another subclass registered in providers/index.js
 * and selected with config `drones.provider` — no other code changes.
 *
 * The provider reports back through the hooks passed to the constructor:
 *   onDroneUpdate(dronePublic)            any state / position / battery change
 *   onProgress({ deliveryId, etaSec })    remaining time while en route
 *   onArrived({ deliveryId, droneId })    payload delivered at the shelter
 *   onFailed({ deliveryId, reason })      mission aborted
 */
export class DroneProvider {
  constructor(hooks = {}) {
    if (new.target === DroneProvider) {
      throw new TypeError("DroneProvider is abstract — use a concrete provider");
    }
    this.hooks = {
      onDroneUpdate: () => {},
      onProgress: () => {},
      onArrived: () => {},
      onFailed: () => {},
      ...hooks,
    };
  }

  /** Human readable provider name (shown on the system page). */
  get name() {
    return "abstract";
  }

  /** Connect / start background work. */
  async start() {}

  /** Disconnect / stop background work. */
  async stop() {}

  /**
   * Send a drone on a delivery mission.
   * @param {{ droneId: string, target: {lat,lng}, loadKg: number, deliveryId: string }} mission
   * @returns {Promise<{ etaSec: number }>}
   */
  // eslint-disable-next-line no-unused-vars
  async dispatch(mission) {
    throw new Error("not implemented");
  }

  /** Abort a mission and bring the drone home. */
  // eslint-disable-next-line no-unused-vars
  async recall(droneId) {
    throw new Error("not implemented");
  }
}
