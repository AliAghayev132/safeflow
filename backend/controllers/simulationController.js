import { sosTypes } from "#constants";
import { SimulationService, ScenarioService, ShelterService, AuditService, RoadService } from "#services";
import { asyncHandler, ok, requireCoords, requireEnum } from "#utils";

const audited = (action, fn, target = () => ({})) =>
  asyncHandler(async (req, res) => {
    const { data, message, code, details, status } = await fn(req);
    await AuditService.fromRequest(req, `simulation.${action}`, target(req, data), details ?? {});
    return ok(res, data, message, status ?? 200, code);
  });

const closeRoad = audited(
  "road_close",
  async (req) => ({
    data: { edges: await SimulationService.closeRoad(req.params.edgeId, req.body?.reason) },
    code: "ROAD_CLOSED",
  }),
  (req) => ({ type: "road", id: req.params.edgeId }),
);

const openRoad = audited(
  "road_open",
  async (req) => ({ data: { edges: await SimulationService.openRoad(req.params.edgeId) }, code: "ROAD_OPENED" }),
  (req) => ({ type: "road", id: req.params.edgeId }),
);

/** POST /api/simulation/roads/:edgeId/barrier { kind: obstacle|damaged|stairs|steepSlope, value } */
const setRoadBarrier = audited(
  "road_barrier",
  async (req) => {
    const kind = String(req.body?.kind ?? "obstacle");
    const value = req.body?.value !== false;
    return {
      data: { edges: await RoadService.setBarrier(req.params.edgeId, kind, value) },
      details: { kind, value },
      code: "ROAD_BARRIER_UPDATED",
    };
  },
  (req) => ({ type: "road", id: req.params.edgeId }),
);

const closeRandomRoad = audited(
  "road_close_random",
  async () => ({ data: { edges: await SimulationService.closeRandomRoad() }, code: "ROAD_CLOSED" }),
  (_req, data) => ({ type: "road", id: data.edges?.[0]?.edgeId }),
);

const randomTraffic = audited("traffic", async (req) => {
  const share = Math.max(0, Math.min(1, Number(req.body?.share ?? 0.25)));
  return { data: { edges: await SimulationService.randomTraffic(share) }, details: { share }, code: "TRAFFIC_UPDATED" };
});

const setShelterOccupancy = audited(
  "shelter_occupancy",
  async (req) => {
    const rate = req.body?.rate !== undefined ? Number(req.body.rate) : undefined;
    const occupancy = req.body?.occupancy !== undefined ? Number(req.body.occupancy) : undefined;
    const shelter = await SimulationService.setShelterOccupancy(req.params.id, { rate, occupancy });
    return { data: { shelter: ShelterService.serialize(shelter) }, details: { rate, occupancy }, code: "OCCUPANCY_UPDATED" };
  },
  (req) => ({ type: "shelter", id: req.params.id }),
);

const sosWave = audited("sos_wave", async (req) => {
  const { lat, lng, count = 5, type = "collapse", radiusMeters = 300 } = req.body ?? {};
  const params = {
    center: requireCoords(lat, lng),
    count: Math.max(1, Math.min(20, Number(count) || 5)),
    type: requireEnum(type, sosTypes, "type"),
    radiusMeters: Math.max(50, Math.min(1000, Number(radiusMeters) || 300)),
  };
  const sos = await SimulationService.sosWave(params);
  return { data: { sos }, details: params, status: 201, code: "SOS_WAVE_CREATED" };
});

const reset = audited("reset", async () => {
  await SimulationService.reset();
  return { data: null, code: "SIMULATION_RESET" };
});

// ============ SCENARIOS ============

const listScenarios = asyncHandler(async (_req, res) =>
  ok(res, { scenarios: ScenarioService.list(), status: ScenarioService.status() }),
);

const startScenario = audited(
  "scenario_start",
  async (req) => ({ data: { scenario: await ScenarioService.start(req.params.id) }, status: 202, code: "SCENARIO_STARTED" }),
  (req) => ({ type: "scenario", id: req.params.id }),
);

const stopScenario = audited("scenario_stop", async () => ({
  data: { scenario: ScenarioService.stop() },
  code: "SCENARIO_STOPPED",
}));

export {
  closeRoad,
  openRoad,
  closeRandomRoad,
  setRoadBarrier,
  randomTraffic,
  setShelterOccupancy,
  sosWave,
  reset,
  listScenarios,
  startScenario,
  stopScenario,
};
