/**
 * Weighted shelter selection — pure.
 *
 *   Score = w.distance    × distance_km
 *         + w.occupancy   × occupancy_penalty
 *         + w.roadStatus  × road_status_penalty
 *         + w.pending     × pending_penalty      (people already routed there)
 *         + w.needs       × needs_penalty        (special needs fit)
 *
 * Lower is better. Sends people to the right shelter instead of flooding the
 * nearest one.
 *
 *   occupancy_penalty = rate² × 10   (+ 5 when fill ETA < fillWarningMinutes)
 *   road_penalty      = congestion-weighted km on the route + 3 if the route
 *                       is approximate (fallback / unknown road state)
 *   pending_penalty   = (pending arrivals / capacity) × 10
 *   needs_penalty     = medical needs: +2 without a medical point, −1 with one
 *
 * A shelter at/above the reroute threshold is `isFull`; a shelter without a
 * step-free entrance is `unsuitable` for wheelchair users. Both rank last.
 */
export const occupancyPenalty = (rate, fillEtaMin, cfg) => {
  let p = (Number(rate) || 0) ** 2 * 10;
  if (Number.isFinite(fillEtaMin) && fillEtaMin < cfg.fillWarningMinutes) p += 5;
  return p;
};

export const pendingPenalty = (pending, capacity) =>
  capacity > 0 ? Math.min(10, ((Number(pending) || 0) / capacity) * 10) : 0;

export const needsPenalty = ({ medical = false } = {}, shelter = {}) => {
  if (!medical) return 0;
  return shelter.medicalPoint ? -1 : 2;
};

export const scoreShelter = (
  {
    distanceMeters,
    occupancyRate,
    roadPenalty = 0,
    fillEtaMin = null,
    pendingArrivals = 0,
    capacity = 0,
    needs = {},
    medicalPoint = false,
  },
  { weights, shelter },
) => {
  const parts = {
    distance: weights.distance * (distanceMeters / 1000),
    occupancy: weights.occupancy * occupancyPenalty(occupancyRate, fillEtaMin, shelter),
    roadStatus: weights.roadStatus * roadPenalty,
    pending: (weights.pending ?? 0) * pendingPenalty(pendingArrivals, capacity),
    needs: (weights.needs ?? 0) * needsPenalty(needs, { medicalPoint }),
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { score: Math.round(total * 1000) / 1000, parts };
};

/** Rank candidates: suitable and non-full first, then by score. */
export const rankShelters = (candidates) =>
  [...candidates].sort(
    (a, b) =>
      Number(Boolean(a.unsuitable)) - Number(Boolean(b.unsuitable)) ||
      Number(a.isFull) - Number(b.isFull) ||
      a.score - b.score,
  );

const pct = (r) => Math.round((Number(r) || 0) * 100);
const minutes = (sec) => Math.max(1, Math.round((Number(sec) || 0) / 60));

/**
 * Why this shelter? — pure. Compares the recommendation with the nearest
 * option (by travel time) and returns a translation key + params, e.g.
 *   "balancing.nearestFull": nearest is 88% full, this one is 4 min further
 *   and 40% full.
 */
export const explainChoice = (options, recommendedId) => {
  const rec = options.find((o) => o.shelter.id === recommendedId);
  if (!rec) return null;
  const nearest = [...options].sort((a, b) => a.durationSec - b.durationSec)[0];
  const base = {
    shelter: rec.shelter.name,
    minutes: minutes(rec.durationSec),
    rate: pct(rec.shelter.occupancyRate),
  };
  if (!nearest || nearest.shelter.id === rec.shelter.id) {
    return { key: "balancing.nearest", params: base };
  }
  const params = {
    ...base,
    nearest: nearest.shelter.name,
    nearestMinutes: minutes(nearest.durationSec),
    nearestRate: pct(nearest.shelter.occupancyRate),
    extraMinutes: Math.max(0, minutes(rec.durationSec) - minutes(nearest.durationSec)),
    nearestPending: nearest.shelter.pendingArrivals ?? 0,
  };
  let reason = "betterOverall";
  if (nearest.unsuitable === "notAccessible") reason = "nearestNotAccessible";
  else if (nearest.isFull || nearest.shelter.occupancyRate >= 0.8) reason = "nearestFull";
  else if ((nearest.scoreParts?.pending ?? 0) > (rec.scoreParts?.pending ?? 0) + 1) reason = "nearestCrowding";
  else if ((nearest.scoreParts?.roadStatus ?? 0) > (rec.scoreParts?.roadStatus ?? 0) + 1) reason = "nearestRoads";
  else if ((nearest.scoreParts?.needs ?? 0) > (rec.scoreParts?.needs ?? 0)) reason = "medicalPoint";
  return { key: `balancing.${reason}`, params };
};

/** Azerbaijani fallback text for an explanation (clients translate by key). */
export const explanationText = (exp) => {
  if (!exp) return "";
  const p = exp.params;
  switch (exp.key) {
    case "balancing.nearest":
      return `Ən yaxın və uyğun məntəqə: ${p.minutes} dəqiqə, ${p.rate}% dolu.`;
    case "balancing.nearestFull":
      return `Ən yaxın məntəqə (${p.nearest}) ${p.nearestRate}% doludur, bu məntəqə ${p.extraMinutes} dəqiqə uzaqdır, ${p.rate}% doludur.`;
    case "balancing.nearestCrowding":
      return `Ən yaxın məntəqəyə (${p.nearest}) artıq ${p.nearestPending} nəfər yoldadır; bu məntəqə ${p.extraMinutes} dəqiqə uzaqdır, ${p.rate}% doludur.`;
    case "balancing.nearestRoads":
      return `Ən yaxın məntəqəyə (${p.nearest}) gedən yollar sıxdır və ya bağlıdır; bu marşrut daha təhlükəsizdir (${p.minutes} dəq).`;
    case "balancing.nearestNotAccessible":
      return `Ən yaxın məntəqədə (${p.nearest}) maneəsiz giriş yoxdur; bu məntəqə əlil arabası üçün uyğundur (${p.minutes} dəq).`;
    case "balancing.medicalPoint":
      return `Bu məntəqədə tibb məntəqəsi var (${p.minutes} dəq, ${p.rate}% dolu).`;
    default:
      return `Ümumi qiymətləndirmədə ən uyğun məntəqə: ${p.minutes} dəq, ${p.rate}% dolu.`;
  }
};
