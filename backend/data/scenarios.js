/**
 * Demo disaster scenarios streamed by ScenarioService.
 *
 * Every tick creates SOS tickets from new (virtual) devices around the
 * epicentre, pushes people into nearby shelters (inflow → fill-time
 * prediction → 90% reroute → 95% alert) and closes roads at given ticks.
 * One "spammer" bursts fake SOS from rotating device ids behind one IP.
 */
export const SCENARIOS = {
  earthquake_yasamal: {
    id: "earthquake_yasamal",
    titleKey: "scenario.earthquakeYasamal",
    title: "Yasamalda zəlzələ",
    disaster: "earthquake",
    zoneCode: "YAS",
    epicenter: { lat: 40.386, lng: 49.818 },
    radiusMeters: 650,
    tickMs: 3000,
    ticks: 30,
    sosPerTick: [1, 3],
    // Weighted SOS type mix
    typeMix: { collapse: 0.45, medical: 0.3, fire: 0.15, flood: 0.1 },
    needsPool: ["rescue_trapped", "medical_aid", "water", "shelter", "evacuation"],
    vulnerableChance: 0.3,
    maxHeadcount: 6,
    // Shelter code → people arriving per tick
    inflow: { "SH-11": 20, "SH-06": 25, "SH-04": 8 },
    // tick → road closures (edge ids from the simulated grid)
    roadClosures: { 6: ["E-N2-1_N2-2"], 12: ["E-N1-2_N2-2"], 18: ["E-N2-2_N3-2"] },
    spam: { atTick: 5, devices: 13, ip: "10.66.0.13" },
  },
  flood_sebail: {
    id: "flood_sebail",
    titleKey: "scenario.floodSebail",
    title: "Səbaildə sel",
    disaster: "flood",
    zoneCode: "SEB",
    epicenter: { lat: 40.377, lng: 49.846 },
    radiusMeters: 500,
    tickMs: 3000,
    ticks: 20,
    sosPerTick: [1, 2],
    typeMix: { flood: 0.6, medical: 0.25, collapse: 0.15 },
    needsPool: ["evacuation", "water", "shelter", "medical_aid"],
    vulnerableChance: 0.25,
    maxHeadcount: 5,
    inflow: { "SH-02": 40, "SH-04": 15 },
    roadClosures: { 4: ["E-N0-4_N0-5"], 9: ["E-N0-5_N0-6"] },
    spam: null,
  },
};
