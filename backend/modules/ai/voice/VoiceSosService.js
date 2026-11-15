import { crypto } from "#lib";
import { AppError, fromPoint } from "#utils";
import { SosService } from "#services/SosService.js";
import { ZoneService } from "#services/ZoneService.js";
import { ConfigService } from "#services/ConfigService.js";
import { LlmService, z } from "../providers/LlmService.js";
import { SttService } from "../providers/SttService.js";
import { resolveProvider } from "../providers/settings.js";
import { AI_EVENTS, background, publishToDevice } from "../common.js";
import { parseEmergencyText, toSosDetails } from "./parser.js";

const HAZARDS = ["fire", "collapse", "flood", "medical", "general"];
const NEEDS = ["medical_aid", "water", "rescue_trapped", "shelter", "evacuation", "food", "power"];

/** LLM output schema — same shape as the rule-based parser. */
export const EmergencySchema = z.object({
  hazardType: z.enum(HAZARDS),
  peopleCount: z.number().int().nullable(),
  priority: z.enum(["critical", "high", "medium", "low"]),
  injuries: z.boolean(),
  trapped: z.boolean(),
  vulnerable: z.object({ child: z.boolean(), elderly: z.boolean(), disabled: z.boolean() }),
  needs: z.array(z.enum(NEEDS)),
  location: z.object({
    text: z.string().nullable(),
    zoneCode: z.string().nullable(),
    floor: z.number().int().nullable(),
  }),
  summary: z.string(),
});

const SYSTEM = (zones) =>
  "You turn a panicked emergency call transcript (Azerbaijani, Russian or English) into a structured report for a " +
  "Baku crisis dispatcher. Extract only what is said; use null when unknown, never invent people counts or places. " +
  "priority: critical = life-threatening now (not breathing, trapped with children/elderly, heavy bleeding), " +
  "high = trapped / injured / vulnerable people, medium = danger without injuries, low = information only. " +
  `location.zoneCode must be one of: ${zones.map((z) => `${z.code} (${z.name})`).join(", ")} or null. ` +
  "summary: one short sentence in Azerbaijani for the dispatcher.";

const zonesForPrompt = () => ZoneService.list().map((z) => ({ code: z.code, name: z.name }));

const zoneCenter = (code) => {
  const zone = code ? ZoneService.findByCode(code) : null;
  return zone ? fromPoint(zone.center) : null;
};

const snapshot = (parsed, meta) => ({
  priority: parsed.priority,
  summary: parsed.summary,
  hazardType: parsed.hazardType,
  location: parsed.location,
  trapped: parsed.trapped,
  provider: meta.provider,
  mock: meta.mock,
  stage: meta.stage, // "fast" (rules, instant) | "enriched" (STT + LLM)
  at: new Date(),
});

/**
 * Voice SOS pipeline.
 *
 *  1. FAST PATH (inside the request, < 50 ms): rule-based parse of the text the
 *     device already recognised → the SOS is created immediately. An SOS never
 *     waits for a model.
 *  2. ENRICHMENT (background): Whisper transcription of the audio (if sent and
 *     configured) + LLM structured extraction → SOS details refined in place,
 *     the device gets an `ai:voice` event, dispatchers a normal sos:updated.
 */
class VoiceSosService {
  static parseFast(text) {
    return parseEmergencyText(text, zonesForPrompt());
  }

  /** Structured LLM parse (falls back to the rules; never throws). */
  static async parseDeep(text) {
    const zones = zonesForPrompt();
    const result = await LlmService.structured({
      task: "voice_sos_parse",
      system: SYSTEM(zones),
      content: `Transcript:\n"""${String(text).slice(0, 4000)}"""`,
      schema: EmergencySchema,
      mock: () => parseEmergencyText(text, zones),
    });
    // Keep only known zone codes
    if (result.data.location?.zoneCode && !ZoneService.findByCode(result.data.location.zoneCode)) {
      result.data.location.zoneCode = null;
    }
    return result;
  }

  static async submit({ deviceId, clientId, transcript, origin, audio, mime, language = "az", ip }) {
    const text = String(transcript ?? "").trim();
    if (!text && !audio) throw AppError.badRequest("Səs yazısı və ya mətn tələb olunur", "VOICE_EMPTY");

    const fast = text ? VoiceSosService.parseFast(text) : null;
    const place = origin ?? zoneCenter(fast?.location?.zoneCode);
    if (!place) throw AppError.badRequest("Mövqe tələb olunur (GPS və ya rayon adı)", "LOCATION_REQUIRED");

    const id = clientId ?? crypto.randomUUID();
    const details = fast
      ? toSosDetails(fast, text)
      : { transcript: "(səs yazısı emal olunur…)" };
    const result = await SosService.create({
      clientId: id,
      deviceId,
      type: fast?.hazardType ?? "general",
      origin: place,
      ip,
      details,
      ai: fast ? snapshot(fast, { provider: "rules", mock: false, stage: "fast" }) : null,
    });

    const willEnrich = Boolean(audio && resolveProvider("stt") !== "mock") || resolveProvider("llm") !== "mock";
    if (willEnrich && ConfigService.get("ai")?.voice?.autoSend !== false) {
      background("voice enrichment", () => VoiceSosService.#enrich({ deviceId, clientId: id, text, audio, mime, language }));
    }

    return {
      sos: result.sos,
      duplicate: result.duplicate,
      parsed: fast,
      enrichment: willEnrich ? "pending" : "none",
      providers: { stt: resolveProvider("stt"), llm: resolveProvider("llm") },
    };
  }

  static async #enrich({ deviceId, clientId, text, audio, mime, language }) {
    let transcript = text;
    let stt = null;
    if (audio) {
      stt = await SttService.transcribe({ buffer: audio, mimeType: mime ?? "audio/webm", language, hint: text });
      if (!stt.mock && stt.text) transcript = stt.text;
    }
    if (!transcript) return;
    const deep = await VoiceSosService.parseDeep(transcript);
    const parsed = deep.data;
    const sos = await SosService.updateDetails({
      clientId,
      deviceId,
      type: parsed.hazardType,
      details: toSosDetails(parsed, transcript),
      ai: snapshot(parsed, { provider: deep.provider, mock: deep.mock, stage: "enriched" }),
    }).catch(() => null);
    if (!sos) return;
    publishToDevice(
      AI_EVENTS.VOICE_PARSED,
      { clientId, parsed, transcript, stt: stt ? { provider: stt.provider, mock: stt.mock } : null, llm: { provider: deep.provider, mock: deep.mock } },
      deviceId,
    );
  }
}

export { VoiceSosService };
