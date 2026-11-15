import { ConfigService } from "#services/ConfigService.js";
import { SecretStore } from "./SecretStore.js";

/**
 * AI provider resolution.
 *
 * Secrets / endpoints come from env (never stored in the DB config):
 *   ANTHROPIC_API_KEY     → Claude (LLM parser, chatbot, vision fallback)
 *   AI_LOCAL_URL          → self-hosted AI gateway (local LLM / pipelines)
 *   STT_BASE_URL          → Whisper-compatible transcription server
 *                           (OpenAI API or a local faster-whisper server)
 *   STT_API_KEY / OPENAI_API_KEY → key for the transcription endpoint
 *   VISION_YOLO_URL       → YOLOv8 inference server (damage model)
 *
 * The provider per capability is chosen in the admin config (section `ai`):
 *   "auto" → first configured real provider, otherwise "mock"
 *   "mock" → always mock (demo / offline)
 *   explicit name → that provider (falls back to mock if not configured)
 */
// Dashboard-entered secrets override .env (SecretStore)
const env = (k) => SecretStore.get(k);

export const AVAILABLE = {
  llm: {
    anthropic: () => Boolean(env("ANTHROPIC_API_KEY") || env("ANTHROPIC_AUTH_TOKEN")),
    gemini: () => Boolean(env("GEMINI_API_KEY")),
    local: () => Boolean(env("AI_LOCAL_URL")),
  },
  stt: {
    whisper: () => Boolean(env("STT_API_KEY") || env("OPENAI_API_KEY")),
    local: () => Boolean(env("STT_BASE_URL")) && !env("STT_API_KEY") && !env("OPENAI_API_KEY"),
  },
  vision: {
    yolo: () => Boolean(env("VISION_YOLO_URL")),
    anthropic: () => Boolean(env("ANTHROPIC_API_KEY") || env("ANTHROPIC_AUTH_TOKEN")),
    gemini: () => Boolean(env("GEMINI_API_KEY")),
  },
};

/** Effective provider name for a capability ("mock" when nothing is configured). */
export const resolveProvider = (capability) => {
  const wanted = ConfigService.get("ai")?.[capability]?.provider ?? "auto";
  const options = AVAILABLE[capability];
  if (wanted === "mock") return "mock";
  if (wanted !== "auto") return options[wanted]?.() ? wanted : "mock";
  return Object.keys(options).find((name) => options[name]()) ?? "mock";
};

export const aiConfig = (capability) => ConfigService.get("ai")?.[capability] ?? {};

export const endpoints = {
  localAi: () => env("AI_LOCAL_URL").replace(/\/$/, ""),
  stt: () => (env("STT_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, ""),
  sttKey: () => env("STT_API_KEY") || env("OPENAI_API_KEY"),
  yolo: () => env("VISION_YOLO_URL").replace(/\/$/, ""),
  anthropicKey: () => env("ANTHROPIC_API_KEY"),
  geminiKey: () => env("GEMINI_API_KEY"),
};

/** Status for the admin panel (no secrets). */
export const providerStatus = () =>
  Object.fromEntries(
    Object.entries(AVAILABLE).map(([capability, options]) => [
      capability,
      {
        configured: ConfigService.get("ai")?.[capability]?.provider ?? "auto",
        active: resolveProvider(capability),
        available: Object.fromEntries(Object.entries(options).map(([n, fn]) => [n, fn()])),
      },
    ]),
  );
