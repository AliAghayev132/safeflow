import { Router } from "#constants";
import { adminController as a } from "#controllers";
import { authenticate, authorize, rateLimitFor } from "#middlewares";

/** Config rules engine, audit log, RBAC and system status. */
const AdminRouter = Router();
AdminRouter.use(authenticate, ...rateLimitFor("operator"));

AdminRouter.get("/config", authorize("config:read"), a.getConfig);
AdminRouter.patch("/config", authorize("config:manage"), a.updateConfig);
AdminRouter.post("/config/reset", authorize("config:manage"), a.resetConfig);

AdminRouter.get("/audit", authorize("audit:read"), a.listAudit);
AdminRouter.get("/roles", authorize("config:read"), a.listRoles);
AdminRouter.get("/operators", authorize("operator:read"), a.listOperators);
AdminRouter.get("/system", authorize("config:read"), a.getSystem);

export { AdminRouter };
