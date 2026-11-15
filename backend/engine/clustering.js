import { haversineMeters } from "#utils/geo.js";

/**
 * SOS cluster detection — pure function, no I/O.
 *
 * Sliding window: a signal counts when `now - windowMs <= createdAt <= now`
 * (both bounds inclusive). The window moves with every new signal; there are
 * no fixed 5-minute buckets.
 *
 * Only DISTINCT devices count. Zone and radius are evaluated separately:
 *   - zone:   signals whose zone equals the trigger's zone
 *   - radius: signals within `radiusMeters` (haversine) of the trigger
 * The cluster triggers when either set reaches `minSignals` distinct devices.
 *
 * A signal is ignored when it is resolved / cancelled, its citizen reported
 * "I am safe", or it was flagged as spam (when configured).
 *
 * @param {object}   p
 * @param {object[]} p.signals  candidate signals { id, deviceId, zone, lat, lng, createdAt, status, citizenSafe, spamFlagged }
 * @param {object}   p.trigger  the signal that just arrived (same shape)
 * @param {number}   p.now      epoch ms
 * @param {object}   p.cfg      { minSignals, windowMs, radiusMeters }
 * @param {boolean} [p.excludeSpam=true]
 */
export const evaluateCluster = ({ signals, trigger, now, cfg, excludeSpam = true }) => {
  const from = now - cfg.windowMs;

  const countable = signals.filter((s) => {
    const t = new Date(s.createdAt).getTime();
    if (Number.isNaN(t) || t < from || t > now) return false;
    if (s.status === "resolved" || s.status === "cancelled") return false;
    if (s.citizenSafe) return false;
    if (excludeSpam && s.spamFlagged) return false;
    return true;
  });

  const byZone = trigger.zone
    ? countable.filter((s) => s.zone && String(s.zone) === String(trigger.zone))
    : [];
  const byRadius = countable.filter(
    (s) => haversineMeters(s, trigger) <= cfg.radiusMeters,
  );

  const devices = (list) => new Set(list.map((s) => s.deviceId));
  const zoneDevices = devices(byZone).size;
  const radiusDevices = devices(byRadius).size;

  const zoneHit = zoneDevices >= cfg.minSignals;
  const radiusHit = radiusDevices >= cfg.minSignals;

  const members = new Map();
  if (zoneHit) byZone.forEach((s) => members.set(String(s.id), s));
  if (radiusHit) byRadius.forEach((s) => members.set(String(s.id), s));
  const signalsInCluster = [...members.values()];

  return {
    triggered: zoneHit || radiusHit,
    mode: zoneHit && radiusHit ? "both" : zoneHit ? "zone" : radiusHit ? "radius" : null,
    zoneDevices,
    radiusDevices,
    distinctDevices: devices(signalsInCluster).size,
    signals: signalsInCluster,
  };
};

/**
 * Alert de-duplication for clusters.
 *
 *   - an ACTIVE alert for the same area exists        → "update" it
 *   - a decided alert for the same area within cooldown → "attach" signals,
 *     no new red alert
 *   - otherwise                                       → "create"
 *
 * "Same area" = same zone OR alert center within `radiusMeters`.
 *
 * @param {object[]} alerts  recent cluster alerts { id, status, zone, lat, lng, decidedAt, createdAt }
 */
export const decideClusterAlert = ({ alerts, zone, center, now, cfg }) => {
  const sameArea = (a) =>
    (zone && a.zone && String(a.zone) === String(zone)) ||
    haversineMeters({ lat: a.lat, lng: a.lng }, center) <= cfg.radiusMeters;

  const active = alerts.find((a) => a.status === "active" && sameArea(a));
  if (active) return { action: "update", alert: active };

  const recent = alerts.find((a) => {
    if (a.status === "active" || !sameArea(a)) return false;
    const at = new Date(a.decidedAt ?? a.createdAt).getTime();
    return now - at <= cfg.cooldownMs;
  });
  if (recent) return { action: "attach", alert: recent };

  return { action: "create", alert: null };
};
