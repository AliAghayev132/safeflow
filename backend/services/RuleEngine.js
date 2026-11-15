import { ConfigService } from "./ConfigService.js";
import { eventBus } from "./EventBus.js";

/**
 * RuleEngine (singleton)
 *
 * Rules are plain objects (see rules/):
 *   {
 *     id, name, description,
 *     events: [domainEvent, ...],   // what triggers evaluation
 *     enabled: true,
 *     describe(config) -> string,    // human readable thresholds
 *     handle({ event, payload, config, rule })
 *   }
 *
 * Each rule's executions are serialized through its own promise queue, so a
 * burst of events (e.g. an SOS wave) can't create duplicate alerts.
 */
class RuleEngine {
  constructor() {
    this.rules = new Map();
    this.queues = new Map();
    this.stats = new Map(); // ruleId -> { runs, lastRunAt, lastError }
  }

  register(rule) {
    if (this.rules.has(rule.id)) {
      throw new Error(`Rule "${rule.id}" is already registered`);
    }
    this.rules.set(rule.id, rule);
    this.queues.set(rule.id, Promise.resolve());
    this.stats.set(rule.id, { runs: 0, lastRunAt: null, lastError: null });

    for (const event of rule.events) {
      eventBus.subscribe(event, (payload) => this.#enqueue(rule, event, payload));
    }
  }

  registerAll(rules) {
    rules.forEach((rule) => this.register(rule));
    console.log(`⚙️  Rule engine: ${rules.length} rules registered`);
  }

  #enqueue(rule, event, payload) {
    const next = this.queues
      .get(rule.id)
      .then(() => this.#run(rule, event, payload));
    this.queues.set(rule.id, next);
    return next;
  }

  async #run(rule, event, payload) {
    if (rule.enabled === false) return;
    // Rules owned by a feature module only run while the feature is on
    if (rule.feature && !ConfigService.isEnabled(rule.feature)) return;
    const stat = this.stats.get(rule.id);
    try {
      await rule.handle({ event, payload, config: ConfigService.get(), rule });
      stat.lastError = null;
    } catch (error) {
      stat.lastError = error.message;
      console.error(`❌ [RuleEngine] rule "${rule.id}" failed:`, error);
    } finally {
      stat.runs += 1;
      stat.lastRunAt = new Date();
    }
  }

  setEnabled(ruleId, enabled) {
    const rule = this.rules.get(ruleId);
    if (rule) rule.enabled = Boolean(enabled);
    return rule;
  }

  list() {
    return [...this.rules.values()].map((rule) => ({
      id: rule.id,
      name: rule.name,
      description: rule.describe?.(ConfigService.get()) ?? rule.description ?? "",
      events: rule.events,
      enabled: rule.enabled !== false,
      ...this.stats.get(rule.id),
    }));
  }
}

const ruleEngine = new RuleEngine();

export { RuleEngine, ruleEngine };
