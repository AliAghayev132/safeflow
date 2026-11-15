import { asyncHandler } from "#utils";
import { AuditService } from "#services/AuditService.js";
import { PartnerClientService } from "../services/PartnerClientService.js";
import { PartnerTokenService } from "../services/PartnerTokenService.js";
import { MtlsService } from "../services/MtlsService.js";
import { grantScopes } from "../core/scopes.js";
import { oauthError, partnerActor } from "../middlewares/partnerAuth.js";

/** Credentials from HTTP Basic (preferred) or the request body. */
const readCredentials = (req) => {
  const header = req.headers.authorization ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
      const i = decoded.indexOf(":");
      if (i > 0) {
        return {
          clientId: decodeURIComponent(decoded.slice(0, i)),
          clientSecret: decodeURIComponent(decoded.slice(i + 1)),
          basic: true,
        };
      }
    } catch {
      return {};
    }
  }
  return { clientId: req.body?.client_id, clientSecret: req.body?.client_secret, basic: false };
};

/**
 * OAuth2 client credentials grant.
 * POST /api/partner/v1/oauth/token
 *   grant_type=client_credentials [&scope=space separated]
 *   (application/x-www-form-urlencoded or JSON; HTTP Basic or body creds)
 */
const token = asyncHandler(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");

  if (req.body?.grant_type !== "client_credentials") {
    return oauthError(res, 400, "unsupported_grant_type", "Only client_credentials is supported");
  }
  const { clientId, clientSecret, basic } = readCredentials(req);
  if (!clientId || !clientSecret) {
    return oauthError(res, 400, "invalid_request", "client_id and client_secret are required");
  }

  const client = await PartnerClientService.authenticate(clientId, clientSecret);
  const fail = (status, error, description) => {
    if (client) {
      AuditService.record({
        operator: partnerActor(client),
        action: "partner.token_denied",
        target: { type: "partner_client", id: client._id, label: client.name },
        details: { error },
        ip: req.ip,
      }).catch(() => null);
    }
    return oauthError(
      res,
      status,
      error,
      description,
      status === 401 && basic ? { "WWW-Authenticate": 'Basic realm="partner-api"' } : {},
    );
  };

  if (!client) return fail(401, "invalid_client", "Client authentication failed");
  if (client.status === "suspended") return fail(401, "invalid_client", "Client is suspended");
  if (!MtlsService.satisfies(client, req)) return fail(401, "invalid_client", "Client certificate (mTLS) required");

  const granted = grantScopes({ allowed: client.scopes, requested: req.body?.scope, status: client.status });
  if (granted.error) return fail(400, "invalid_scope", "Requested scope is not allowed for this client");

  const { token: accessToken, expiresIn } = PartnerTokenService.sign(client, granted.scopes);
  await AuditService.record({
    operator: partnerActor(client),
    action: "partner.token_issued",
    target: { type: "partner_client", id: client._id, label: client.name },
    details: { scopes: granted.scopes, mtls: client.requireMtls },
    ip: req.ip,
  });

  return res.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    scope: granted.scopes.join(" "),
  });
});

export { token };
