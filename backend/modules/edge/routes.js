import { express, rateLimit, fs, path } from "#lib";
import { Router } from "#constants";
import { authenticate, authorize, rateLimitFor } from "#middlewares";
import { ConfigService } from "#services/ConfigService.js";
import { fail } from "#utils";
import { edgeEnv } from "./env.js";
import { EdgeRegistryService } from "./services/EdgeRegistryService.js";
import * as c from "./controllers.js";

// ============ MIDDLEWARE ============

/** Edge-node bearer token: `X-Edge-Token: edge_…` or `Authorization: Edge edge_…`. */
const edgeAuth = async (req, res, next) => {
  const header = req.headers.authorization ?? "";
  const token = req.headers["x-edge-token"] ?? (header.startsWith("Edge ") ? header.slice(5) : null);
  const node = await EdgeRegistryService.verify(token).catch(() => null);
  if (!node) return fail(res, "Edge node tokeni yanlışdır və ya ləğv edilib", 401, undefined, "EDGE_AUTH");
  req.edgeNode = node;
  next();
};

/** Central-only endpoints are meaningless on an edge node. */
const centralOnly = (_req, res, next) =>
  edgeEnv.mode ? fail(res, "Bu endpoint yalnız mərkəzi serverdədir", 409, undefined, "EDGE_MODE") : next();

/** Per-node rate limit (config edge.rateLimitPerMin). */
const nodeLimiter = rateLimit({
  windowMs: 60000,
  limit: () => ConfigService.get("edge").rateLimitPerMin,
  keyGenerator: (req) => `edge|${req.edgeNode?.nodeId ?? req.ip}`,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  handler: (_req, res) => {
    res.setHeader("Retry-After", "60");
    fail(res, "Sorğu limiti aşıldı", 429, undefined, "RATE_LIMITED");
  },
});

const asyncMw = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ============ /api/edge/v1 ============

const EdgeRouter = Router();
EdgeRouter.use(express.json({ limit: "5mb" }));

EdgeRouter.get("/info", ...rateLimitFor("citizen.read"), c.info);

// Node ↔ center
EdgeRouter.get("/ping", centralOnly, asyncMw(edgeAuth), nodeLimiter, c.ping);
EdgeRouter.post("/sync", centralOnly, asyncMw(edgeAuth), nodeLimiter, c.sync);
EdgeRouter.get("/snapshot", centralOnly, asyncMw(edgeAuth), nodeLimiter, c.snapshot);

// Admin (RBAC) — node registry on the center
EdgeRouter.get("/nodes", centralOnly, authenticate, authorize("edge:read"), c.listNodes);
EdgeRouter.post("/nodes", centralOnly, authenticate, authorize("edge:manage"), c.createNode);
EdgeRouter.post("/nodes/:id/rotate", centralOnly, authenticate, authorize("edge:manage"), c.rotateNode);
EdgeRouter.post("/nodes/:id/revoke", centralOnly, authenticate, authorize("edge:manage"), c.revokeNode);

// Local admin on the node itself
EdgeRouter.get("/local/status", authenticate, authorize("edge:read"), c.localStatus);
EdgeRouter.post("/local/sync-now", authenticate, authorize("edge:manage"), c.syncNow);

// ============ ROOT: captive portal + local app (edge mode only) ============

/**
 * Operating systems probe a well-known URL right after joining a Wi-Fi.
 * Any answer other than the expected one makes the OS open its captive
 * portal window — we redirect every probe to the locally served citizen app.
 * HTTPS cannot be intercepted, so this probe mechanism is the only way in.
 */
const CAPTIVE_PROBES = [
  "/generate_204", // Android / ChromeOS
  "/gen_204",
  "/hotspot-detect.html", // Apple
  "/library/test/success.html", // Apple (older)
  "/connecttest.txt", // Windows 10+
  "/ncsi.txt", // Windows (older)
  "/redirect", // Windows
  "/canonical.html", // Firefox
  "/success.txt", // Firefox
];

const CaptiveRouter = Router();

CaptiveRouter.use((req, res, next) => {
  if (!edgeEnv.mode) return next();
  if (CAPTIVE_PROBES.includes(req.path)) {
    res.setHeader("Cache-Control", "no-store");
    return res.redirect(302, edgeEnv.portalUrl ?? `http://${req.headers.host ?? "localhost"}/`);
  }
  next();
});

// Built citizen PWA (captive-portal landing page) with SPA fallback
const staticIndex = path.join(edgeEnv.staticDir, "index.html");
CaptiveRouter.use((req, res, next) => (edgeEnv.mode ? express.static(edgeEnv.staticDir, { index: false })(req, res, next) : next()));
CaptiveRouter.get(/^(?!\/api\/|\/socket\.io\/).*/, (req, res, next) => {
  if (!edgeEnv.mode || !req.accepts("html")) return next();
  if (!fs.existsSync(staticIndex)) {
    return res
      .status(503)
      .type("text/plain")
      .send("Citizen app is not built. Run: cd client-citizen && VITE_API_URL=same-origin npm run build");
  }
  res.setHeader("Cache-Control", "no-cache");
  return res.sendFile(staticIndex);
});

export { EdgeRouter, CaptiveRouter, CAPTIVE_PROBES };
