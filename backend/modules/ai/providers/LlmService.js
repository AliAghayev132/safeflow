import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { resolveProvider, aiConfig, endpoints } from "./settings.js";

let anthropicClient = null;
const anthropic = () => {
  // Resolves ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / ant profile from env
  anthropicClient ??= new Anthropic({ timeout: aiConfig("llm").timeoutMs ?? 20000, maxRetries: 1 });
  return anthropicClient;
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
  static async structured({ task, system, content, schema, mock }) {
    const provider = resolveProvider("llm");
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
