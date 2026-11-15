import { dotenv } from "#lib";
import crisisDefaults from "./defaults/crisis.json" with { type: "json" };
import rbac from "./rbac.json" with { type: "json" };

const NODE_ENV = process.env.NODE_ENV || "development";

// Environment-specific file first (e.g. .env.test), then .env.
dotenv.config({ path: `.env.${NODE_ENV}`, quiet: true });
dotenv.config({ quiet: true });

const isProduction = NODE_ENV === "production";
const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Infrastructure configuration (env). Operational thresholds — cluster size,
 * windows, occupancy levels, triage / routing weights, rate limits — live in
 * `defaults/crisis.json` and can be changed at runtime through ConfigService
 * (persisted in MongoDB), never here.
 */
const config = {
  env: NODE_ENV,
  isProduction,
  isTest: NODE_ENV === "test",
  port: num(process.env.PORT, 5000),
  siteName: "Crisis Evacuation Engine",
  mongoUri:
    process.env.MONGODB_URI || "mongodb://localhost:27017/crisis_engine",

  clientUrls: {
    citizen: process.env.CITIZEN_CLIENT_URL || "http://localhost:5173",
    dispatcher: process.env.DISPATCHER_CLIENT_URL || "http://localhost:5174",
  },

  // Auth
  accessSecretKey:
    process.env.ACCESS_SECRET_KEY || "crisis_engine_dev_access_secret_key",
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "12h",

  // Operators created on first boot (dev/test accounts — override via env)
  defaultOperators: [
    {
      username: process.env.DEFAULT_ADMIN_USERNAME || "admin",
      password: process.env.DEFAULT_ADMIN_PASSWORD || "Admin123!",
      fullName: "Sistem Administratoru",
      role: "admin",
    },
    {
      username: process.env.DEFAULT_OPERATOR_USERNAME || "dispatcher",
      password: process.env.DEFAULT_OPERATOR_PASSWORD || "Dispatcher123!",
      fullName: "Növbətçi Dispetçer",
      role: "dispatcher",
    },
    {
      username: process.env.DEFAULT_BRIGADE_USERNAME || "brigade1",
      password: process.env.DEFAULT_BRIGADE_PASSWORD || "Brigade123!",
      fullName: "Xilasetmə dəstəsi №1 rəhbəri",
      role: "brigade_lead",
      brigadeCode: "XRX-01",
    },
    {
      username: process.env.DEFAULT_MANAGER_USERNAME || "manager1",
      password: process.env.DEFAULT_MANAGER_PASSWORD || "Manager123!",
      fullName: "Yasamal Mərkəzi Parkı məntəqə məsulu",
      role: "shelter_manager",
      shelterCode: "SH-06",
    },
  ],

  // External routing API (OSRM-compatible). Empty → provider is skipped.
  routing: {
    externalUrl: process.env.ROUTING_EXTERNAL_URL || "",
    externalProfile: process.env.ROUTING_EXTERNAL_PROFILE || "foot",
  },

  // Safe-share links
  safeShareTtlHours: num(process.env.SAFE_SHARE_TTL_HOURS, 48),
  publicCitizenUrl:
    process.env.PUBLIC_CITIZEN_URL ||
    process.env.CITIZEN_CLIENT_URL ||
    "http://localhost:5173",

  // Background jobs can be disabled for tests
  enableBrigadeTicker: process.env.ENABLE_BRIGADE_TICKER !== "false",
};

const corsConfig = {
  origin: [
    config.clientUrls.citizen,
    config.clientUrls.dispatcher,
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Authorization", "Content-Type", "X-Device-Id"],
  exposedHeaders: ["Retry-After", "RateLimit", "RateLimit-Policy"],
  credentials: true,
};

const securityConfig = {
  maxPayloadSize: "1mb",
};

export { config, corsConfig, securityConfig, crisisDefaults, rbac };
