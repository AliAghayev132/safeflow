// ============ EXTERNAL PACKAGES ============
import { http, cors, helmet, express, compression } from "#lib";
import { pathToFileURL } from "node:url";

// ============ INTERNAL IMPORTS ============
import { config, corsConfig, securityConfig } from "#config";

// Services
import {
  socketService,
  mongoDBService,
  routingService,
  ruleEngine,
  RealtimeService,
  BrigadeService,
  ConfigService,
  ScenarioService,
  EventLogService,
  RouteService,
  ZoneService,
  ShelterService,
  bootstrap,
} from "#services";

// Rules
import { rules } from "#rules";

// Feature modules (drones, edge node, partner API, volunteers, ...)
import { modules } from "#modules";

// Module config sections must exist before ConfigService.load()
for (const mod of modules) {
  if (mod.defaults) ConfigService.registerDefaults(mod.name, mod.defaults);
}

// Middlewares
import { rateLimitFor, securityHeaders, sanitizeInput, requireFeature } from "#middlewares";

// Routes
import {
  AuthRouter,
  CitizenRouter,
  PublicRouter,
  RoadRouter,
  DispatcherRouter,
  SimulationRouter,
  AdminRouter,
  EventRouter,
} from "#routes";

// ============ SETUP FUNCTIONS ============

const setupSecurity = (app) => {
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(securityHeaders);
};

const setupMiddlewares = (app) => {
  app.use(compression());
  app.use(cors(corsConfig));
  app.use(express.json({ limit: securityConfig.maxPayloadSize }));
  app.use(sanitizeInput);
  app.use("/api", ...rateLimitFor("default"));
};

const setupRoutes = (app) => {
  app.use("/api/auth", AuthRouter);
  app.use("/api/citizen", CitizenRouter); // Module 1
  app.use("/api/public", PublicRouter);
  app.use("/api/roads", RoadRouter);
  app.use("/api/events", EventRouter); // realtime polling fallback
  app.use("/api/dispatcher", DispatcherRouter); // Module 2
  app.use("/api/simulation", SimulationRouter);
  app.use("/api/admin", AdminRouter);

  // Feature modules — each router is gated by its runtime feature flag
  for (const mod of modules) {
    for (const { path, router } of mod.routers ?? []) {
      app.use(`/api${path}`, requireFeature(mod.feature), router);
    }
  }

  // Public feature-flag map (clients hide disabled features)
  app.get("/api/features", (_req, res) => {
    res.json({ success: true, data: { features: ConfigService.features() } });
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      success: true,
      message: "Server is running",
      rules: ruleEngine.list().map((r) => r.id),
      routing: RouteService.status().providers,
      realtime: { epoch: EventLogService.epoch, lastSeq: EventLogService.lastSeq },
      timestamp: new Date().toISOString(),
    });
  });
};

const setupErrorHandlers = (app) => {
  app.use((_req, res) => {
    res.status(404).json({ success: false, code: "NOT_FOUND", message: "Endpoint tapılmadı" });
  });

  app.use((err, _req, res, _next) => {
    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Validasiya xətası",
        errors: Object.values(err.errors).map((e) => e.message),
      });
    }
    if (err.name === "CastError") {
      return res.status(400).json({ success: false, code: "INVALID_ID", message: "Yanlış identifikator" });
    }
    if (err.code === 11000) {
      return res.status(409).json({ success: false, code: "DUPLICATE", message: "Bu qeyd artıq mövcuddur" });
    }
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ success: false, code: "INVALID_JSON", message: "Yanlış JSON" });
    }

    const statusCode = err.statusCode || 500;
    if (statusCode >= 500) console.error("Server error:", err);
    res.status(statusCode).json({
      success: false,
      code: statusCode >= 500 ? "SERVER_ERROR" : (err.code ?? "ERROR"),
      message: statusCode >= 500 ? "Server xətası" : err.message,
    });
  });
};

const validateEnv = () => {
  if (!config.isProduction) return;
  if (!process.env.ACCESS_SECRET_KEY || process.env.ACCESS_SECRET_KEY.startsWith("change_me")) {
    console.error("❌ CRITICAL: ACCESS_SECRET_KEY must be set in production");
    process.exit(1);
  }
};

const createApp = () => {
  const app = express();
  app.set("trust proxy", 1);
  setupSecurity(app);
  setupMiddlewares(app);
  setupRoutes(app);
  setupErrorHandlers(app);
  return app;
};

// ============ LIFECYCLE ============

let httpServer = null;
let brigadeTicker = null;
let initialized = false;

/**
 * Start the API. Exported so integration tests can boot a real server
 * (port 0) against a test database.
 */
const startApp = async ({ port = config.port } = {}) => {
  validateEnv();
  await mongoDBService.connect();
  await ConfigService.load();
  await bootstrap();
  // In-memory read models (small, rarely changing data on the hot path)
  await Promise.all([
    routingService.load(),
    ZoneService.load(),
    ShelterService.load(),
    BrigadeService.load(),
  ]);

  if (!initialized) {
    RealtimeService.init();
    ruleEngine.registerAll(rules);
    // Module rules carry their feature flag (skipped while disabled)
    for (const mod of modules) {
      for (const rule of mod.rules ?? []) ruleEngine.register({ feature: mod.feature, ...rule });
    }
    initialized = true;
  }
  for (const mod of modules) await mod.init?.({ config });

  if (config.enableBrigadeTicker) {
    brigadeTicker = setInterval(() => {
      BrigadeService.tick().catch((e) => console.error("Brigade tick:", e.message));
    }, ConfigService.get("brigade").tickMs);
  }

  const app = createApp();
  httpServer = http.createServer(app);
  socketService.init(httpServer);

  // Large accept backlog: bursts of SOS must queue, not be refused
  await new Promise((resolve) => httpServer.listen({ port, backlog: 4096 }, resolve));
  const actualPort = httpServer.address().port;
  if (!config.isTest) {
    console.log(`
  ┌───────────────────────────────────────────────┐
  │  ${config.siteName}
  │  API    → http://localhost:${actualPort}/api
  │  Env    → ${config.env}
  │  Rules  → ${ruleEngine.list().map((r) => r.id).join(", ")}
  │  Roles  → config/rbac.json · Thresholds → admin config
  └───────────────────────────────────────────────┘`);
  }
  return { app, server: httpServer, port: actualPort };
};

const stopApp = async () => {
  clearInterval(brigadeTicker);
  ScenarioService.stop();
  for (const mod of modules) await mod.stop?.();
  await socketService.close();
  if (httpServer?.listening) await new Promise((resolve) => httpServer.close(resolve));
  await mongoDBService.disconnect();
};

export { createApp, startApp, stopApp };

// ============ ENTRY POINT ============
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  startApp().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });

  const shutdown = async (signal) => {
    console.log(`\n⚠️  ${signal} received. Shutting down...`);
    setTimeout(() => process.exit(1), 10000).unref();
    await stopApp();
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
