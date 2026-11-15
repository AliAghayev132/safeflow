import { Router } from "#constants";
import { roadController } from "#controllers";
import { rateLimitFor } from "#middlewares";

/** Simulated road / traffic feed (the "simulation endpoint" of the routing chain). */
const RoadRouter = Router();

RoadRouter.get("/", ...rateLimitFor("citizen.read"), roadController.getNetwork);
RoadRouter.get("/traffic", ...rateLimitFor("citizen.read"), roadController.getTraffic);

export { RoadRouter };
