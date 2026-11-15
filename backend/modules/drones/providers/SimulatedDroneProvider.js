import { toPoint, fromPoint, haversineMeters } from "#utils";
import { ConfigService } from "#services/ConfigService.js";
import { Drone } from "../models/index.js";
import { flightStep } from "../logic.js";
import { DroneProvider } from "./DroneProvider.js";

/**
 * Simulated fleet: drones are documents in MongoDB, moved by a ticker.
 *
 *   idle → loading (ground handling) → en_route → [arrived] → returning
 *        → charging → idle
 *
 * Battery drains per km flown (heavier on the loaded outbound leg) and is
 * recharged at the base. `tick(dtSec)` is public so tests can fast-forward.
 */
export class SimulatedDroneProvider extends DroneProvider {
  #timer = null;

  get name() {
    return "simulated";
  }

  async start() {
    const { tickMs } = ConfigService.get("drones");
    this.#timer = setInterval(() => {
      this.tick(tickMs / 1000).catch((e) => console.error("❌ [Drones] tick failed:", e.message));
    }, tickMs);
    this.#timer.unref?.();
  }

  async stop() {
    clearInterval(this.#timer);
    this.#timer = null;
  }

  async dispatch({ droneId, target, loadKg, deliveryId }) {
    const cfg = ConfigService.get("drones");
    const drone = await Drone.findById(droneId);
    if (!drone || drone.status !== "idle") throw new Error("drone not available");

    drone.status = "loading";
    drone.loadingRemainingSec = cfg.loadingSec;
    drone.target = toPoint(target.lat, target.lng);
    drone.delivery = deliveryId;
    drone.loadKg = loadKg;
    drone.statusChangedAt = new Date();
    await drone.save();
    this.hooks.onDroneUpdate(drone.toPublic());

    const km = haversineMeters(fromPoint(drone.location), target) / 1000;
    return { etaSec: Math.round(cfg.loadingSec + (km / drone.speedKmh) * 3600) };
  }

  async recall(droneId) {
    const drone = await Drone.findById(droneId);
    if (!drone) return;
    const deliveryId = drone.delivery?.toString();
    drone.status = "returning";
    drone.target = drone.base;
    drone.delivery = null;
    drone.loadKg = 0;
    drone.statusChangedAt = new Date();
    await drone.save();
    this.hooks.onDroneUpdate(drone.toPublic());
    if (deliveryId) this.hooks.onFailed({ deliveryId, reason: "recalled" });
  }

  /** Advance the simulation by `dtSec` seconds. */
  async tick(dtSec) {
    const cfg = ConfigService.get("drones");
    const drones = await Drone.find({ status: { $ne: "idle" } });

    for (const drone of drones) {
      const changedStatus = drone.status;

      if (drone.status === "loading") {
        drone.loadingRemainingSec = Math.max(0, drone.loadingRemainingSec - dtSec);
        if (drone.loadingRemainingSec === 0) {
          drone.status = "en_route";
          drone.statusChangedAt = new Date();
        }
      } else if (drone.status === "en_route" || drone.status === "returning") {
        const from = fromPoint(drone.location);
        const to = fromPoint(drone.target ?? drone.base);
        const step = flightStep({ from, to, speedKmh: drone.speedKmh, dtSec });
        const share = drone.payloadKg > 0 ? Math.min(1, drone.loadKg / drone.payloadKg) : 0;
        const drain = step.km * cfg.battery.perKm * (1 + cfg.battery.loadFactor * share);
        drone.batteryPct = Math.max(0, drone.batteryPct - drain);
        drone.location = toPoint(step.lat, step.lng);

        if (drone.status === "en_route") {
          if (step.arrived) {
            const deliveryId = drone.delivery?.toString();
            drone.status = "returning";
            drone.target = drone.base;
            drone.delivery = null;
            drone.loadKg = 0;
            drone.statusChangedAt = new Date();
            if (deliveryId) await this.hooks.onArrived({ deliveryId, droneId: drone._id.toString() });
          } else if (drone.delivery) {
            const remainingKm = haversineMeters(fromPoint(drone.location), to) / 1000;
            await this.hooks.onProgress({
              deliveryId: drone.delivery.toString(),
              etaSec: Math.round((remainingKm / drone.speedKmh) * 3600),
            });
          }
        } else if (step.arrived) {
          drone.status = "charging";
          drone.target = null;
          drone.statusChangedAt = new Date();
        }
      } else if (drone.status === "charging") {
        drone.batteryPct = Math.min(100, drone.batteryPct + (cfg.battery.chargePerMinute * dtSec) / 60);
        if (drone.batteryPct >= 100) {
          drone.status = "idle";
          drone.statusChangedAt = new Date();
        }
      }

      await drone.save();
      // Position changes are published every tick; that is ≤ fleet size msgs
      this.hooks.onDroneUpdate(drone.toPublic(), { statusChanged: changedStatus !== drone.status });
    }
  }
}
