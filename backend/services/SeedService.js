import {
  Zone,
  Shelter,
  RoadNode,
  RoadEdge,
  SosSignal,
  Citizen,
  Brigade,
  Alert,
  SafeShare,
} from "#models";
import { buildCityData } from "#data";

/**
 * Loads the simulated city (zones, road graph, shelters, brigades).
 * Operators are never touched here.
 */
class SeedService {
  static async isSeeded() {
    return (await Zone.estimatedDocumentCount()) > 0;
  }

  static async clear() {
    await Promise.all([
      Zone.deleteMany({}),
      Shelter.deleteMany({}),
      RoadNode.deleteMany({}),
      RoadEdge.deleteMany({}),
      SosSignal.deleteMany({}),
      Citizen.deleteMany({}),
      Brigade.deleteMany({}),
      Alert.deleteMany({}),
      SafeShare.deleteMany({}),
    ]);
  }

  static async seed() {
    const data = buildCityData();

    const zones = await Zone.insertMany(data.zones);
    const zoneByCode = new Map(zones.map((z) => [z.code, z._id]));

    await RoadNode.insertMany(data.nodes);
    await RoadEdge.insertMany(data.edges);
    await Shelter.insertMany(
      data.shelters.map(({ zoneCode, ...s }) => ({
        ...s,
        zone: zoneByCode.get(zoneCode),
      })),
    );
    await Brigade.insertMany(data.brigades);

    // Make sure geo indexes exist before the first $near query
    await Promise.all([
      Zone.syncIndexes(),
      Shelter.syncIndexes(),
      RoadNode.syncIndexes(),
      SosSignal.syncIndexes(),
      Citizen.syncIndexes(),
      Brigade.syncIndexes(),
      Alert.syncIndexes(),
    ]);

    console.log(
      `🌱 Seeded: ${data.zones.length} zones, ${data.nodes.length} nodes, ${data.edges.length} edges, ${data.shelters.length} shelters, ${data.brigades.length} brigades`,
    );
  }

  static async reseed() {
    await SeedService.clear();
    await SeedService.seed();
  }
}

export { SeedService };
