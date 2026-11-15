import { resolveProvider, aiConfig, endpoints } from "./settings.js";

/**
 * Speech-to-text. Providers:
 *   whisper → Whisper transcription API (OpenAI, or any compatible server
 *             with a key; STT_BASE_URL + STT_API_KEY / OPENAI_API_KEY)
 *   local   → self-hosted Whisper-compatible server (STT_BASE_URL, no key)
 *   mock    → uses the text the device already recognised (Web Speech) as
 *             `hint`, or a canned demo transcript
 * Never throws for provider problems — falls back to mock, marked mock: true.
 */
const DEMO_TRANSCRIPTS = {
  az: "Kömək edin! Binamız uçub, üçüncü mərtəbədə dağıntı altında dörd nəfərik, aramızda uşaq var. Yasamal, Şərifzadə küçəsi.",
  en: "Help! Our building collapsed, four of us are trapped under debris on the third floor, there is a child with us. Yasamal, Sharifzade street.",
  ru: "Помогите! Наш дом обрушился, нас четверо под завалами на третьем этаже, с нами ребёнок. Ясамал, улица Шарифзаде.",
};

class SttService {
  static async transcribe({ buffer, mimeType = "audio/webm", language = "az", hint = "" }) {
    const provider = resolveProvider("stt");
    const cfg = aiConfig("stt");
    const fallback = (reason) => ({
      text: hint?.trim() || DEMO_TRANSCRIPTS[language] || DEMO_TRANSCRIPTS.az,
      language,
      provider: "mock",
      mock: true,
      fallbackReason: reason,
      source: hint?.trim() ? "device_hint" : "demo",
    });
    if (provider === "mock" || !buffer?.length) return fallback(buffer?.length ? null : "no_audio");

    try {
      const form = new FormData();
      const ext = mimeType.split("/")[1]?.split(";")[0] || "webm";
      form.append("file", new Blob([buffer], { type: mimeType }), `sos.${ext}`);
      form.append("model", cfg.model ?? "whisper-1");
      if (language) form.append("language", language);
      const key = endpoints.sttKey();
      const res = await fetch(`${endpoints.stt()}/audio/transcriptions`, {
        method: "POST",
        headers: key ? { Authorization: `Bearer ${key}` } : {},
        body: form,
        signal: AbortSignal.timeout(cfg.timeoutMs ?? 30000),
      });
      if (!res.ok) throw new Error(`STT HTTP ${res.status}`);
      const body = await res.json();
      if (typeof body.text !== "string") throw new Error("STT: no text");
      return { text: body.text.trim(), language, provider, mock: false, source: "audio" };
    } catch (error) {
      console.error(`⚠️  [AI] transcription via ${provider} failed — using mock:`, error.message);
      return fallback("error");
    }
  }
}

export { SttService, DEMO_TRANSCRIPTS };
