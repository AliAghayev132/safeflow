/**
 * Drone supply logic — pure functions (unit-tested, no I/O).
 */
import { haversineMeters } from "#utils/geo.js";

export const SUPPLY_KINDS = ["water", "food", "medicine", "first_aid"];
export const UNITS = { water: "L", food: "ration", medicine: "kit", first_aid: "kit" };

/**
 * Daily needs for `people` from per-person ratios.
 *   500 people × 3 L → 1500 L water, 1000 rations, ceil(500/50) medicine kits…
 */
export const estimateNeeds = (people, ratios) => {
  const n = Math.max(0, Math.round(Number(people) || 0));
  if (!n) return [];
  return [
    { kind: "water", quantity: Math.ceil(n * ratios.waterLitersPerPerson), unit: UNITS.water },
    { kind: "food", quantity: Math.ceil(n * ratios.foodRationsPerPerson), unit: UNITS.food },
    { kind: "medicine", quantity: Math.ceil(n / ratios.medicineKitPerPeople), unit: UNITS.medicine },
    { kind: "first_aid", quantity: Math.ceil(n / ratios.firstAidKitPerPeople), unit: UNITS.first_aid },
  ].filter((i) => i.quantity > 0);
};

/** Total weight (kg) of a list of items. */
export const itemsWeightKg = (items, unitWeightKg) =>
  Math.round(items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (unitWeightKg[i.kind] ?? 1), 0) * 10) / 10;

/**
 * Battery (%) needed for a round trip base → target → base carrying
 * `loadKg` on the outbound leg only.
 */
export const tripBatteryPct = ({ distanceKm, loadKg, capacityKg }, battery) => {
  const share = capacityKg > 0 ? Math.min(1, loadKg / capacityKg) : 0;
  const outbound = distanceKm * battery.perKm * (1 + battery.loadFactor * share);
  const inbound = distanceKm * battery.perKm;
  return Math.round((outbound + inbound) * 10) / 10;
};

/** ETA (s) from now: ground handling + flight time. */
export const etaSec = ({ distanceKm, speedKmh, loadingSec = 0 }) =>
  Math.round(loadingSec + (speedKmh > 0 ? (distanceKm / speedKmh) * 3600 : Infinity));

/**
 * Rank drones for a delivery. Eligible = idle, payload > 0, battery for
 * the round trip + reserve, within range. Payload ≥ remaining weight is
 * preferred; otherwise the drone carries a partial load (more trips).
 *
 * @returns {{ best, ranked: [{ drone, eligible, reason?, score, loadKg, distanceKm, batteryNeededPct, etaSec, fullLoad }] }}
 */
export const selectDrone = (drones, { target, weightKg }, cfg) => {
  const ranked = drones.map((drone) => {
    const distanceKm = haversineMeters(drone.location, target) / 1000;
    const loadKg = Math.min(weightKg, drone.payloadKg);
    const fullLoad = drone.payloadKg >= weightKg;
    const batteryNeededPct = tripBatteryPct({ distanceKm, loadKg, capacityKg: drone.payloadKg }, cfg.battery);
    const eta = etaSec({ distanceKm, speedKmh: drone.speedKmh, loadingSec: cfg.loadingSec });

    let reason = null;
    if (drone.status !== "idle") reason = "busy";
    else if (drone.payloadKg <= 0) reason = "no_payload";
    else if (distanceKm * 2 > drone.rangeKm) reason = "out_of_range";
    else if (drone.batteryPct - batteryNeededPct < cfg.battery.reservePct) reason = "low_battery";

    const w = cfg.selectionWeights;
    const waste = drone.payloadKg > 0 ? 1 - loadKg / drone.payloadKg : 1;
    const score =
      Math.round(
        (distanceKm * w.distance + (100 - drone.batteryPct) * w.battery + waste * w.payloadWaste + (fullLoad ? 0 : 5)) * 1000,
      ) / 1000;

    return {
      drone,
      eligible: !reason,
      reason,
      score,
      loadKg: Math.round(loadKg * 10) / 10,
      distanceKm: Math.round(distanceKm * 100) / 100,
      batteryNeededPct: batteryNeededPct,
      etaSec: eta,
      fullLoad,
    };
  });

  ranked.sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.score - b.score);
  return { best: ranked.find((r) => r.eligible) ?? null, ranked };
};

/**
 * Move `from` toward `to` by speed × dt; battery drains per km flown.
 * Returns the new position, km flown and whether the target was reached.
 */
export const flightStep = ({ from, to, speedKmh, dtSec }) => {
  const totalKm = haversineMeters(from, to) / 1000;
  const stepKm = (speedKmh * dtSec) / 3600;
  if (totalKm <= stepKm || totalKm === 0) return { ...to, km: totalKm, arrived: true };
  const r = stepKm / totalKm;
  return {
    lat: from.lat + (to.lat - from.lat) * r,
    lng: from.lng + (to.lng - from.lng) * r,
    km: stepKm,
    arrived: false,
  };
};
