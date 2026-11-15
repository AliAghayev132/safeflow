import { Router } from "#constants";
import { dispatcherController as d } from "#controllers";
import { authenticate, authorize, rateLimitFor } from "#middlewares";

/**
 * Module 2 — crisis center API. Every route is gated by a PERMISSION
 * (config/rbac.json), never by a role name, so new roles need no code change.
 */
const DispatcherRouter = Router();
DispatcherRouter.use(authenticate, ...rateLimitFor("operator"));

DispatcherRouter.get("/overview", authorize("dashboard:view"), d.getOverview);
DispatcherRouter.get("/rules", authorize("rules:read"), d.listRules);

DispatcherRouter.get("/sos/queue", authorize("sos:read"), d.getQueue);
DispatcherRouter.get("/sos/:id", authorize("sos:read"), d.getSos);
DispatcherRouter.post("/sos/:id/assign", authorize("sos:assign"), d.assignSos);
DispatcherRouter.patch("/sos/:id/status", authorize("sos:triage"), d.updateSosStatus);

DispatcherRouter.get("/alerts", authorize("alert:read"), d.listAlerts);
DispatcherRouter.post("/alerts/:id/approve", authorize("alert:decide"), d.approveAlert);
DispatcherRouter.post("/alerts/:id/reject", authorize("alert:decide"), d.rejectAlert);
DispatcherRouter.post("/alerts/:id/resolve", authorize("alert:decide"), d.resolveAlert);

DispatcherRouter.patch(
  "/brigades/:id/status",
  authorize("brigade:update", "brigade:update_own"),
  d.updateBrigadeStatus,
);
DispatcherRouter.get("/my-brigade", authorize("brigade:update_own"), d.getMyBrigade);

DispatcherRouter.patch("/shelters/:id", authorize("shelter:manage"), d.updateShelter);

export { DispatcherRouter };
