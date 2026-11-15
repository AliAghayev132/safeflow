import { RbacService } from "#services";
import { VolunteerRouter } from "./routes/volunteerRoutes.js";
import { medicalSuggestionRule } from "./rules/medicalSuggestion.rule.js";
import { VolunteerService, RequestService } from "./services/index.js";
import { VolunteerProfile, VolunteerRequest } from "./models/index.js";

let expiryTimer = null;

/**
 * Professional volunteers network (feature flag `volunteers`).
 *
 *  - citizens register a profession (medical ones verified by an admin from
 *    uploaded documents), give explicit consent and toggle Ready / Not ready;
 *  - shelter managers / dispatchers request professionals for an assembly
 *    point: notified at that shelter first, then within a radius;
 *  - the first acceptances fill the request atomically, the rest are closed;
 *  - exact volunteer locations reach dispatchers only, and only after an
 *    accepted request.
 */
export default {
  name: "volunteers",
  feature: "volunteers",
  defaults: {
    radiusMeters: 3000,
    widenRadius: true,
    widenRadiusMeters: 6000,
    maxNotify: 30,
    requestTtlMinutes: 120,
    medicalSosRadiusMeters: 2000,
    maxDocumentBytes: 5242880,
    maxDocuments: 5,
    expiryCheckMs: 60000,
  },
  routers: [{ path: "/volunteers", router: VolunteerRouter }],
  rules: [medicalSuggestionRule],

  async init() {
    await VolunteerService.load();
    if (!this.resolverRegistered) {
      // Consented volunteer devices get the `volunteer` role (rbac.json)
      RbacService.registerDeviceRoleResolver((deviceId) => VolunteerService.resolveRole(deviceId));
      this.resolverRegistered = true;
    }
    clearInterval(expiryTimer);
    expiryTimer = setInterval(() => {
      RequestService.expire().catch((e) => console.error("Volunteer expiry:", e.message));
    }, 60000);
    expiryTimer.unref?.();
  },

  // Simulation reset: drop requests; shelter/zone ids are re-created by the seed
  async reset() {
    await VolunteerRequest.deleteMany({});
    await VolunteerProfile.updateMany({}, { $set: { currentShelter: null, zone: null } });
    await VolunteerService.load();
  },

  async stop() {
    clearInterval(expiryTimer);
  },
};
