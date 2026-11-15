import { config } from "#config";
import { CircuitBreaker, haversineMeters } from "#utils";
import { ConfigService } from "./ConfigService.js";
import { routingService } from "./RoutingService.js";

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** Initial bearing (degrees from north) from a → b. */
export const bearingDegrees = (a, b) => {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

const externalBreaker = new CircuitBreaker({ name: "routing.external" });

// ============ PROVIDERS ============

/** 1. External OSRM-compatible API (short timeout + circuit breaker). */
const externalProvider = {
  name: "external",
  enabled: () => Boolean(config.routing.externalUrl),
  async route(origin, target) {
    const { timeoutMs, failureThreshold, resetTimeoutMs } = ConfigService.get("routing").external;
    externalBreaker.configure({ failureThreshold, resetTimeoutMs });

    return externalBreaker.exec(async () => {
      const base = config.routing.externalUrl.replace(/\/$/, "");
      const url = `${base}/route/v1/${config.routing.externalProfile}/${origin.lng},${origin.lat};${target.lng},${target.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`external routing HTTP ${res.status}`);
      const body = await res.json();
      const r = body?.routes?.[0];
      if (!r?.geometry?.coordinates?.length) throw new Error("external routing: no route");
      return {
        nodeIds: [],
        edgeIds: [],
        path: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        distanceMeters: Math.round(r.distance),
        durationSec: Math.round(r.duration),
        roadPenalty: 0,
      };
    });
  },
};

/** 2. Simulated road graph (Dijkstra, honours closures and congestion). */
const graphProvider = {
  name: "graph",
  enabled: () => routingService.nodes.size > 0,
  async route(origin, target) {
    if (!target.nodeId) throw new Error("graph: target has no node");
    const r = routingService.routeFrom(origin, target.nodeId);
    if (!r) throw new Error("graph: unreachable");
    return r;
  },
};

/** 3. Straight line — direction + distance only (always succeeds). */
const straightProvider = {
  name: "straight",
  enabled: () => true,
  async route(origin, target) {
    const distanceMeters = Math.round(haversineMeters(origin, target));
    const bearing = Math.round(bearingDegrees(origin, target));
    const { walkingSpeedKmh } = ConfigService.get("routing");
    return {
      nodeIds: [],
      edgeIds: [],
      path: [
        [origin.lat, origin.lng],
        [target.lat, target.lng],
      ],
      distanceMeters,
      durationSec: Math.round(distanceMeters / ((walkingSpeedKmh * 1000) / 3600)),
      bearing,
      compass: COMPASS[Math.round(bearing / 45) % 8],
      // road state unknown → penalise slightly vs. real routes
      roadPenalty: 3,
    };
  },
};

const PROVIDERS = { external: externalProvider, graph: graphProvider, straight: straightProvider };

/**
 * RouteService — routing with graceful degradation:
 *   external API → simulated road graph → straight line (direction + distance)
 *
 * The order is configurable (crisis.routing.providers). Every result says
 * which provider answered and whether it is approximate, so the citizen can
 * be told "approximate route".
 */
class RouteService {
  static async route(origin, target) {
    const order = ConfigService.get("routing").providers ?? ["external", "graph", "straight"];
    const attempts = [];

    for (const name of order) {
      const provider = PROVIDERS[name];
      if (!provider || !provider.enabled()) continue;
      try {
        const result = await provider.route(origin, target);
        return {
          ...result,
          provider: name,
          approximate: name === "straight",
          fallback: attempts.length > 0,
          attempts,
        };
      } catch (error) {
        attempts.push({ provider: name, error: error.code ?? error.message });
      }
    }

    // The configured chain may exclude "straight" — still never fail.
    const result = await straightProvider.route(origin, target);
    return { ...result, provider: "straight", approximate: true, fallback: true, attempts };
  }

  static status() {
    return {
      providers: ConfigService.get("routing").providers,
      external: {
        configured: externalProvider.enabled(),
        breaker: externalBreaker.status(),
      },
      graph: { nodes: routingService.nodes.size, edges: routingService.edges.size },
    };
  }

  /** For tests. */
  static resetBreakers() {
    externalBreaker.state = "closed";
    externalBreaker.failures = 0;
  }
}

export { RouteService };
