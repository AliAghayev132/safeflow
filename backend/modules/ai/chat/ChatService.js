import { crypto } from "#lib";
import { Alert } from "#models";
import { haversineMeters } from "#utils";
import { ShelterService } from "#services/ShelterService.js";
import { ZoneService } from "#services/ZoneService.js";
import { ConfigService } from "#services/ConfigService.js";
import { routingService } from "#services/RoutingService.js";
import { SupplyRequest } from "../../drones/models/index.js";
import { LlmService } from "../providers/LlmService.js";
import { resolveProvider } from "../providers/settings.js";
import { background, publishToDevice } from "../common.js";
import { composeAnswer, detectIntents } from "./intents.js";

const fmtDistance = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

// Water delivered by drone in the last 24 h, per shelter (refreshed at most every 30 s)
const waterCache = { at: 0, set: new Set() };
const deliveredWater = async () => {
  if (Date.now() - waterCache.at < 30000) return waterCache.set;
  const rows = await SupplyRequest.find(
    { status: "delivered", "items.kind": "water", updatedAt: { $gte: new Date(Date.now() - 86400000) } },
    { shelter: 1 },
  ).lean();
  waterCache.set = new Set(rows.map((r) => String(r.shelter)));
  waterCache.at = Date.now();
  return waterCache.set;
};

/**
 * Citizen assistant (RAG over LIVE data, not documents):
 *   retrieve → nearest open shelters with occupancy, water / medical points,
 *   closed roads nearby, active alerts in the district →
 *   1. instant grounded answer (templates, < 300 ms) returned in the request
 *   2. if an LLM is configured, a calmer natural answer is generated from the
 *      SAME retrieved context and pushed to the device (`ai:chat`).
 */
class ChatService {
  static async retrieve(origin) {
    const c = ConfigService.get("ai").chatbot;
    const walk = ConfigService.get("routing").walkingSpeedKmh || 5;
    const [shelters, water] = await Promise.all([ShelterService.list({ isActive: true }), deliveredWater()]);
    const ranked = origin
      ? shelters
          .map((s) => ({ s, d: haversineMeters(origin, s) }))
          .filter((x) => x.d <= c.radiusMeters)
          .sort((a, b) => a.d - b.d)
      : shelters.map((s) => ({ s, d: null }));
    const view = ({ s, d }) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      distanceMeters: d == null ? null : Math.round(d),
      distance: d == null ? "—" : fmtDistance(d),
      walkMin: d == null ? null : Math.max(1, Math.round((d * 1.3) / ((walk * 1000) / 60))),
      pct: Math.round(s.occupancyRate * 100),
      full: s.occupancyRate >= 0.9,
      medicalPoint: Boolean(s.medicalPoint),
      accessible: s.accessible !== false,
      delivered: water.has(s.id),
    });
    const usable = ranked.filter((x) => x.s.occupancyRate < 1);
    const zone = origin ? ZoneService.resolve(origin) : null;
    const closedRoads = origin
      ? [...routingService.edges.values()].filter((e) => {
          if (e.status !== "closed") return false;
          const a = routingService.nodes.get(e.from);
          return a && haversineMeters(origin, a) <= 1500;
        }).length
      : 0;
    const activeAlerts = zone ? await Alert.countDocuments({ status: "active", zone: zone._id }) : 0;

    return {
      zone: zone ? { code: zone.code, name: zone.name } : null,
      shelters: usable.slice(0, c.maxShelters).map(view),
      waterPoints: [...usable.filter((x) => water.has(x.s.id)), ...usable].slice(0, 2).map(view),
      medicalPoints: usable.filter((x) => x.s.medicalPoint).slice(0, 2).map(view),
      closedRoads,
      activeAlerts,
      at: new Date(),
    };
  }

  static async ask({ deviceId, message, history = [], origin, language = "az" }) {
    const ctx = await ChatService.retrieve(origin);
    const intents = detectIntents(message);
    const answer = composeAnswer(intents, ctx, language);
    const id = crypto.randomUUID();
    const llm = resolveProvider("llm");

    if (llm !== "mock") {
      background("chat", () => ChatService.#refine({ id, deviceId, message, history, ctx, language, fallback: answer }));
    }
    return {
      id,
      answer,
      intents,
      refining: llm !== "mock",
      provider: llm === "mock" ? "mock" : "rules",
      mock: llm === "mock",
      sources: ChatService.#sources(ctx, intents),
      context: { zone: ctx.zone, closedRoads: ctx.closedRoads, activeAlerts: ctx.activeAlerts },
    };
  }

  static #sources(ctx, intents) {
    const list = [...ctx.shelters];
    if (intents.includes("water")) list.push(...ctx.waterPoints);
    if (intents.includes("medical")) list.push(...ctx.medicalPoints);
    const seen = new Set();
    return list
      .filter((s) => !seen.has(s.id) && seen.add(s.id))
      .map(({ id, name, distance, pct, lat, lng, medicalPoint, delivered }) => ({ id, name, distance, pct, lat, lng, medicalPoint, water: delivered }));
  }

  static async #refine({ id, deviceId, message, history, ctx, language, fallback }) {
    const maxHistory = ConfigService.get("ai").chatbot.maxHistory;
    const langName = { az: "Azerbaijani", en: "English", ru: "Russian" }[language] ?? "Azerbaijani";
    const system =
      "You are the calm assistant of a city evacuation app during an emergency in Baku. " +
      `Answer in ${langName}, in at most 5 short sentences, warm and steady, never alarmist. ` +
      "Use ONLY the live data in <context> for shelters, distances, occupancy, water and medical points, closed roads and alerts; " +
      "if something is not in the context, say you do not have that information. " +
      "If the person's life is in danger, first tell them to press the red SOS button or call 112. " +
      "Never give medical diagnoses; give basic safety steps only.\n" +
      `<context>${JSON.stringify(ctx)}</context>`;
    const messages = [
      ...history
        .slice(-maxHistory)
        .filter((m) => ["user", "assistant"].includes(m.role) && typeof m.content === "string")
        .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) })),
      { role: "user", content: String(message).slice(0, 2000) },
    ];
    // The API requires the first message to be from the user
    while (messages.length && messages[0].role !== "user") messages.shift();
    const r = await LlmService.chat({ task: "citizen_chat", system, messages, mock: () => fallback });
    publishToDevice("ai:chat", { id, answer: r.text, provider: r.provider, mock: r.mock }, deviceId);
  }
}

export { ChatService };
