/**
 * Shelter inflow & fill-time prediction — pure.
 *
 * `samples` are occupancy changes { at: epochMs, delta }.
 *   inflow (people/min) = Σ delta in the window / window minutes
 *   fill ETA (min)      = remaining capacity / inflow   (null if inflow <= 0)
 */
export const inflowPerMinute = (samples, now, windowMs) => {
  const from = now - windowMs;
  const net = samples
    .filter((s) => s.at >= from && s.at <= now)
    .reduce((sum, s) => sum + s.delta, 0);
  const minutes = windowMs / 60000;
  return Math.max(0, net / minutes);
};

export const fillEtaMinutes = ({ capacity, occupancy, inflow }) => {
  const remaining = Math.max(0, capacity - occupancy);
  if (remaining === 0) return 0;
  if (!inflow || inflow <= 0) return null;
  return Math.round((remaining / inflow) * 10) / 10;
};
