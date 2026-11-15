import { Router } from "#constants";
import { authenticate, authorize, rateLimitFor } from "#middlewares";
import * as c from "../controllers/dronesController.js";

/**
 * /api/drones — drone supply delivery (feature flag `drones`, gated in app.js).
 * Every route is gated by a permission from config/rbac.json.
 */
const DronesRouter = Router();
DronesRouter.use(authenticate, ...rateLimitFor("operator"));

DronesRouter.get("/fleet", authorize("drones:read"), c.listFleet);

DronesRouter.get("/estimate", authorize("supplies:request"), c.estimate);
DronesRouter.get("/requests", authorize("drones:read", "supplies:request"), c.listRequests);
DronesRouter.post("/requests", authorize("supplies:request"), c.createRequest);
DronesRouter.get("/requests/:id/suggest", authorize("drones:dispatch"), c.suggest);
DronesRouter.post("/requests/:id/approve", authorize("drones:dispatch"), c.approve);
DronesRouter.post("/requests/:id/cancel", authorize("supplies:manage"), c.cancel);

DronesRouter.get("/deliveries", authorize("drones:read", "supplies:request"), c.listDeliveries);
DronesRouter.post("/deliveries/:id/confirm", authorize("supplies:confirm", "supplies:manage"), c.confirm);

export { DronesRouter };
