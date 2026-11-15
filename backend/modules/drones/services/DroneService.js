import { ConfigService } from "#services/ConfigService.js";
import { ShelterService } from "#services/ShelterService.js";
import { AppError, toPoint, fromPoint } from "#utils";
import { Drone, Delivery, SupplyRequest } from "../models/index.js";
import { createDroneProvider } from "../providers/index.js";
import { selectDrone } from "../logic.js";
import { SupplyService } from "./SupplyService.js";
import { publishDrone, publishDelivery, publishSupply } from "./realtime.js";

// Simulated fleet: 6 drones at 3 bases (round-trip range ~20 km)
const BASES = [
  { lat: 40.395, lng: 49.83 },
  { lat: 40.412, lng: 49.882 },
  { lat: 40.379, lng: 49.862 },
];
const FLEET = [
  { code: "DR-01", name: "Dron 01 (ağır)", payloadKg: 40, speedKmh: 50, rangeKm: 18, base: 0 },
  { code: "DR-02", name: "Dron 02", payloadKg: 20, speedKmh: 60, rangeKm: 22, base: 0 },
  { code: "DR-03", name: "Dron 03 (ağır)", payloadKg: 40, speedKmh: 50, rangeKm: 18, base: 1 },
  { code: "DR-04", name: "Dron 04", payloadKg: 20, speedKmh: 60, rangeKm: 22, base: 1 },
  { code: "DR-05", name: "Dron 05 (sürətli)", payloadKg: 10, speedKmh: 80, rangeKm: 25, base: 2 },
  { code: "DR-06", name: "Dron 06", payloadKg: 20, speedKmh: 60, rangeKm: 22, base: 2 },
];

const publicDelivery = async (delivery) => {
  publishDelivery(delivery.toPublic());
  return delivery;
};

/**
 * Fleet management on top of the DroneProvider interface: seeding, best-drone
 * suggestion, one-click dispatch, arrival and receipt confirmation.
 */
class DroneService {
  static #provider = null;

  static get provider() {
    return DroneService.#provider;
  }

