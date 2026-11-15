import { express } from "#lib";
import { Router } from "#constants";
import { asyncHandler, ok, AppError, requireDeviceId, optionalCoords, requireCoords } from "#utils";
import { authenticate, authorize, identifyDevice, rateLimitFor } from "#middlewares";
import { ConfigService } from "#services/ConfigService.js";
import { providerStatus } from "./providers/settings.js";
import { SecretStore } from "./providers/SecretStore.js";
import { audit, decodeBase64 } from "./common.js";
import { VoiceSosService } from "./voice/VoiceSosService.js";
import { DamageService } from "./damage/DamageService.js";
import { ForecastService } from "./forecast/ForecastService.js";
import { ChatService } from "./chat/ChatService.js";
import { SupplyPlanService } from "./supply/SupplyPlanService.js";

const LANGS = ["az", "en", "ru"];
const lang = (v) => (LANGS.includes(v) ? v : "az");
const aiCfg = () => ConfigService.get("ai");
const citizen = [identifyDevice, ...rateLimitFor("ai.citizen")];
const staff = [authenticate, ...rateLimitFor("ai.operator")];

// ================================================================ status
/** GET /api/ai/status — providers per capability (no secrets) + flags. */
export const StatusRouter = Router();
StatusRouter.get(
  "/",
  ...staff,
  authorize("ai:status", "ai:forecast"),
  asyncHandler(async (_req, res) => {
    const features = ConfigService.features();
    return ok(res, {
      providers: providerStatus(),
      model: aiCfg().llm.model,
      features: Object.fromEntries(Object.entries(features).filter(([k]) => k === "ai" || k.startsWith("ai"))),
    });
  }),
);

// ================================================================ keys
/**
 * AI provider keys / URLs entered in the dashboard (encrypted at rest,
 * never returned — only "…last4"). PUT/DELETE need config:manage.
 */
export const KeysRouter = Router();
KeysRouter.use(...staff);
KeysRouter.get("/", authorize("ai:status"), asyncHandler(async (_req, res) => ok(res, { keys: SecretStore.list() })));
KeysRouter.put(
  "/:name",
  authorize("config:manage"),
  asyncHandler(async (req, res) => {
    await SecretStore.set(req.params.name, req.body?.value, req.operator);
    // The key itself is never written to the audit log
    await audit(req, "ai.key.set", { type: "ai_key", id: req.params.name, label: req.params.name });
    return ok(res, { keys: SecretStore.list(), providers: providerStatus() }, "Yadda saxlanıldı");
  }),
);
KeysRouter.delete(
  "/:name",
  authorize("config:manage"),
  asyncHandler(async (req, res) => {
    await SecretStore.remove(req.params.name);
    await audit(req, "ai.key.remove", { type: "ai_key", id: req.params.name, label: req.params.name });
    return ok(res, { keys: SecretStore.list(), providers: providerStatus() }, "Silindi");
  }),
);

// ================================================================ voice SOS
export const VoiceRouter = Router();

/**
 * POST /api/ai/voice-sos
 * { deviceId, clientId?, transcript?, audio? (base64 / data URL), mime?, lat?, lng?, language? }
 * The SOS is created immediately from the fast parse; models refine it later.
 */
VoiceRouter.post(
  "/",
  ...citizen,
  ...rateLimitFor("sos.create"),
  authorize("ai:voice_sos"),
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const deviceId = requireDeviceId(b.deviceId);
    const audio = b.audio ? decodeBase64(b.audio, aiCfg().stt.maxAudioBytes) : null;
    if (audio?.tooLarge) throw AppError.badRequest("Səs yazısı çox böyükdür", "AUDIO_TOO_LARGE");
    const result = await VoiceSosService.submit({
      deviceId,
      clientId: typeof b.clientId === "string" && b.clientId.length <= 64 ? b.clientId : undefined,
      transcript: typeof b.transcript === "string" ? b.transcript.slice(0, 2000) : "",
      origin: optionalCoords(b.lat, b.lng),
      audio: audio?.buffer ?? null,
      mime: b.mime ?? audio?.mime ?? null,
      language: lang(b.language),
      ip: req.ip,
    });
    // Not awaited: the SOS response must not wait for the audit write
    audit(req, "ai.voice_sos", { type: "sos", id: result.sos.id, label: result.sos.type }, {
      priority: result.parsed?.priority ?? null,
      enrichment: result.enrichment,
      audio: Boolean(audio),
    }).catch(() => null);
    return ok(res, result, "SOS göndərildi", result.duplicate ? 200 : 201, "VOICE_SOS_CREATED");
  }),
);

