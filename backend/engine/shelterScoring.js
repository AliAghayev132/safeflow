/**
 * Weighted shelter selection — pure.
 *
 *   Score = w1 × distance_km + w2 × occupancy_penalty + w3 × road_status_penalty
 *
 * Lower is better. Sends people to the right shelter instead of flooding the
 * nearest one.
 *
 *   occupancy_penalty = rate² × 10   (+ 5 when fill ETA < fillWarningMinutes)
 *   road_penalty      = congestion-weighted km on the route + 3 if the route
 *                       is approximate (fallback / unknown road state)
 *
 * Shelters at/above the reroute threshold are marked `isFull` and ranked last.
 */
export const occupancyPenalty = (rate, fillEtaMin, cfg) => {
  let p = (Number(rate) || 0) ** 2 * 10;
  if (Number.isFinite(fillEtaMin) && fillEtaMin < cfg.fillWarningMinutes) p += 5;
  return p;
};

export const scoreShelter = (
  { distanceMeters, occupancyRate, roadPenalty = 0, fillEtaMin = null },
  { weights, shelter },
) => {
  const distanceKm = distanceMeters / 1000;
  const occ = occupancyPenalty(occupancyRate, fillEtaMin, shelter);
  const parts = {
    distance: weights.distance * distanceKm,
    occupancy: weights.occupancy * occ,
    roadStatus: weights.roadStatus * roadPenalty,
  };
  return {
    score: Math.round((parts.distance + parts.occupancy + parts.roadStatus) * 1000) / 1000,
    parts,
  };
};

/** Rank candidates: non-full first, then by score. */
export const rankShelters = (candidates) =>
  [...candidates].sort((a, b) => Number(a.isFull) - Number(b.isFull) || a.score - b.score);
