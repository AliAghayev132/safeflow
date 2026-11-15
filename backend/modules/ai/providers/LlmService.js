import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { resolveProvider, aiConfig, endpoints } from "./settings.js";

import { SecretStore } from "./SecretStore.js";

let anthropicClient = null;
const anthropic = () => {
  // Key from the dashboard secret store, else ANTHROPIC_API_KEY / AUTH_TOKEN from env
  const apiKey = endpoints.anthropicKey() || undefined;
  anthropicClient ??= new Anthropic({ ...(apiKey ? { apiKey } : {}), timeout: aiConfig("llm").timeoutMs ?? 20000, maxRetries: 1 });
  return anthropicClient;
};
// A new key entered in the dashboard → rebuild the client
SecretStore.onChange((name) => {
  if (name === "ANTHROPIC_API_KEY") anthropicClient = null;
});

// ---- Google Gemini (REST, key in a header — never in the URL) -------------
/** Claude-style content (string or blocks) → Gemini parts. */
const geminiParts = (content) =>
  (typeof content === "string" ? [{ type: "text", text: content }] : content).map((b) =>
    b.type === "image" ? { inline_data: { mime_type: b.source.media_type, data: b.source.data } } : { text: b.text },
  );

const gemini = async ({ system, contents, json }) => {
  const cfg = aiConfig("llm");
  const model = cfg.geminiModel ?? "gemini-2.5-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": endpoints.geminiKey() },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { maxOutputTokens: cfg.maxTokens ?? 2048, ...(json ? { responseMimeType: "application/json" } : {}) },
    }),
    signal: AbortSignal.timeout(cfg.timeoutMs ?? 20000),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const body = await res.json();
  const text = (body.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  return { text, model };
};

const localPost = async (path, body, timeoutMs) => {
  const res = await fetch(`${endpoints.localAi()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`local AI ${path} HTTP ${res.status}`);
  return res.json();
};

/** Text content of a Claude response (narrowed by block type). */
const textOf = (message) =>
  message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

/**
 * LLM access for the AI modules. Every call returns
 *   { data | text, provider, mock, model, fallbackReason? }
 * and NEVER throws for provider problems: a refusal, timeout or missing key
 * falls back to the caller's deterministic mock so the feature keeps working
 * (demo / offline), clearly marked `mock: true`.
 */
class LlmService {
  /**
   * Structured extraction into a Zod schema.
   * @param {object}   p
   * @param {string}   p.task     short task id (local gateway routing, logs)
   * @param {string}   p.system   system prompt
   * @param {Array|string} p.content user content (string or Claude content blocks)
   * @param {z.ZodType} p.schema  output schema
   * @param {Function} p.mock     () => data   deterministic fallback
   */
  static async structured({ task, system, content, schema, mock, provider: forced }) {
    const provider = forced ?? resolveProvider("llm");
    const cfg = aiConfig("llm");
    const fallback = (reason) => ({ data: mock(), provider: "mock", mock: true, model: null, fallbackReason: reason });

    try {
      if (provider === "anthropic") {
        const response = await anthropic().messages.parse({
          model: cfg.model ?? "claude-opus-5-5",
          max_tokens: cfg.maxTokens ?? 2048,
          output_config: { effort: cfg.effort ?? "low", format: zodOutputFormat(schema) },
          system,
          messages: [{ role: "user", content }],
        });
        if (response.stop_reason === "refusal") return fallback("refusal");
        if (!response.parsed_output) return fallback("unparseable");
        return { data: response.parsed_output, provider, mock: false, model: response.model };
      }
      if (provider === "gemini") {
        const r = await gemini({
          system: `${system}
Reply with ONE JSON object matching this JSON schema, no prose:
${JSON.stringify(z.toJSONSchema(schema))}`,
          contents: [{ role: "user", parts: geminiParts(content) }],
          json: true,
        });
        const parsed = schema.safeParse(JSON.parse(r.text.replace(/^```(json)?|```$/g, "")));
        if (!parsed.success) return fallback("gemini_invalid_output");
        return { data: parsed.data, provider, mock: false, model: r.model };
      }
      if (provider === "local") {
        const body = await localPost(
          "/v1/structured",
          { task, system, content, schema: z.toJSONSchema(schema) },
          cfg.timeoutMs ?? 20000,
        );
        const parsed = schema.safeParse(body.data ?? body);
        if (!parsed.success) return fallback("local_invalid_output");
        return { data: parsed.data, provider, mock: false, model: body.model ?? "local" };
      }
      return fallback(null);
    } catch (error) {
      console.error(`⚠️  [AI] ${task} via ${provider} failed — using mock:`, error.message);
      return fallback(error instanceof Anthropic.APIError ? `api_${error.status}` : "error");
    }
  }

  /**
   * Free-text answer (chatbot). `messages` are { role: "user"|"assistant", content }.
   */
  static async chat({ task, system, messages, mock }) {
    const provider = resolveProvider("llm");
    const cfg = aiConfig("llm");
    const fallback = (reason) => ({ text: mock(), provider: "mock", mock: true, model: null, fallbackReason: reason });

    try {
      if (provider === "anthropic") {
        const response = await anthropic().messages.create({
          model: cfg.model ?? "claude-opus-5-5",
          max_tokens: cfg.maxTokens ?? 2048,
          output_config: { effort: cfg.effort ?? "low" },
          system,
          messages,
        });
        if (response.stop_reason === "refusal") return fallback("refusal");
        return { text: textOf(response), provider, mock: false, model: response.model };
      }
      if (provider === "gemini") {
        const r = await gemini({
          system,
          contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        });
        if (!r.text) return fallback("gemini_empty");
        return { text: r.text, provider, mock: false, model: r.model };
      }
      if (provider === "local") {
        const body = await localPost("/v1/chat", { task, system, messages }, cfg.timeoutMs ?? 20000);
        if (typeof body.text !== "string") return fallback("local_invalid_output");
        return { text: body.text, provider, mock: false, model: body.model ?? "local" };
      }
      return fallback(null);
    } catch (error) {
      console.error(`⚠️  [AI] ${task} via ${provider} failed — using mock:`, error.message);
      return fallback(error instanceof Anthropic.APIError ? `api_${error.status}` : "error");
    }
  }
}

export { LlmService, z };