/** POST /api/ai/voice-sos/parse { text, deep? } — preview without sending. */
VoiceRouter.post(
  "/parse",
  ...citizen,
  authorize("ai:voice_sos"),
  asyncHandler(async (req, res) => {
    const text = String(req.body?.text ?? "").slice(0, 2000);
    if (!text.trim()) throw AppError.badRequest("Mətn tələb olunur", "TEXT_REQUIRED");
    if (req.body?.deep === true) {
      const r = await VoiceSosService.parseDeep(text);
      return ok(res, { parsed: r.data, provider: r.provider, mock: r.mock });
    }
    return ok(res, { parsed: VoiceSosService.parseFast(text), provider: "rules", mock: false });
  }),
);

// ================================================================ damage
export const DamageRouter = Router();
DamageRouter.use(...staff, authorize("ai:damage"));

DamageRouter.get(
  "/",
  asyncHandler(async (req, res) => ok(res, { assessments: await DamageService.list({ limit: Number(req.query.limit) || 100 }) })),
);

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * POST /api/ai/damage/assess?lat&lng&source&droneCode
 *   body: raw image (image/jpeg|png|webp, ≤ vision.maxImageBytes)
 *   or JSON { image: base64, lat, lng, source, droneCode }
 * Answers 202 with the queued job; the result arrives as `ai:damage`.
 */
DamageRouter.post(
  "/assess",
  express.raw({ type: IMAGE_TYPES, limit: "12mb" }),
  asyncHandler(async (req, res) => {
    const max = aiCfg().vision.maxImageBytes;
    let buffer;
    let mime = req.headers["content-type"]?.split(";")[0];
    const meta = Buffer.isBuffer(req.body) ? req.query : { ...req.query, ...(req.body ?? {}) };
    if (Buffer.isBuffer(req.body)) buffer = req.body;
    else {
      const img = decodeBase64(req.body?.image, max);
      if (img?.tooLarge) throw AppError.badRequest("Şəkil çox böyükdür", "IMAGE_TOO_LARGE");
      buffer = img?.buffer;
      mime = img?.mime ?? "image/jpeg";
    }
    if (!buffer?.length) throw AppError.badRequest("Şəkil tələb olunur", "IMAGE_REQUIRED");
    if (buffer.length > max) throw AppError.badRequest("Şəkil çox böyükdür", "IMAGE_TOO_LARGE");
    if (!IMAGE_TYPES.includes(mime)) throw AppError.badRequest("Dəstəklənməyən şəkil formatı", "IMAGE_TYPE");
    const { lat, lng } = requireCoords(Number(meta.lat), Number(meta.lng));
    const source = ["drone", "citizen", "operator"].includes(meta.source) ? meta.source : "operator";
    const doc = await DamageService.submit({
      buffer,
      mime,
      lat,
      lng,
      source,
      droneCode: typeof meta.droneCode === "string" ? meta.droneCode.slice(0, 32) : null,
      operator: req.operator,
    });
    await audit(req, "ai.damage.assess", { type: "damage", id: doc._id, label: source }, { bytes: buffer.length });
    return ok(res, { assessment: doc.toPublic() }, "Şəkil analizə göndərildi", 202, "DAMAGE_QUEUED");
  }),
);

