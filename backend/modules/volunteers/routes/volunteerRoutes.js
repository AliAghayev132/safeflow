import { express } from "#lib";
import { Router } from "#constants";
import { identifyDevice, authenticate, authorize, rateLimitFor } from "#middlewares";
import { DOCUMENT_TYPES } from "../constants.js";
import * as c from "../controllers/volunteerController.js";

/**
 * /api/volunteers — gated by features.volunteers (module registry).
 *
 * Device routes (citizen / volunteer principal from the device id) and staff
 * routes (operator token) live side by side; permissions come from
 * config/rbac.json only.
 */
const VolunteerRouter = Router();

const device = [identifyDevice];
const read = rateLimitFor("citizen.read");
const write = rateLimitFor("citizen.write");
const staff = [authenticate, ...rateLimitFor("operator")];

// ---- Volunteer (device) ----
VolunteerRouter.get("/me", ...device, ...read, authorize("volunteer:register"), c.getMe);
VolunteerRouter.put("/me", ...device, ...write, authorize("volunteer:register"), c.saveMe);
VolunteerRouter.post("/me/withdraw", ...device, ...write, authorize("volunteer:register"), c.withdraw);
VolunteerRouter.patch("/me/availability", ...device, ...write, authorize("volunteer:status"), c.setAvailability);
VolunteerRouter.post("/me/location", ...device, ...write, authorize("volunteer:status"), c.updateLocation);
VolunteerRouter.post(
  "/me/documents",
  // Size is checked precisely in the service (413); this is a hard cap
  express.raw({ type: Object.keys(DOCUMENT_TYPES), limit: "20mb" }),
  ...device,
  ...write,
  authorize("volunteer:register"),
  c.uploadDocument,
);
VolunteerRouter.get("/me/requests", ...device, ...read, authorize("volunteer:respond"), c.myRequests);
VolunteerRouter.post("/requests/:id/accept", ...device, ...write, authorize("volunteer:respond"), c.accept);
VolunteerRouter.post("/requests/:id/decline", ...device, ...write, authorize("volunteer:respond"), c.decline);

// ---- Staff ----
VolunteerRouter.get("/requests", ...staff, authorize("volunteers:read", "volunteers:request"), c.listRequests);
VolunteerRouter.post("/requests", ...staff, authorize("volunteers:request"), c.createRequest);
VolunteerRouter.post("/requests/:id/cancel", ...staff, authorize("volunteers:request"), c.cancelRequest);
VolunteerRouter.post("/medical-sos/:sosId", ...staff, authorize("volunteers:notify_medical"), c.notifyMedicalSos);
VolunteerRouter.get("/verification", ...staff, authorize("volunteers:verify"), c.verificationQueue);
VolunteerRouter.post("/:id/verify", ...staff, authorize("volunteers:verify"), c.verify);
VolunteerRouter.get("/:id/documents/:docId", ...staff, authorize("volunteers:verify"), c.downloadDocument);
VolunteerRouter.get("/", ...staff, authorize("volunteers:read"), c.list);

export { VolunteerRouter };
