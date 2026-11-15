import { Setting } from "#models";
import { crisisDefaults } from "#config";
import { domainEvents } from "#constants";
import { AppError } from "#utils";
import { eventBus } from "./EventBus.js";

const KEY = "crisis";

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Deep merge (arrays and scalars replace). */
const deepMerge = (base, patch) => {
  if (!isObject(patch)) return patch;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isObject(v) && isObject(base?.[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
};

/**
 * Validates a patch against the defaults' shape: only known keys, same value
 * types, numbers finite and non-negative. Prevents typos and broken configs.
 */
const validatePatch = (patch, shape, path = "") => {
  if (!isObject(patch)) throw AppError.badRequest(`${path || "config"} must be an object`);
  for (const [k, v] of Object.entries(patch)) {
    const p = path ? `${path}.${k}` : k;
    if (!Object.hasOwn(shape, k)) throw AppError.badRequest(`Unknown config key: ${p}`);
    const expected = shape[k];
    if (isObject(expected)) {
      validatePatch(v, expected, p);
    } else if (Array.isArray(expected)) {
      if (!Array.isArray(v)) throw AppError.badRequest(`${p} must be an array`);
    } else if (typeof expected === "number") {
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
        throw AppError.badRequest(`${p} must be a non-negative number`);
      }
    } else if (typeof v !== typeof expected) {
      throw AppError.badRequest(`${p} must be ${typeof expected}`);
    }
  }
};

/**
 * ConfigService — the runtime rules engine configuration.
 *
 * Effective config = config/defaults/crisis.json  ⊕  MongoDB overrides.
 * Reads are synchronous from an in-memory cache; updates are validated,
 * persisted, audited by the caller and published (CONFIG_UPDATED) so every
 * rule picks them up without a restart.
 */
class ConfigService {
  // Core defaults + sections contributed by feature modules (registerDefaults)
  static #defaults = structuredClone(crisisDefaults);
  static #overrides = {};
  static #effective = structuredClone(crisisDefaults);
  static #version = 0;

  /**
   * A feature module contributes its own config section (modules/<name>/
   * defaults). Must be called before load(). Section names must be unique.
   */
  static registerDefaults(section, defaults) {
    if (Object.hasOwn(crisisDefaults, section)) {
      throw new Error(`Config section "${section}" is reserved by core defaults`);
    }
    ConfigService.#defaults[section] = structuredClone(defaults);
    ConfigService.#effective = deepMerge(ConfigService.#defaults, ConfigService.#overrides);
  }

  static async load() {
    const doc = await Setting.findOne({ key: KEY }).lean();
    ConfigService.#overrides = doc?.value ?? {};
    ConfigService.#version = doc?.version ?? 0;
    ConfigService.#effective = deepMerge(ConfigService.#defaults, ConfigService.#overrides);
    return ConfigService.#effective;
  }

  /** Effective config (or a section of it). */
  static get(section) {
    return section ? ConfigService.#effective[section] : ConfigService.#effective;
  }

  /** Feature flag (config section `features`). Unknown flags are off. */
  static isEnabled(feature) {
    return ConfigService.#effective.features?.[feature] === true;
  }

  static features() {
    return { ...(ConfigService.#effective.features ?? {}) };
  }

  static snapshot() {
    return {
      effective: ConfigService.#effective,
      overrides: ConfigService.#overrides,
      defaults: ConfigService.#defaults,
      version: ConfigService.#version,
    };
  }

  static async update(patch, operator) {
    validatePatch(patch, ConfigService.#defaults);
    const overrides = deepMerge(ConfigService.#overrides, patch);
    const doc = await Setting.findOneAndUpdate(
      { key: KEY },
      { $set: { value: overrides, updatedBy: operator?._id ?? null }, $inc: { version: 1 } },
      { upsert: true, new: true },
    );
    ConfigService.#overrides = doc.value;
    ConfigService.#version = doc.version;
    ConfigService.#effective = deepMerge(ConfigService.#defaults, doc.value);
    eventBus.publish(domainEvents.CONFIG_UPDATED, { config: ConfigService.snapshot(), patch });
    return ConfigService.snapshot();
  }

  static async reset(operator) {
    await Setting.findOneAndUpdate(
      { key: KEY },
      { $set: { value: {}, updatedBy: operator?._id ?? null }, $inc: { version: 1 } },
      { upsert: true },
    );
    await ConfigService.load();
    eventBus.publish(domainEvents.CONFIG_UPDATED, { config: ConfigService.snapshot(), patch: null });
    return ConfigService.snapshot();
  }
}

export { ConfigService, deepMerge };
