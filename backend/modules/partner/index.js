import { partnerDefaults } from "./defaults.js";
import { PartnerApiRouter, PartnerAdminRouter } from "./routes/partnerRoutes.js";
import { PartnerRealtime } from "./services/PartnerRealtime.js";
import { PartnerRequest } from "./models/partnerRequest.model.js";

/**
 * Feature module: secure Partner API for other agencies (army, police,
 * ambulance, municipality). Flag: features.partnerApi.
 *
 *   /api/partner/v1/...     OAuth2 client credentials + scopes (+ mTLS)
 *   /api/partner/admin/...  client management & partner requests (staff RBAC)
 *   socket.io  /partner     scoped realtime channel (partner token)
 *   webhooks                HMAC-signed, retried with backoff
 */
export default {
  name: "partner",
  feature: "partnerApi",
  defaults: partnerDefaults,
  routers: [
    { path: "/partner/v1", router: PartnerApiRouter },
    { path: "/partner/admin", router: PartnerAdminRouter },
  ],
  init: async () => PartnerRealtime.init(),
  stop: async () => PartnerRealtime.stop(),
  // Simulation reset: incoming agency requests belong to the old scenario
  reset: async () => {
    await PartnerRequest.deleteMany({});
  },
};
