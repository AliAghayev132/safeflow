import { Router } from "#constants";
import { citizenController as c } from "#controllers";
import { identifyDevice, authorize, rateLimitFor, recordLatency } from "#middlewares";

/**
 * Module 1 — Citizen safety API. No account: the device id is the identity
 * (citizen role from config/rbac.json). Optional endpoints never block SOS.
 */
const CitizenRouter = Router();
CitizenRouter.use(identifyDevice);

const read = rateLimitFor("citizen.read");
const write = rateLimitFor("citizen.write");

CitizenRouter.get("/zones", ...read, c.listZones);
CitizenRouter.get("/shelters", ...read, c.listShelters);
CitizenRouter.get("/evacuation", ...read, c.getEvacuationPlan);
CitizenRouter.get("/state", ...read, c.getState);
CitizenRouter.get("/roads", ...read, c.getRoads);

CitizenRouter.post("/sos", recordLatency("sos"), ...rateLimitFor("sos.create"), authorize("sos:create"), c.sendSos);
CitizenRouter.patch("/sos/:clientId", ...write, authorize("sos:create"), c.updateSosDetails);
CitizenRouter.patch("/status", ...write, c.updateStatus);
CitizenRouter.post("/checkin", ...write, c.checkIn);
CitizenRouter.post("/safe-share", ...write, c.createSafeShare);

CitizenRouter.get("/profile", ...read, authorize("profile:manage_own"), c.getProfile);
CitizenRouter.put("/profile", ...write, authorize("profile:manage_own"), c.saveProfile);
CitizenRouter.delete("/profile", ...write, authorize("profile:manage_own"), c.deleteProfile);

/** Public, unauthenticated pages (safe-share links for family members). */
const PublicRouter = Router();
PublicRouter.get("/safe/:token", ...rateLimitFor("citizen.read"), c.getSafeShare);

export { CitizenRouter, PublicRouter };
