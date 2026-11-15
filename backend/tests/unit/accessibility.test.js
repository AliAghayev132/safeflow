import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { RoutingService } from "#services/RoutingService.js";
import { priorityScore, isPriorityOne, scoreShelter, rankShelters, explainChoice } from "#engine";
import defaults from "../../config/defaults/crisis.json" with { type: "json" };

/**
 * A ── B ── C        A→C direct via B uses a stairs segment (B–C).
 * |         |        The barrier-free route must detour A→D→E→C.
 * D ─────── E
 */
const graph = () => {
  const r = new RoutingService();
  const nodes = { A: [40.4, 49.8], B: [40.4, 49.81], C: [40.4, 49.82], D: [40.39, 49.8], E: [40.39, 49.82] };
  for (const [id, [lat, lng]] of Object.entries(nodes)) {
    r.nodes.set(id, { id, lat, lng });
    r.adjacency.set(id, []);
  }
  const edge = (from, to, len, extra = {}) => {
    const e = { edgeId: `${from}${to}`, from, to, name: `${from}${to}`, lengthMeters: len, status: "open", congestion: 0, ...extra };
    r.edges.set(e.edgeId, e);
    r.adjacency.get(from).push(e);
    r.adjacency.get(to).push(e);
  };
  edge("A", "B", 800);
  edge("B", "C", 800, { stairs: true });
  edge("A", "D", 1100);
  edge("D", "E", 1700);
  edge("E", "C", 1100);
  return r;
};

describe("barrier-free routing (Dijkstra)", () => {
  test("regular route takes the short path through the stairs", () => {
    const p = graph().shortestPath("A", "C");
    assert.deepEqual(p.edgeIds, ["AB", "BC"]);
  });

  test("accessible route avoids stairs and reports what it avoided", () => {
    const p = graph().shortestPath("A", "C", { accessible: true });
    assert.deepEqual(p.edgeIds, ["AD", "DE", "EC"]);
    assert.equal(p.avoided.stairs, 1);
  });

  test("structural-damage zones block segments for accessible routes", () => {
    const p = graph().shortestPath("A", "C", { accessible: true, blocked: new Set(["DE"]) });
    assert.equal(p, null, "only remaining path has stairs → unreachable barrier-free");
  });

  test("damaged / obstacle / steep segments are avoided too", () => {
    for (const kind of ["damaged", "obstacle", "steepSlope"]) {
      const r = graph();
      r.edges.get("BC").stairs = false;
      r.edges.get("BC")[kind] = true;
      assert.deepEqual(r.shortestPath("A", "C", { accessible: true }).edgeIds, ["AD", "DE", "EC"], kind);
    }
  });
});

describe("Priority #1 (limited mobility / special care)", () => {
  const cfg = defaults.triage;
  test("wheelchair or limited mobility → priorityOne and above any other case", () => {
    const vip = priorityScore({ type: "flood", accessibility: { wheelchair: true } }, cfg);
    const worst = priorityScore(
      { type: "medical", headcount: 20, vulnerable: { elderly: true, child: true, disabled: true }, injuries: "x", needs: ["a", "b", "c"] },
      cfg,
    );
    assert.equal(vip.priorityOne, true);
    assert.ok(vip.score > worst.score);
    assert.ok(isPriorityOne({ accessibility: { limitedMobility: true } }));
  });

  test("speech / hearing / vision impairment raise priority but are not Priority #1", () => {
    const base = priorityScore({ type: "fire" }, cfg);
    const deaf = priorityScore({ type: "fire", accessibility: { hearingImpaired: true, speechImpaired: true } }, cfg);
    assert.equal(deaf.priorityOne, false);
    assert.equal(deaf.score - base.score, 2 * cfg.weights.accessibility);
  });
});

describe("smart balancing", () => {
  const cfg = { weights: defaults.routing.weights, shelter: defaults.shelter };
  test("people already on the way make a shelter less attractive", () => {
    const quiet = scoreShelter({ distanceMeters: 1000, occupancyRate: 0.4, capacity: 1000, pendingArrivals: 0 }, cfg);
    const busy = scoreShelter({ distanceMeters: 1000, occupancyRate: 0.4, capacity: 1000, pendingArrivals: 400 }, cfg);
    assert.ok(busy.score > quiet.score);
  });

  test("medical needs prefer a shelter with a medical point", () => {
    const withPoint = scoreShelter({ distanceMeters: 1200, occupancyRate: 0.4, needs: { medical: true }, medicalPoint: true }, cfg);
    const without = scoreShelter({ distanceMeters: 1000, occupancyRate: 0.4, needs: { medical: true }, medicalPoint: false }, cfg);
    assert.ok(withPoint.score < without.score);
  });

  test("unsuitable (no step-free entrance) ranks last even with the best score", () => {
    const ranked = rankShelters([
      { id: "stairs", unsuitable: "notAccessible", isFull: false, score: 0.1 },
      { id: "ok", unsuitable: null, isFull: false, score: 9 },
    ]);
    assert.equal(ranked[0].id, "ok");
  });

  test("explanation: nearest is full → says so with minutes and rates", () => {
    const opt = (id, name, min, rate, extra = {}) => ({
      shelter: { id, name, occupancyRate: rate },
      durationSec: min * 60,
      isFull: rate >= 0.9,
      scoreParts: {},
      ...extra,
    });
    const options = [opt("near", "Yaxın", 3, 0.88), opt("far", "Uzaq", 7, 0.4)];
    const exp = explainChoice(options, "far");
    assert.equal(exp.key, "balancing.nearestFull");
    assert.deepEqual(
      { nearest: exp.params.nearest, nearestRate: exp.params.nearestRate, extra: exp.params.extraMinutes, rate: exp.params.rate },
      { nearest: "Yaxın", nearestRate: 88, extra: 4, rate: 40 },
    );
    assert.equal(explainChoice(options, "near").key, "balancing.nearest");
  });
});
