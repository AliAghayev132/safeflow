import { Zone, Shelter, Brigade, Alert, SosSignal, RoadEdge } from "#models";
import { ConfigService } from "./ConfigService.js";
import { CitizenService } from "./CitizenService.js";
import { ShelterService } from "./ShelterService.js";

/**
 * Read models for the dispatcher dashboard.
 */
class StatsService {
  /** Headline numbers (cheap — pushed live over the socket). */
  static async summary() {
    const since = new Date(Date.now() - ConfigService.get("sosCluster").windowMs);
    const [
      sosPending,
      sosAssigned,
      sosWindow,
      activeAlerts,
      brigadeRows,
      shelterRows,
      closedRoads,
      citizens,
    ] = await Promise.all([
      SosSignal.countDocuments({ status: "pending" }),
      SosSignal.countDocuments({ status: "assigned" }),
      SosSignal.countDocuments({ createdAt: { $gte: since } }),
      Alert.countDocuments({ status: "active" }),
      Brigade.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Shelter.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            capacity: { $sum: "$capacity" },
            occupancy: { $sum: "$occupancy" },
            count: { $sum: 1 },
          },
        },
      ]),
      RoadEdge.countDocuments({ status: "closed" }),
      CitizenService.countsByStatus(),
    ]);

    const brigades = { available: 0, dispatched: 0, on_scene: 0, returning: 0 };
    for (const row of brigadeRows) brigades[row._id] = row.count;
    const shelters = shelterRows[0] ?? { capacity: 0, occupancy: 0, count: 0 };

    return {
      sos: { pending: sosPending, assigned: sosAssigned, lastWindow: sosWindow },
      alerts: { active: activeAlerts },
      brigades,
      shelters: {
        active: shelters.count,
        capacity: shelters.capacity,
        occupancy: shelters.occupancy,
        occupancyRate: shelters.capacity
          ? shelters.occupancy / shelters.capacity
          : 0,
      },
      roads: { closed: closedRoads },
      citizens,
      generatedAt: new Date(),
    };
  }

  /** Per-zone SOS load for the zone panel / heat colouring. */
  static async zoneLoad() {
    const since = new Date(Date.now() - ConfigService.get("sosCluster").windowMs);
    const [zones, active, recent] = await Promise.all([
      Zone.find().sort({ name: 1 }),
      SosSignal.aggregate([
        { $match: { status: { $in: ["pending", "assigned"] } } },
        { $group: { _id: "$zone", count: { $sum: 1 } } },
      ]),
      SosSignal.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: "$zone", count: { $sum: 1 } } },
      ]),
    ]);
    const toMap = (rows) =>
      new Map(rows.map((r) => [r._id?.toString(), r.count]));
    const activeMap = toMap(active);
    const recentMap = toMap(recent);

    return zones.map((z) => ({
      ...z.toPublic(),
      sosActive: activeMap.get(z._id.toString()) ?? 0,
      sosLastWindow: recentMap.get(z._id.toString()) ?? 0,
    }));
  }

  /** Full snapshot for the dashboard's first load. */
  static async overview() {
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const [summary, zones, shelters, brigades, alerts, sos] = await Promise.all([
      StatsService.summary(),
      StatsService.zoneLoad(),
      Shelter.find().sort({ code: 1 }),
      Brigade.find().sort({ code: 1 }),
      Alert.find({
        $or: [{ status: "active" }, { createdAt: { $gte: since } }],
      })
        .sort({ createdAt: -1 })
        .limit(100),
      SosSignal.find({
        $or: [{ status: { $in: ["pending", "assigned"] } }, { createdAt: { $gte: since } }],
      })
        .sort({ createdAt: -1 })
        .limit(500),
    ]);

    return {
      summary,
      zones,
      shelters: shelters.map(ShelterService.serialize),
      brigades: brigades.map((b) => b.toPublic()),
      alerts: alerts.map((a) => a.toPublic()),
      sos: sos.map((s) => s.toPublic()),
    };
  }
}

export { StatsService };
