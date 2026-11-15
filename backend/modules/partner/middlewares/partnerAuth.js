import { rateLimit } from "#lib";
import { ConfigService } from "#services/ConfigService.js";
import { AuditService } from "#services/AuditService.js";
import { PartnerClient } from "../models/partnerClient.model.js";
import { PartnerTokenService } from "../services/PartnerTokenService.js";
import { MtlsService } from "../services/MtlsService.js";
import { hasScope, READ_SCOPES } from "../core/scopes.js";

/** OAuth2-style error body (RFC 6749 / RFC 6750). */
export const oauthError = (res, status, error, description, extraHeaders = {}) => {
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  return res.status(status).json({ error, error_description: description });
};

const LAST_SEEN_THROTTLE_MS = 60 * 1000;

/** Audit actor for a partner client (AuditLog.actor). */
export const partnerActor = (client) => ({
  _id: client._id,
  username: `partner:${client.clientId}`,
  role: "partner",
});

/**
 * Bearer partner token → req.partner = { client, scopes }.
 * Rejects: invalid/expired token, revoked token (tokenVersion bump on
 * rotate/suspend/scope change), suspended client, missing mTLS cert.
 * Every request is written to the audit log when the response finishes.
 */
export const partnerAuthenticate = async (req, res, next) => {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return oauthError(res, 401, "invalid_token", "Bearer token required", {
      "WWW-Authenticate": 'Bearer realm="partner-api"',
    });
  }

  let claims;
  try {
    claims = PartnerTokenService.verify(token);
  } catch {
    return oauthError(res, 401, "invalid_token", "Token invalid or expired", {
      "WWW-Authenticate": 'Bearer realm="partner-api", error="invalid_token"',
    });
  }

  const client = await PartnerClient.findById(claims.cid);
  if (!client || client.tokenVersion !== claims.ver) {
    return oauthError(res, 401, "invalid_token", "Token revoked", {
      "WWW-Authenticate": 'Bearer realm="partner-api", error="invalid_token"',
    });
  }
  if (client.status === "suspended") {
    return oauthError(res, 403, "access_denied", "Client is suspended");
  }
  if (!MtlsService.satisfies(client, req)) {
    return oauthError(res, 401, "invalid_client", "Client certificate (mTLS) required");
  }

  // Effective scopes = token ∩ current client scopes (∩ read-only if limited)
  let scopes = (claims.scp ?? []).filter((s) => client.scopes.includes(s));
  if (client.status === "limited") scopes = scopes.filter((s) => READ_SCOPES.includes(s));
  req.partner = { client, scopes };

  if (!client.lastSeenAt || Date.now() - client.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
    PartnerClient.updateOne({ _id: client._id }, { $set: { lastSeenAt: new Date() } }).catch(() => null);
  }

  // Audit: who, when, which endpoint / data, outcome
  res.on("finish", () => {
    AuditService.record({
      operator: partnerActor(client),
      action: "partner.request",
      target: { type: "partner_api", id: `${req.method} ${req.baseUrl}${req.route?.path ?? req.path}`, label: client.name },
      details: {
        method: req.method,
        path: req.originalUrl.split("?")[0],
        status: res.statusCode,
        scope: req.partnerScope ?? null,
        count: res.locals.partnerCount ?? null,
      },
      ip: req.ip,
    }).catch((e) => console.error("❌ [Partner audit] failed:", e.message));
  });

  next();
};

/** 403 insufficient_scope unless the token carries `scope`. */
export const requireScope = (scope) => (req, res, next) => {
  req.partnerScope = scope;
  if (!hasScope(req.partner?.scopes, scope)) {
    return oauthError(res, 403, "insufficient_scope", `Scope "${scope}" required`, {
      "WWW-Authenticate": `Bearer realm="partner-api", error="insufficient_scope", scope="${scope}"`,
    });
  }
  next();
};

/** Per-client rate limit (client.rateLimitPerMin; capped while "limited"). */
export const partnerRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: (req) => {
    const client = req.partner?.client;
    if (!client) return 1;
    if (client.status === "limited") {
      return Math.min(client.rateLimitPerMin, ConfigService.get("partner")?.limitedRateLimitPerMin ?? 20);
    }
    return client.rateLimitPerMin;
  },
  keyGenerator: (req) => `partner|${req.partner.client._id}`,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  handler: (req, res, _next, options) => {
    if (!res.getHeader("Retry-After")) res.setHeader("Retry-After", String(Math.ceil(options.windowMs / 1000)));
    oauthError(res, 429, "rate_limited", "Rate limit exceeded for this client");
  },
});

/** Token endpoint: per-IP limit against credential stuffing. */
export const tokenRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: () => ConfigService.get("partner")?.tokenRequestsPerMinPerIp ?? 60,
  keyGenerator: (req) => `partner-token|${req.ip}`,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  handler: (req, res, _next, options) => {
    if (!res.getHeader("Retry-After")) res.setHeader("Retry-After", String(Math.ceil(options.windowMs / 1000)));
    oauthError(res, 429, "rate_limited", "Too many token requests");
  },
});
