/**
 * Holt's linear exponential smoothing (double exponential smoothing) — a
 * small online time-series model: level ℓ and trend b are updated per
 * sample, the h-step forecast is ℓ + h·b. Pure, O(n), unit-tested.
 *
 *   ℓ_t = α·y_t + (1−α)(ℓ_{t−1} + b_{t−1})
 *   b_t = β(ℓ_t − ℓ_{t−1}) + (1−β)·b_{t−1}
 */
export const holtFit = (series, { alpha = 0.5, beta = 0.3 } = {}) => {
  const y = series.filter((v) => Number.isFinite(v));
  if (!y.length) return { level: 0, trend: 0, n: 0, mae: null };
  if (y.length === 1) return { level: y[0], trend: 0, n: 1, mae: null };
  let level = y[0];
  let trend = y[1] - y[0];
  let absErr = 0;
  for (let t = 1; t < y.length; t++) {
    const predicted = level + trend;
    absErr += Math.abs(y[t] - predicted);
    const prevLevel = level;
    level = alpha * y[t] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  return { level, trend, n: y.length, mae: absErr / (y.length - 1) };
};

/** h-step-ahead forecast, clamped to [min, max]. */
export const holtForecast = (model, steps, { min = 0, max = Infinity } = {}) =>
  Math.min(max, Math.max(min, model.level + steps * model.trend));

/**
 * Prediction interval half-width (≈ 80 %) growing with the horizon.
 * Uses the one-step MAE; no history → wide interval.
 */
export const interval = (model, steps) => {
  const base = model.mae ?? Math.max(1, Math.abs(model.level) * 0.1);
  return 1.28 * 1.25 * base * Math.sqrt(Math.max(1, steps));
};

/** Risk class from a predicted occupancy rate. */
export const occupancyRisk = (rate, warn = 0.9) =>
  rate >= 1 ? "overflow" : rate >= warn ? "critical" : rate >= warn - 0.15 ? "elevated" : "normal";
