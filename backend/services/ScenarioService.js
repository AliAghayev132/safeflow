import { crypto } from "#lib";
import { Shelter } from "#models";
import { SCENARIOS } from "#data";
import { domainEvents, sosTypes } from "#constants";
import { AppError, randomPointAround } from "#utils";
import { eventBus } from "./EventBus.js";
import { SosService } from "./SosService.js";
import { ShelterService } from "./ShelterService.js";
import { RoadService } from "./RoadService.js";

const pickWeighted = (mix) => {
  let r = Math.random();
  for (const [key, weight] of Object.entries(mix)) {
    if ((r -= weight) <= 0) return key;
  }
  return Object.keys(mix)[0];
};
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const sample = (list, n) => [...list].sort(() => Math.random() - 0.5).slice(0, n);

/**
 * Hackathon demo: streams a realistic disaster over time through the regular
 * services (so triage, clustering, rerouting, inflow prediction and spam
 * detection all react exactly as they would to real traffic).
 */
class ScenarioService {
  static #state = null;
  static #timer = null;

  static list() {
    return Object.values(SCENARIOS).map((s) => ({
      id: s.id,
      title: s.title,
      titleKey: s.titleKey,
      disaster: s.disaster,
      zoneCode: s.zoneCode,
      durationSec: Math.round((s.ticks * s.tickMs) / 1000),
    }));
  }

  static status() {
    return ScenarioService.#state;
  }

  static #publish() {
    eventBus.publish(domainEvents.SCENARIO_UPDATED, { scenario: { ...ScenarioService.#state } });
  }

  static async start(id) {
    const def = SCENARIOS[id];
    if (!def) throw AppError.notFound("Ssenari tapılmadı");
    if (ScenarioService.#state?.status === "running") {
      throw AppError.conflict("Başqa ssenari artıq işləyir");
    }

    const shelters = await Shelter.find({ code: { $in: Object.keys(def.inflow) } });
    ScenarioService.#state = {
      id: def.id,
      title: def.title,
      titleKey: def.titleKey,
      status: "running",
      tick: 0,
      ticks: def.ticks,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      stats: { sos: 0, spam: 0, roadsClosed: 0, arrivals: 0 },
    };
    ScenarioService.#publish();

    const shelterIds = new Map(shelters.map((s) => [s.code, s._id]));

    const step = async () => {
      const state = ScenarioService.#state;
      if (!state || state.status !== "running") return;
      state.tick += 1;

      try {
        // Genuine SOS from distinct devices
        const n = randInt(def.sosPerTick[0], def.sosPerTick[1]);
        for (let i = 0; i < n; i++) {
          const type = pickWeighted(def.typeMix);
          const vulnerable = Math.random() < def.vulnerableChance;
          await SosService.create({
            clientId: crypto.randomUUID(),
            deviceId: crypto.randomUUID(),
            type,
            origin: randomPointAround(def.epicenter, def.radiusMeters),
            ip: `10.0.${randInt(0, 255)}.${randInt(1, 254)}`,
            details: {
              headcount: randInt(1, def.maxHeadcount),
              needs: sample(def.needsPool, randInt(0, 2)),
              vulnerable: vulnerable
                ? { elderly: Math.random() < 0.5, child: Math.random() < 0.5, disabled: Math.random() < 0.3 }
                : undefined,
              injuries: type === "medical" && Math.random() < 0.6 ? "Yaralılar var" : undefined,
              note: "Simulyasiya",
            },
          });
          state.stats.sos += 1;
        }

        // Spam burst: rotating device ids behind one IP
        if (def.spam && state.tick === def.spam.atTick) {
          for (let i = 0; i < def.spam.devices; i++) {
            await SosService.create({
              clientId: crypto.randomUUID(),
              deviceId: crypto.randomUUID(),
              type: sosTypes[i % 4],
              origin: randomPointAround(def.epicenter, 80),
              ip: def.spam.ip,
              details: { note: "Simulyasiya: saxta SOS" },
            });
            state.stats.spam += 1;
          }
        }

        // Shelter inflow
        for (const [code, perTick] of Object.entries(def.inflow)) {
          const shelterId = shelterIds.get(code);
          if (!shelterId) continue;
          const delta = randInt(Math.round(perTick * 0.7), Math.round(perTick * 1.3));
          await ShelterService.updateOccupancy(shelterId, { delta });
          state.stats.arrivals += delta;
        }

        // Road closures
        for (const edgeId of def.roadClosures[state.tick] ?? []) {
          await RoadService.close(edgeId, "Simulyasiya: zəlzələ dağıntısı").catch(() => null);
          state.stats.roadsClosed += 1;
        }
      } catch (error) {
        console.error("❌ [Scenario] tick failed:", error.message);
      }

      if (state.tick >= def.ticks) {
        state.status = "finished";
        state.finishedAt = new Date().toISOString();
        ScenarioService.#publish();
        return;
      }
      ScenarioService.#publish();
      ScenarioService.#timer = setTimeout(step, def.tickMs);
    };

    ScenarioService.#timer = setTimeout(step, 300);
    return ScenarioService.#state;
  }

  static stop() {
    clearTimeout(ScenarioService.#timer);
    if (ScenarioService.#state?.status === "running") {
      ScenarioService.#state.status = "stopped";
      ScenarioService.#state.finishedAt = new Date().toISOString();
      ScenarioService.#publish();
    }
    return ScenarioService.#state;
  }
}

export { ScenarioService };
