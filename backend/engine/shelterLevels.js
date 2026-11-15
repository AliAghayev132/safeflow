/**
 * Shelter occupancy levels — pure.
 *
 *   rate <  rerouteThreshold (90%)           → "normal"
 *   rerouteThreshold <= rate < alertThreshold → "warning"  (citizens rerouted)
 *   rate >= alertThreshold (95%)              → "critical" (dispatcher red alert)
 *
 * Both thresholds are inclusive (90.0% is already "warning", 95.0% "critical").
 */
export const shelterLevel = (rate, cfg) => {
  const r = Number(rate) || 0;
  if (r >= cfg.alertThreshold) return "critical";
  if (r >= cfg.rerouteThreshold) return "warning";
  return "normal";
};

export const isFull = (rate, cfg) => (Number(rate) || 0) >= cfg.rerouteThreshold;
export const isCritical = (rate, cfg) => (Number(rate) || 0) >= cfg.alertThreshold;
