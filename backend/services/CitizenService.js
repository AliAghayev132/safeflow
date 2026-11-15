import { Citizen } from "#models";
import { domainEvents } from "#constants";
import { AppError, toPoint } from "#utils";
import { eventBus } from "./EventBus.js";
import { ZoneService } from "./ZoneService.js";
import { ShelterService } from "./ShelterService.js";
import { SosService } from "./SosService.js";
import { ProfileService } from "./ProfileService.js";

/**
 * Citizen sessions: evacuation planning, status updates, shelter check-in.
 */
class CitizenService {
  /**
   * Weighted shelter options + recommended route. When a deviceId is given,
   * the plan is stored so the rerouting engine can track the citizen.
   */
  static async planEvacuation({ deviceId, origin, mode }) {
    // Special needs from the optional profile; ?mode=accessible forces a
    // barrier-free route (e.g. someone helping a wheelchair user).
    const profileNeeds = await ProfileService.needs(deviceId);
    const a = profileNeeds.accessibility;
    const needs = {
      accessible: mode === "accessible" || a.limitedMobility || a.wheelchair,
      medical: profileNeeds.medical,
    };
    const zone = ZoneService.resolve(origin);
    const plan = await ShelterService.findNearest(origin, { needs });

    if (deviceId) {
      await Citizen.findOneAndUpdate(
        { deviceId },
        {
          $set: {
            location: toPoint(origin.lat, origin.lng),
            zone: zone?._id ?? null,
            lastSeenAt: new Date(),
            targetShelter: plan.recommended?.shelter.id ?? null,
            route: plan.recommended
              ? { ...plan.recommended.route, computedAt: new Date() }
              : null,
            needs,
          },
          $setOnInsert: { deviceId },
        },
        { upsert: true },
      );
    }

    return { origin, zone: zone?.toPublic() ?? null, ...plan, generatedAt: new Date() };
  }

  static async getState(deviceId) {
    const citizen = await Citizen.findOne({ deviceId }).populate("targetShelter");
    if (!citizen) return null;
    return {
      deviceId: citizen.deviceId,
      status: citizen.status,
      location: citizen.location
        ? { lat: citizen.location.coordinates[1], lng: citizen.location.coordinates[0] }
        : null,
      targetShelter: citizen.targetShelter ? ShelterService.serialize(citizen.targetShelter) : null,
      route: citizen.route?.computedAt ? citizen.route : null,
      lastSeenAt: citizen.lastSeenAt,
    };
  }

  static async setStatus({ deviceId, status, origin }) {
    const set = { status, lastSeenAt: new Date() };
    if (origin) {
      set.location = toPoint(origin.lat, origin.lng);
      set.zone = (await ZoneService.resolve(origin))?._id ?? null;
    }

    const previous = await Citizen.findOneAndUpdate(
      { deviceId },
      { $set: set, $setOnInsert: { deviceId } },
      { upsert: true },
    );

    // "I am safe" → this citizen's SOS leave cluster counting
    if (status === "safe") await SosService.markCitizenSafe(deviceId);

    eventBus.publish(domainEvents.CITIZEN_UPDATED, {
      deviceId,
      status,
      previousStatus: previous?.status ?? "unknown",
    });
    return CitizenService.getState(deviceId);
  }

  /** Citizen arrived at the target shelter: +1 occupancy, status safe. */
  static async checkIn(deviceId) {
    const citizen = await Citizen.findOne({ deviceId });
    if (!citizen?.targetShelter) {
      throw AppError.badRequest("Aktiv təxliyə marşrutu yoxdur");
    }
    if (citizen.status === "safe") {
      throw AppError.conflict("Siz artıq təhlükəsiz kimi qeyd olunmusunuz");
    }

    const shelter = await ShelterService.getById(citizen.targetShelter);
    if (shelter.occupancy >= shelter.capacity) {
      throw AppError.conflict("Məntəqə tam doludur, alternativ marşrutu izləyin");
    }

    await ShelterService.updateOccupancy(shelter._id, { delta: 1 });
    return CitizenService.setStatus({ deviceId, status: "safe" });
  }

  /** Aggregate counts per status (dispatcher analytics). */
  static async countsByStatus() {
    const rows = await Citizen.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const counts = { unknown: 0, evacuating: 0, needs_help: 0, safe: 0 };
    for (const row of rows) counts[row._id] = row.count;
    return counts;
  }
}

export { CitizenService };
