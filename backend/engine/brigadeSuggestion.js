import { haversineMeters } from "#utils/geo.js";

/**
 * Brigade auto-suggestion — pure.
 *
 * For a target point and hazard type, ranks brigades by estimated arrival:
 *   ETA = road distance / speed           (road distance ≈ haversine × detour)
 *   rank = ETA + (type matches the hazard ? 0 : mismatchPenaltySec)
 * i.e. a matching brigade wins unless the other type arrives more than
 * mismatchPenaltySec (default 10 min) earlier.
 *
 * Available brigades are suggested first. If none is free, the brigade that
 * becomes free soonest is proposed:
 *   dispatched → remaining travel to its incident + on-scene time
 *   on_scene   → on-scene time left (from statusChangedAt)
 *   returning  → 0 (can be redirected immediately)
 * and its total ETA = freeIn + travel from where it will be to the target.
 *
 * @param {object}   p
 * @param {object[]} p.brigades  { id, code, name, type, status, lat, lng, target?, statusChangedAt? }
 * @param {object}   p.target    { lat, lng }
 * @param {string}  [p.preferredType]
 * @param {object}   p.cfg       { speedKmh, onSceneMinutes, detourFactor?, mismatchPenaltySec?, alternatives? }
 * @param {number}   p.now       epoch ms
 */
export const rankBrigades = ({ brigades, target, preferredType, cfg, now }) => {
  const speed = (cfg.speedKmh * 1000) / 3600; // m/s
  const detour = cfg.detourFactor ?? 1.3;
  const mismatchPenalty = cfg.mismatchPenaltySec ?? 600;
  const onSceneSec = (cfg.onSceneMinutes ?? 20) * 60;
  const travelSec = (from) => Math.round((haversineMeters(from, target) * detour) / speed);

  const scored = brigades.map((b) => {
    const typeMatch = !preferredType || b.type === preferredType;
    const penalty = typeMatch ? 0 : mismatchPenalty;
    if (b.status === "available") {
      const etaSec = travelSec(b);
      return { brigade: b, available: true, typeMatch, etaSec, freeInSec: 0, rank: etaSec + penalty };
    }

    // Busy: when does it become free, and where will it be?
    let freeInSec = 0;
    let from = { lat: b.lat, lng: b.lng };
    const elapsed = b.statusChangedAt ? Math.max(0, (now - new Date(b.statusChangedAt).getTime()) / 1000) : 0;
    if (b.status === "dispatched" && b.target) {
      const remaining = Math.round((haversineMeters(b, b.target) * detour) / speed);
      freeInSec = remaining + onSceneSec;
      from = b.target;
    } else if (b.status === "on_scene") {
      freeInSec = Math.max(0, Math.round(onSceneSec - elapsed));
    } else if (b.status === "returning") {
      freeInSec = 0;
    }
    const etaSec = freeInSec + travelSec(from);
    return { brigade: b, available: false, typeMatch, etaSec, freeInSec, rank: etaSec + penalty };
  });

  const available = scored.filter((s) => s.available).sort((a, b) => a.rank - b.rank);
  const busy = scored.filter((s) => !s.available).sort((a, b) => a.rank - b.rank);
  const pick = (s) =>
    s && {
      brigadeId: String(s.brigade.id),
      code: s.brigade.code,
      name: s.brigade.name,
      type: s.brigade.type,
      status: s.brigade.status,
      typeMatch: s.typeMatch,
      etaSec: s.etaSec,
      freeInSec: s.freeInSec,
    };

  return {
    suggestion: pick(available[0]) ?? null,
    alternatives: available.slice(1, 1 + (cfg.alternatives ?? 3)).map(pick),
    noneAvailable: available.length === 0,
    soonestFree: available.length === 0 ? (pick(busy[0]) ?? null) : null,
  };
};
