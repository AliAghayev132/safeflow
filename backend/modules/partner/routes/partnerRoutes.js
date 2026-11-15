import { express } from "#lib";
import { Router } from "#constants";
import { authenticate, authorize, rateLimitFor } from "#middlewares";
import openapi from "../openapi.json" with { type: "json" };
import * as oauth from "../controllers/oauthController.js";
import * as data from "../controllers/partnerDataController.js";
import * as admin from "../controllers/partnerAdminController.js";
import {
  partnerAuthenticate,
  requireScope,
  partnerRateLimit,
  tokenRateLimit,
} from "../middlewares/partnerAuth.js";

/**
 * Partner API v1 — /api/partner/v1 (OAuth2 client credentials, scopes).
 * Errors use the OAuth2-style body { error, error_description }.
 */
const PartnerApiRouter = Router();

PartnerApiRouter.get("/openapi.json", (_req, res) => res.json(openapi));
PartnerApiRouter.post(
  "/oauth/token",
  tokenRateLimit,
  express.urlencoded({ extended: false, limit: "10kb" }),
  oauth.token,
);

PartnerApiRouter.use(partnerAuthenticate, partnerRateLimit);
PartnerApiRouter.get("/me", data.me);
PartnerApiRouter.get("/incidents", requireScope("incidents:read"), data.incidents);
PartnerApiRouter.get("/assembly-points", requireScope("assembly_points:read"), data.assemblyPoints);
PartnerApiRouter.get("/roads", requireScope("roads:read"), data.roads);
PartnerApiRouter.post("/requests", requireScope("requests:write"), data.createRequest);
PartnerApiRouter.get("/requests", requireScope("requests:write"), data.listRequests);
PartnerApiRouter.get("/requests/:id", requireScope("requests:write"), data.getRequest);

// Partner-style errors for this router
PartnerApiRouter.use((err, _req, res, _next) => {
  const status = err.statusCode && err.statusCode < 500 ? err.statusCode : err.name === "CastError" ? 400 : 500;
  if (status >= 500) console.error("Partner API error:", err);
  res.status(status).json({
    error: status >= 500 ? "server_error" : status === 404 ? "not_found" : "invalid_request",
    error_description: status >= 500 ? "Internal error" : err.message,
    code: err.code ?? undefined,
  });
});

/**
 * Admin / crisis-center side — /api/partner/admin (staff token + RBAC).
 * Client management needs partners:manage; partner requests are handled by
 * anyone who may decide alerts.
 */
const PartnerAdminRouter = Router();
PartnerAdminRouter.use(authenticate, ...rateLimitFor("operator"));

PartnerAdminRouter.get("/meta", authorize("partners:manage", "alert:decide"), admin.meta);
PartnerAdminRouter.get("/requests", authorize("partners:manage", "alert:decide"), admin.listRequests);
PartnerAdminRouter.patch("/requests/:id", authorize("partners:manage", "alert:decide"), admin.updateRequest);

PartnerAdminRouter.get("/clients", authorize("partners:manage"), admin.listClients);
PartnerAdminRouter.post("/clients", authorize("partners:manage"), admin.createClient);
PartnerAdminRouter.patch("/clients/:id", authorize("partners:manage"), admin.updateClient);
PartnerAdminRouter.post("/clients/:id/status", authorize("partners:manage"), admin.setStatus);
PartnerAdminRouter.post("/clients/:id/rotate-secret", authorize("partners:manage"), admin.rotateSecret);
PartnerAdminRouter.delete("/clients/:id", authorize("partners:manage"), admin.removeClient);
PartnerAdminRouter.post("/clients/:id/webhooks", authorize("partners:manage"), admin.addWebhook);
PartnerAdminRouter.delete("/clients/:id/webhooks/:webhookId", authorize("partners:manage"), admin.removeWebhook);
PartnerAdminRouter.get("/clients/:id/deliveries", authorize("partners:manage"), admin.deliveries);
PartnerAdminRouter.get("/clients/:id/activity", authorize("partners:manage"), admin.activity);

export { PartnerApiRouter, PartnerAdminRouter };
