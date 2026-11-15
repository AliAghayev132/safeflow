import { Router } from "#constants";
import { simulationController as s } from "#controllers";
import { authenticate, authorize, rateLimitFor } from "#middlewares";

/** Scenario / simulation controls (permission: simulation:run). */
const SimulationRouter = Router();
SimulationRouter.use(authenticate, ...rateLimitFor("operator"), authorize("simulation:run"));

SimulationRouter.post("/roads/random-close", s.closeRandomRoad);
SimulationRouter.post("/roads/:edgeId/close", s.closeRoad);
SimulationRouter.post("/roads/:edgeId/open", s.openRoad);
SimulationRouter.post("/roads/:edgeId/barrier", s.setRoadBarrier);
SimulationRouter.post("/traffic", s.randomTraffic);
SimulationRouter.post("/shelters/:id/occupancy", s.setShelterOccupancy);
SimulationRouter.post("/sos-wave", s.sosWave);
SimulationRouter.post("/sos-flood", s.sosFlood);
SimulationRouter.get("/routing-outage", s.routingOutageStatus);
SimulationRouter.post("/routing-outage", s.routingOutage);
SimulationRouter.post("/reset", s.reset);

SimulationRouter.get("/scenarios", s.listScenarios);
SimulationRouter.post("/scenarios/stop", s.stopScenario);
SimulationRouter.post("/scenarios/:id/start", s.startScenario);

export { SimulationRouter };
