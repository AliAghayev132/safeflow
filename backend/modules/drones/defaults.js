/**
 * Config section `drones` (registered with ConfigService, editable at
 * runtime from the admin config editor like every other threshold).
 */
export const dronesDefaults = {
  // Which DroneProvider implementation drives the fleet
  provider: "simulated",
  // Simulation step (ms) of the simulated provider's ticker
  tickMs: 2000,

  // Need estimation per person / per N people (one delivery cycle = one day)
  ratios: {
    waterLitersPerPerson: 3,
    foodRationsPerPerson: 2,
    medicineKitPerPeople: 50,
    firstAidKitPerPeople: 25,
  },
  // Weight of one unit (kg): 1 L water, 1 ration, 1 kit
  unitWeightKg: {
    water: 1,
    food: 0.5,
    medicine: 1.5,
    first_aid: 2,
  },

  // Battery model (%): drain per km = perKm × (1 + loadFactor × load share)
  battery: {
    perKm: 3,
    loadFactor: 0.5,
    reservePct: 20,
    chargePerMinute: 10,
  },
  // Ground handling before take-off (s)
  loadingSec: 60,

  // Best-drone score (lower is better): distance km × w.distance +
  // (100 − battery%) × w.battery + unused payload share × w.payloadWaste
  selectionWeights: {
    distance: 1,
    battery: 0.05,
    payloadWaste: 2,
  },

  // Rule: propose a supply request when a shelter fills past this rate
  autoPropose: {
    enabled: true,
    occupancyRate: 0.6,
  },
};