  /** Create (or replace) the provider from config and start it. */
  static async startProvider({ ticker = true } = {}) {
    await DroneService.stopProvider();
    DroneService.#provider = createDroneProvider(ConfigService.get("drones").provider, {
      onDroneUpdate: (drone) => publishDrone(drone),
      onProgress: (p) => DroneService.#onProgress(p),
      onArrived: (p) => DroneService.#onArrived(p),
      onFailed: (p) => DroneService.#onFailed(p),
    });
    if (ticker) await DroneService.#provider.start();
    return DroneService.#provider;
  }

  static async stopProvider() {
    await DroneService.#provider?.stop();
    DroneService.#provider = null;
  }

  static async seedFleet({ force = false } = {}) {
    if (!force && (await Drone.estimatedDocumentCount()) > 0) return;
    await Drone.deleteMany({});
    await Drone.insertMany(
      FLEET.map((d) => {
        const b = BASES[d.base];
        const point = toPoint(b.lat, b.lng);
        return { ...d, base: point, location: point, status: "idle", batteryPct: 100 };
      }),
    );
  }

  /** Simulation reset: clear missions and park the fleet at the bases. */
  static async reset() {
    await Promise.all([Delivery.deleteMany({}), SupplyRequest.deleteMany({})]);
    await DroneService.seedFleet({ force: true });
  }

  static async list() {
    const drones = await Drone.find().sort({ code: 1 });
    return drones.map((d) => d.toPublic());
  }

  static async deliveries({ shelterId, active = false } = {}) {
    const filter = {};
    if (shelterId) filter.shelter = shelterId;
    if (active) filter.status = { $in: ["loading", "en_route", "arrived"] };
    const rows = await Delivery.find(filter).sort({ createdAt: -1 }).limit(200);
    return rows.map((d) => d.toPublic());
  }

  /** Ranked drones for the remaining weight of a request. */
  static async suggest(requestId) {
    const request = await SupplyService.getById(requestId);
    const shelter = await ShelterService.getById(request.shelter);
    const target = fromPoint(shelter.location);
    const weightKg = Math.max(0, request.totalKg - request.dispatchedKg);
    const drones = (await Drone.find()).map((d) => ({ ...d.toPublic(), location: { lat: d.location.coordinates[1], lng: d.location.coordinates[0] } }));
    const { best, ranked } = selectDrone(drones, { target, weightKg }, ConfigService.get("drones"));
    const strip = (r) => r && { ...r, drone: { id: r.drone.id, code: r.drone.code, name: r.drone.name, status: r.drone.status, batteryPct: r.drone.batteryPct, payloadKg: r.drone.payloadKg } };
    return {
      request: request.toPublic(),
      weightKg: Math.round(weightKg * 10) / 10,
      best: strip(best),
      ranked: ranked.map(strip),
    };
  }

  /**
   * One-click approval: dispatch the given (or best) drone with as much of
   * the remaining weight as it can carry.
   */
  static async approve(requestId, { droneId } = {}, operator = null) {
    const request = await SupplyService.getById(requestId);
    if (!["pending", "in_progress"].includes(request.status)) {
      throw AppError.conflict("Sorğu artıq bağlanıb", "SUPPLY_CLOSED");
    }
    const remaining = request.totalKg - request.dispatchedKg;
    if (remaining <= 0) throw AppError.conflict("Bütün yük artıq yola salınıb", "SUPPLY_FULLY_DISPATCHED");

    const { best, ranked } = await DroneService.suggest(requestId);
    const choice = droneId ? ranked.find((r) => r.drone.id === String(droneId)) : best;
    if (!choice) {
      throw AppError.conflict(
        droneId ? "Dron tapılmadı" : "Hazırda uyğun dron yoxdur (batareya, yük və ya məsafə)",
        "NO_DRONE_AVAILABLE",
      );
    }
    if (!choice.eligible) {
      throw AppError.conflict(`Dron uyğun deyil: ${choice.reason}`, `DRONE_${String(choice.reason).toUpperCase()}`);
    }

    const shelter = await ShelterService.getById(request.shelter);
    const delivery = await Delivery.create({
      request: request._id,
      shelter: shelter._id,
      drone: choice.drone.id,
      loadKg: choice.loadKg,
      distanceKm: choice.distanceKm,
      etaSec: choice.etaSec,
      etaAt: new Date(Date.now() + choice.etaSec * 1000),
      approvedBy: operator?.username ?? null,
    });

    try {
      const { etaSec } = await DroneService.#provider.dispatch({
        droneId: choice.drone.id,
        target: fromPoint(shelter.location),
        loadKg: choice.loadKg,
        deliveryId: delivery._id.toString(),
      });
      delivery.etaSec = etaSec;
      delivery.etaAt = new Date(Date.now() + etaSec * 1000);
      await delivery.save();
    } catch (error) {
      delivery.status = "failed";
      await delivery.save();
      throw AppError.conflict(`Dron göndərilmədi: ${error.message}`, "DRONE_DISPATCH_FAILED");
    }

    request.dispatchedKg = Math.round((request.dispatchedKg + choice.loadKg) * 10) / 10;
    request.status = "in_progress";
    await request.save();
    publishSupply(request.toPublic());
    await publicDelivery(delivery);
    return { request, delivery, drone: choice.drone };
  }

  static async #onProgress({ deliveryId, etaSec }) {
    const delivery = await Delivery.findById(deliveryId);
    if (!delivery || !["loading", "en_route"].includes(delivery.status)) return;
    delivery.status = "en_route";
    delivery.etaSec = etaSec;
    delivery.etaAt = new Date(Date.now() + etaSec * 1000);
    await delivery.save();
    await publicDelivery(delivery);
  }

  static async #onArrived({ deliveryId }) {
    const delivery = await Delivery.findById(deliveryId);
    if (!delivery || delivery.status === "confirmed") return;
    delivery.status = "arrived";
    delivery.etaSec = 0;
    delivery.arrivedAt = new Date();
    await delivery.save();
    await publicDelivery(delivery);
  }

  static async #onFailed({ deliveryId }) {
    const delivery = await Delivery.findById(deliveryId);
    if (!delivery || ["confirmed", "arrived"].includes(delivery.status)) return;
    delivery.status = "failed";
    await delivery.save();
    await SupplyRequest.updateOne({ _id: delivery.request }, { $inc: { dispatchedKg: -delivery.loadKg } });
    await publicDelivery(delivery);
  }

  /** Shelter side confirms receipt of an arrived delivery. */
  static async confirm(deliveryId, operator) {
    const delivery = await Delivery.findById(deliveryId);
    if (!delivery) throw AppError.notFound("Çatdırılma tapılmadı", "DELIVERY_NOT_FOUND");
    if (delivery.status === "confirmed") return { delivery, request: await SupplyService.getById(delivery.request) };
    if (delivery.status !== "arrived") {
      throw AppError.conflict("Dron hələ çatmayıb", "DELIVERY_NOT_ARRIVED");
    }
    delivery.status = "confirmed";
    delivery.confirmedAt = new Date();
    delivery.confirmedBy = operator?.username ?? null;
    await delivery.save();

    const request = await SupplyService.getById(delivery.request);
    request.deliveredKg = Math.round((request.deliveredKg + delivery.loadKg) * 10) / 10;
    if (request.deliveredKg >= request.totalKg - 0.05) request.status = "delivered";
    await request.save();

    publishSupply(request.toPublic());
    await publicDelivery(delivery);
    return { delivery, request };
  }
}

export { DroneService };
