import { RoadNode, RoadEdge } from "#models";
import { haversineMeters, MinHeap } from "#utils";
import { ConfigService } from "./ConfigService.js";

/**
 * RoutingService (singleton) — the simulated road network.
 *
 * Keeps the road graph in memory and answers shortest-path queries with
 * Dijkstra. Closed edges are skipped; congested edges cost more. It is the
 * "simulation" provider in RouteService's fallback chain.
 */
class RoutingService {
  constructor() {
    this.nodes = new Map(); // nodeId -> { id, lat, lng }
    this.edges = new Map(); // edgeId -> edge
    this.adjacency = new Map(); // nodeId -> edge[]
  }

  async load() {
    const [nodes, edges] = await Promise.all([
      RoadNode.find().lean(),
      RoadEdge.find().lean(),
    ]);

    this.nodes.clear();
    this.edges.clear();
    this.adjacency.clear();

    for (const n of nodes) {
      this.nodes.set(n.nodeId, {
        id: n.nodeId,
        lat: n.location.coordinates[1],
        lng: n.location.coordinates[0],
      });
      this.adjacency.set(n.nodeId, []);
    }
    for (const e of edges) this.#addEdge(e);
  }

  #addEdge(e) {
    const edge = {
      edgeId: e.edgeId,
      from: e.from,
      to: e.to,
      name: e.name,
      lengthMeters: e.lengthMeters,
      status: e.status,
      congestion: e.congestion ?? 0,
      stairs: Boolean(e.stairs),
      steepSlope: Boolean(e.steepSlope),
      obstacle: Boolean(e.obstacle),
      damaged: Boolean(e.damaged),
    };
    this.edges.set(edge.edgeId, edge);
    this.adjacency.get(edge.from)?.push(edge);
    this.adjacency.get(edge.to)?.push(edge);
  }

  /** Keep the in-memory graph in sync after a DB update. */
  updateEdge(edgeId, patch) {
    const edge = this.edges.get(edgeId);
    if (edge) Object.assign(edge, patch);
  }

  getEdge(edgeId) {
    return this.edges.get(edgeId) ?? null;
  }

  #weight(edge) {
    const { congestionPenalty } = ConfigService.get("routing");
    return edge.lengthMeters * (1 + edge.congestion * congestionPenalty);
  }

  nearestNode(point) {
    let best = null;
    let bestDistance = Infinity;
    for (const node of this.nodes.values()) {
      const d = haversineMeters(point, node);
      if (d < bestDistance) {
        best = node;
        bestDistance = d;
      }
    }
    return best ? { node: best, distance: bestDistance } : null;
  }

  /** Barrier that makes a segment unusable for wheelchairs / stretchers. */
  static barrierOf(edge, blocked) {
    if (edge.stairs) return "stairs";
    if (edge.steepSlope) return "steepSlope";
    if (edge.obstacle) return "obstacle";
    if (edge.damaged) return "damaged";
    if (blocked?.has(edge.edgeId)) return "damageZone";
    return null;
  }

  /**
   * Dijkstra between two nodes. Returns null when unreachable.
   * opts.accessible → barrier-free: skip stairs, steep slopes, obstacles,
   * damaged segments and segments inside structural-damage zones (opts.blocked).
   */
  shortestPath(fromId, toId, opts = {}) {
    const avoided = new Map(); // edgeId → barrier kind
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return null;

    const dist = new Map([[fromId, 0]]);
    const prev = new Map();
    const visited = new Set();
    const heap = new MinHeap();
    heap.push(0, fromId);

    while (heap.size) {
      const { priority: d, value: u } = heap.pop();
      if (visited.has(u)) continue;
      visited.add(u);
      if (u === toId) break;

      for (const edge of this.adjacency.get(u) ?? []) {
        if (edge.status === "closed") continue;
        if (opts.accessible) {
          const barrier = RoutingService.barrierOf(edge, opts.blocked);
          if (barrier) {
            avoided.set(edge.edgeId, barrier);
            continue;
          }
        }
        const v = edge.from === u ? edge.to : edge.from;
        if (visited.has(v)) continue;
        const nd = d + this.#weight(edge);
        if (nd < (dist.get(v) ?? Infinity)) {
          dist.set(v, nd);
          prev.set(v, { node: u, edge });
          heap.push(nd, v);
        }
      }
    }

    if (!dist.has(toId)) return null;

    const nodeIds = [toId];
    const edgeIds = [];
    let lengthMeters = 0;
    let congestedMeters = 0;
    let current = toId;
    while (current !== fromId) {
      const step = prev.get(current);
      edgeIds.unshift(step.edge.edgeId);
      lengthMeters += step.edge.lengthMeters;
      congestedMeters += step.edge.lengthMeters * step.edge.congestion;
      nodeIds.unshift(step.node);
      current = step.node;
    }

    const avoidedCounts = {};
    for (const kind of avoided.values()) avoidedCounts[kind] = (avoidedCounts[kind] ?? 0) + 1;
    return { nodeIds, edgeIds, lengthMeters, congestedMeters, cost: dist.get(toId), avoided: avoidedCounts };
  }

  /**
   * Route from an arbitrary point (snapped to the nearest intersection) to a
   * target node. Duration is a walking estimate inflated by congestion.
   */
  routeFrom(origin, targetNodeId, opts = {}) {
    if (!this.nodes.size) return null;
    const snap = this.nearestNode(origin);
    if (!snap) return null;

    const result = this.shortestPath(snap.node.id, targetNodeId, opts);
    if (!result) return null;

    const { walkingSpeedKmh } = ConfigService.get("routing");
    const speed = (walkingSpeedKmh * 1000) / 3600;
    const distanceMeters = snap.distance + result.lengthMeters;
    const congestionExtra = result.cost - result.lengthMeters;

    return {
      nodeIds: result.nodeIds,
      edgeIds: result.edgeIds,
      path: [
        [origin.lat, origin.lng],
        ...result.nodeIds.map((id) => {
          const n = this.nodes.get(id);
          return [n.lat, n.lng];
        }),
      ],
      distanceMeters: Math.round(distanceMeters),
      durationSec: Math.round((distanceMeters + congestionExtra) / speed),
      // congestion-weighted km on the route → road_status_penalty
      roadPenalty: Math.round((result.congestedMeters / 1000) * 1000) / 1000,
      accessible: Boolean(opts.accessible),
      barriersAvoided: opts.accessible ? result.avoided : undefined,
    };
  }

  /** Full network with coordinates, for map rendering. */
  getNetwork() {
    return {
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()].map((e) => {
        const a = this.nodes.get(e.from);
        const b = this.nodes.get(e.to);
        return { ...e, path: [[a.lat, a.lng], [b.lat, b.lng]] };
      }),
    };
  }
}

const routingService = new RoutingService();

export { RoutingService, routingService };
