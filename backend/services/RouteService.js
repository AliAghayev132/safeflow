import { config } from "#config";
import { CircuitBreaker, haversineMeters } from "#utils";
import { ConfigService } from "./ConfigService.js";
import { routingService } from "./RoutingService.js";
import { HazardService } from "./HazardService.js";

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

/**
 * Stand-in for the external map / routing API when ROUTING_EXTERNAL_URL is
 * not configured (demo machine). Challenge Drop #2 is demonstrated by
 * switching it to "503" (Service Unavailable) or "timeout" (> 5 s) from the
 * dispatcher's simulation page; the real HTTP provider behaves the same way.
 */
export const ExternalApiSimulator = {
  mode: "ok", // ok | 503 | timeout
  get active() {
    return !config.routing.externalUrl;
  },
  setMode(mode) {
    if (!["ok", "503", "timeout"].includes(mode)) throw new Error("mode: ok | 503 | timeout");
    this.mode = mode;
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Reject after `ms` — a hanging dependency must never hang the citizen. */
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    sleep(ms).then(() => {
      const error = new Error(`external routing timeout after ${ms} ms`);
      error.code = "TIMEOUT";
      throw error;
    }),
  ]);

// ============ PROVIDERS ============

/** 1. External OSRM-compatible API (short timeout + circuit breaker). */
const externalProvider = {
  name: "external",
  // No barrier data from a generic routing API → never used for barrier-free routes
  enabled: (opts) => (Boolean(config.routing.externalUrl) || ExternalApiSimulator.active) && !opts?.accessible,
  async route(origin, target) {
    const { timeoutMs, failureThreshold, resetTimeoutMs } = ConfigService.get("routing").external;
    externalBreaker.configure({ failureThreshold, resetTimeoutMs });

    if (ExternalApiSimulator.active) {
      return externalBreaker.exec(() =>
        withTimeout(
          (async () => {
            if (ExternalApiSimulator.mode === "503") {
              const error = new Error("external routing HTTP 503 Service Unavailable");
              error.code = "HTTP_503";
              throw error;
            }
            await sleep(ExternalApiSimulator.mode === "timeout" ? 6000 : 15);
            const r = target.nodeId ? routingService.routeFrom(origin, target.nodeId, {}) : null;
            if (!r) throw new Error("external routing: no route");
            return r;
          })(),
          timeoutMs,
        ),
      );
    }

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
  async route(origin, target, opts = {}) {
    if (!target.nodeId) throw new Error("graph: target has no node");
    const r = routingService.routeFrom(origin, target.nodeId, {
      accessible: Boolean(opts.accessible),
      blocked: opts.accessible ? HazardService.blockedEdges() : undefined,
    });
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
  /**
   * @param {object} [opts]
   * @param {boolean} [opts.accessible] barrier-free route (wheelchair / stretcher)
   */
  static async route(origin, target, opts = {}) {
    const order = ConfigService.get("routing").providers ?? ["external", "graph", "straight"];
    const attempts = [];

    for (const name of order) {
      const provider = PROVIDERS[name];
      if (!provider || !provider.enabled(opts)) continue;
      try {
        const result = await provider.route(origin, target, opts);
        return {
          ...result,
          provider: name,
          approximate: name === "straight",
          // A straight line says nothing about stairs / debris on the way
          accessibleUnverified: Boolean(opts.accessible) && name !== "graph",
          fallback: attempts.length > 0,
          attempts,
        };
      } catch (error) {
        attempts.push({ provider: name, error: error.code ?? error.message });
      }
    }

    // The configured chain may exclude "straight" — still never fail.
    const result = await straightProvider.route(origin, target);
    return {
      ...result,
      provider: "straight",
      approximate: true,
      fallback: true,
      accessibleUnverified: Boolean(opts.accessible),
      attempts,
    };
  }

  static status() {
    return {
      providers: ConfigService.get("routing").providers,
      external: {
        configured: externalProvider.enabled(),
        simulated: ExternalApiSimulator.active,
        simulatorMode: ExternalApiSimulator.active ? ExternalApiSimulator.mode : null,
        breaker: externalBreaker.status(),
      },
      graph: { nodes: routingService.nodes.size, edges: routingService.edges.size },
    };
  }

  /** For tests. */
  static resetBreakers() {
    externalBreaker.state = "closed";
    externalBreaker.failures = 0;
    ExternalApiSimulator.mode = "ok";
  }
}

export { RouteService };