/** POST /api/ai/damage/survey { zoneCode | lat,lng, frames } — simulated drone survey. */
DamageRouter.post(
  "/survey",
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const docs = await DamageService.droneSurvey({
      zoneCode: b.zoneCode,
      lat: Number(b.lat),
      lng: Number(b.lng),
      frames: Number(b.frames) || 6,
      droneCode: typeof b.droneCode === "string" ? b.droneCode.slice(0, 32) : undefined,
      operator: req.operator,
    });
    await audit(req, "ai.damage.survey", { type: "zone", id: b.zoneCode ?? null, label: b.zoneCode ?? "point" }, { frames: docs.length });
    return ok(res, { assessments: docs.map((d) => d.toPublic()) }, "Dron kəşfiyyatı başladı", 202, "SURVEY_STARTED");
  }),
);

/** POST /api/ai/damage/:id/approve — dispatcher applies an AI proposal to the map. */
DamageRouter.post(
  "/:id/approve",
  asyncHandler(async (req, res) => {
    const doc = await DamageService.approve(req.params.id);
    await audit(req, "ai.damage.approve", { type: "damage", id: doc._id, label: doc.severity }, { edges: doc.applied.map((a) => a.edgeId), confidence: doc.confidence });
    return ok(res, { assessment: doc.toPublic() });
  }),
);

/** POST /api/ai/damage/:id/revert — undo road changes of a false positive. */
DamageRouter.post(
  "/:id/revert",
  asyncHandler(async (req, res) => {
    const doc = await DamageService.revert(req.params.id);
    await audit(req, "ai.damage.revert", { type: "damage", id: doc._id }, { edges: doc.applied.map((a) => a.edgeId) });
    return ok(res, { assessment: doc.toPublic() });
  }),
);

// ================================================================ forecast
export const ForecastRouter = Router();
ForecastRouter.use(...staff, authorize("ai:forecast"));
ForecastRouter.get("/", asyncHandler(async (_req, res) => ok(res, { forecast: await ForecastService.get() })));
ForecastRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const forecast = await ForecastService.tick();
    await audit(req, "ai.forecast.refresh", { type: "forecast" }, { warnings: forecast.warnings.length });
    return ok(res, { forecast });
  }),
);

// ================================================================ chatbot
export const ChatRouter = Router();

/** POST /api/ai/chat { deviceId, message, history?, lat?, lng?, language? } */
ChatRouter.post(
  "/",
  ...citizen,
  authorize("ai:chat"),
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const deviceId = requireDeviceId(b.deviceId);
    const message = String(b.message ?? "").trim().slice(0, 1000);
    if (!message) throw AppError.badRequest("Sual boşdur", "MESSAGE_REQUIRED");
    const result = await ChatService.ask({
      deviceId,
      message,
      history: Array.isArray(b.history) ? b.history.slice(-20) : [],
      origin: optionalCoords(b.lat, b.lng),
      language: lang(b.language),
    });
    // Privacy: the question itself is not stored, only what it was about.
    // Not awaited: the answer must not wait for the audit write.
    audit(req, "ai.chat", { type: "chat", id: result.id }, { intents: result.intents, refining: result.refining }).catch(() => null);
    return ok(res, result);
  }),
);

// ================================================================ supply plan
export const SupplyPlanRouter = Router();
SupplyPlanRouter.use(...staff, authorize("ai:supply"));
SupplyPlanRouter.get("/plan", asyncHandler(async (_req, res) => ok(res, { plan: await SupplyPlanService.get() })));
SupplyPlanRouter.post(
  "/plan/refresh",
  asyncHandler(async (_req, res) => {
    await ForecastService.tick();
    return ok(res, { plan: await SupplyPlanService.compute() });
  }),
);
SupplyPlanRouter.post(
  "/plan/apply",
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body?.shelterIds) ? req.body.shelterIds.filter((x) => typeof x === "string").slice(0, 100) : null;
    const created = await SupplyPlanService.apply({ shelterIds: ids, operator: req.operator });
    await audit(req, "ai.supply.apply", { type: "supply_plan" }, { requests: created.length, shelters: created.map((r) => r.shelter) });
    return ok(res, { requests: created }, `${created.length} təchizat sorğusu yaradıldı`, 201, "SUPPLY_PLAN_APPLIED");
  }),
);
