import { rateLimit } from "#lib";
import { Router } from "#constants";
import { identifyDevice, rateLimitFor } from "#middlewares";
import { ConfigService } from "#services/ConfigService.js";
import * as a from "../controllers/accessibilityController.js";
import defaults from "../defaults.js";

/**
 * Per-token limit for shortcut SOS (config: accessibility.shortcutRateLimit).
 * Siri / Assistant retries are merged by the idempotency key; this only stops
 * a leaked token from being used to flood.
 */
const perToken = rateLimit({
  windowMs: defaults.shortcutRateLimit.windowMs,
  limit: () => ConfigService.get("accessibility")?.shortcutRateLimit?.perToken ?? defaults.shortcutRateLimit.perToken,
  keyGenerator: (req) => `a11y-token|${req.shortcut.prefix}|${req.shortcut.deviceId}`,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  handler: (_req, res, _next, options) => {
    if (!res.getHeader("Retry-After")) res.setHeader("Retry-After", String(Math.ceil(options.windowMs / 1000)));
    res.status(429).json({ success: false, code: "RATE_LIMITED", message: "Sorğu limiti aşıldı. Bir az sonra yenidən cəhd edin." });
  },
});

const A11yRouter = Router();

// Device-authenticated token management
A11yRouter.get("/shortcut-token", identifyDevice, ...rateLimitFor("citizen.read"), a.tokenStatus);
A11yRouter.post("/shortcut-token", identifyDevice, ...rateLimitFor("citizen.write"), a.issueToken);
A11yRouter.delete("/shortcut-token", identifyDevice, ...rateLimitFor("citizen.write"), a.revokeToken);

// Token-authenticated one-call SOS (shortcuts, voice assistants)
A11yRouter.post("/sos", ...rateLimitFor("sos.create"), a.authenticateShortcut, perToken, a.shortcutSos);

export { A11yRouter };
