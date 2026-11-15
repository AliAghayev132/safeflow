import { Zone } from "#models";
import { haversineMeters } from "#utils";

/** Ray-casting point-in-polygon on a GeoJSON ring ([lng, lat] pairs). */
const insideRing = (lng, lat, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/**
 * City zones — small, static data held in memory (reloaded on reseed).
 * Zone resolution is a pure in-process point-in-polygon test: no DB round
 * trip on the SOS hot path.
 */
class ZoneService {
  static #zones = [];

  static async load() {
    ZoneService.#zones = await Zone.find().sort({ name: 1 });
    return ZoneService.#zones;
  }

  static list() {
    return ZoneService.#zones;
  }

  static findByCode(code) {
    const c = String(code).toUpperCase();
    return ZoneService.#zones.find((z) => z.code === c) ?? null;
  }

  /** Zone that contains the point, or the nearest zone center as fallback. */
  static resolve(origin) {
    if (!ZoneService.#zones.length) return null;
    const hit = ZoneService.#zones.find((z) =>
      insideRing(origin.lng, origin.lat, z.area.coordinates[0]),
    );
    if (hit) return hit;
    let best = null;
    let bestD = Infinity;
    for (const z of ZoneService.#zones) {
      const d = haversineMeters(origin, {
        lat: z.center.coordinates[1],
        lng: z.center.coordinates[0],
      });
      if (d < bestD) {
        best = z;
        bestD = d;
      }
    }
    return best;
  }
}

export { ZoneService };
