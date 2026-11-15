import { config } from "#config";
import { aiDefaults } from "./defaults.js";
import { StatusRouter, KeysRouter, VoiceRouter, DamageRouter, ForecastRouter, ChatRouter, SupplyPlanRouter } from "./routes.js";
import { ForecastService } from "./forecast/ForecastService.js";
import { SupplyPlanService } from "./supply/SupplyPlanService.js";
import { DamageAssessment } from "./damage/damageAssessment.model.js";
import { SecretStore } from "./providers/SecretStore.js";

/**
 * AI feature modules. Shared provider layer (providers/): LLM (Claude /
 * local gateway / mock), speech-to-text (Whisper / local / mock), vision
 * (YOLOv8 server / Claude / mock). Each capability has its own feature flag:
 *
 *   ai          → /api/ai/status          provider status (admin)
 *   aiVoiceSos  → /api/ai/voice-sos       voice SOS + NLP parser
 *   aiDamage    → /api/ai/damage          drone / photo damage assessment
 *   aiForecast  → /api/ai/forecast        crowd forecasting 15–30 min
 *   aiChatbot   → /api/ai/chat            citizen assistant (live-data RAG)
 *   aiSupply    → /api/ai/supply          supply distribution plan
 *
 * Latency: every request path is O(cache) or "store + queue"; model calls
 * run in the background, so endpoints stay well under 300 ms at load.
 */
const core = {
  name: "ai",
  feature: "ai",
  defaults: aiDefaults,
  routers: [
    { path: "/ai/status", router: StatusRouter },
    { path: "/ai/keys", router: KeysRouter },
  ],
  // Dashboard-entered provider keys (encrypted in MongoDB)
  init: () => SecretStore.load(),
};

const voice = { name: "aiVoiceSos", feature: "aiVoiceSos", routers: [{ path: "/ai/voice-sos", router: VoiceRouter }] };

const damage = {
  name: "aiDamage",
  feature: "aiDamage",
  routers: [{ path: "/ai/damage", router: DamageRouter }],
  reset: () => DamageAssessment.deleteMany({}),
};

const forecast = {
  name: "aiForecast",
  feature: "aiForecast",
  routers: [{ path: "/ai/forecast", router: ForecastRouter }],
  // Sampler follows the simulation ticker switch (off in tests → manual refresh)
  init: async () => {
    if (config.enableBrigadeTicker) ForecastService.start();
  },
  stop: async () => ForecastService.stop(),
  reset: async () => {
    ForecastService.reset();
    SupplyPlanService.reset();
  },
};

const chat = { name: "aiChatbot", feature: "aiChatbot", routers: [{ path: "/ai/chat", router: ChatRouter }] };

const supply = {
  name: "aiSupply",
  feature: "aiSupply",
  routers: [{ path: "/ai/supply", router: SupplyPlanRouter }],
};

export const aiModules = [core, voice, damage, forecast, chat, supply];
