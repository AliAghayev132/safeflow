import { rateLimit } from "#lib";
import { crisisDefaults } from "#config";
import { isDeviceId } from "#utils";
import { ConfigService } from "#services/ConfigService.js";

/**
 * Rate limiting — separate limits per IP, per device and per user, chosen per
 * endpoint group (config: crisis.rateLimits, editable at runtime).
 * Blocked requests get `429` + `Retry-After` and a machine-readable code.
 *
 * SOS: genuine SOS is never rejected by normal use — repeated taps are merged
 * by SosService (not counted twice for clusters), and the per-device limit is
 * far above human behaviour; only floods hit it.
 */
const KEYS = {
  ip: (req) => `ip:${req.ip}`,
  device: (req) => {
    const id = req.body?.deviceId ?? req.query?.deviceId ?? req.headers["x-device-id"];
    return isDeviceId(id) ? `dev:${id}` : null;
  },
  user: (req) => (req.operator ? `usr:${req.operator._id}` : null),
};

const makeLimiter = (group, dimension) => {
  const windowMs = crisisDefaults.rateLimits[group]?.windowMs ?? 60000;
  return rateLimit({
    windowMs,
    // Read the live limit so admins can tighten/loosen without a restart
    limit: () => ConfigService.get("rateLimits")?.[group]?.[dimension] ?? 1000,
    keyGenerator: (req) => `${group}|${KEYS[dimension](req)}`,
    skip: (req) => !KEYS[dimension](req),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
    handler: (req, res, _next, options) => {
      const retryAfter = Math.ceil(options.windowMs / 1000);
      if (!res.getHeader("Retry-After")) res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        success: false,
        code: "RATE_LIMITED",
        message: "Sorğu limiti aşıldı. Bir az sonra yenidən cəhd edin.",
        limit: { group, dimension, retryAfterSec: Number(res.getHeader("Retry-After")) },
      });
    },
  });
};

/** Array of limiters for the dimensions configured on a group. */
const rateLimitFor = (group) => {
  const cfg = crisisDefaults.rateLimits[group] ?? {};
  return ["ip", "device", "user"].filter((d) => cfg[d] !== undefined).map((d) => makeLimiter(group, d));
};

/** Extra hardening headers (Helmet covers most). */
const securityHeaders = (req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.removeHeader("X-Powered-By");
  next();
};

export { rateLimitFor, securityHeaders };
