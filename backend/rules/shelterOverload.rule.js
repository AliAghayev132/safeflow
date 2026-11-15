import { domainEvents } from "#constants";
import { isCritical } from "#engine";
import { AlertService } from "#services";

/**
 * Critical crisis rule — shelter overload.
 * Occupancy at/above `shelter.alertThreshold` (95%) → red alert recommending
 * a new assembly point + an extra brigade (one active alert per shelter).
 */
const shelterOverloadRule = {
  id: "shelter-overload",
  name: "rule.shelterOverload",
  events: [domainEvents.SHELTER_UPDATED],
  enabled: true,

  describe: ({ shelter }) =>
    `Toplanış məntəqəsinin doluluğu ${Math.round(shelter.alertThreshold * 100)}%-ə çatdıqda`,

  async handle({ payload: { shelter }, config, rule }) {
    if (!shelter.isActive) return;
    if (!isCritical(shelter.occupancyRate, config.shelter)) return;
    await AlertService.raiseShelterOverload({ ruleId: rule.id, shelter });
  },
};

export { shelterOverloadRule };
