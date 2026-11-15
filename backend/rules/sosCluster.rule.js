import { SosSignal } from "#models";
import { domainEvents } from "#constants";
import { centroid, metersToRadians } from "#utils";
import { evaluateCluster } from "#engine";
import { AlertService } from "#services";

/**
 * Critical crisis rule — SOS cluster.
 *
 * Loads the candidate signals of the sliding window and delegates the decision
 * to the pure `evaluateCluster` (distinct devices; zone and haversine radius
 * checked separately; safe / spam / cancelled excluded). De-duplication and
 * cooldown are handled by AlertService.raiseSosCluster.
 */
// ---- Burst coalescing ------------------------------------------------------
// During a mass event hundreds of SOS arrive per second. Evaluating the whole
// window for every single SOS is O(n²) and competes with the incoming requests.
// Triggers are therefore grouped per zone + ~250 m cell for COALESCE_MS and
// each cell is evaluated once (with its latest trigger). Detection latency
// grows by at most COALESCE_MS; no cell is skipped.
const COALESCE_MS = 120;
const CELL_DEG = 0.0025; // ≈ 250 m
const pending = new Map(); // cellKey → latest trigger
let flushTimer = null;
let flushing = Promise.resolve();

const cellKey = (s) => `${s.zone ?? "-"}:${Math.round(s.lat / CELL_DEG)}:${Math.round(s.lng / CELL_DEG)}`;

const sosClusterRule = {
  id: "sos-cluster",
  name: "rule.sosCluster",
  events: [domainEvents.SOS_CREATED, domainEvents.SOS_UPDATED],
  enabled: true,

  describe: ({ sosCluster: c }) =>
    `Eyni zonada və ya ${c.radiusMeters} m radiusda ${Math.round(c.windowMs / 60000)} dəqiqə ərzində ən azı ${c.minSignals} fərqli cihazdan SOS (cooldown ${Math.round(c.cooldownMs / 60000)} dəq)`,

  async handle({ event, payload, config, rule }) {
    const triggers =
      event === domainEvents.SOS_CREATED
        ? [payload.sos]
        : payload.sos.filter((s) => s.status === "pending" && !s.alert);
    for (const t of triggers) {
      if (t.spamFlagged || t.citizenSafe) continue;
      pending.set(cellKey(t), t);
    }
    if (!pending.size || flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      const batch = [...pending.values()];
      pending.clear();
      // Serialised: one flush at a time (AlertService de-dup relies on it)
      flushing = flushing
        .then(() => sosClusterRule.evaluate({ triggers: batch, config, rule }))
        .catch((e) => console.error("❌ [RuleEngine] rule \"sos-cluster\" failed:", e.message));
    }, COALESCE_MS);
    flushTimer.unref?.();
  },

  /** Evaluate a batch of triggers (one per cell). */
  async evaluate({ triggers, config, rule }) {
    const cfg = config.sosCluster;
    for (const trigger of triggers) {
      if (trigger.spamFlagged || trigger.citizenSafe) continue;

      // Hot path: inside an existing incident's area → attach, done.
      if (await AlertService.attachToIncident(trigger)) continue;

      const now = Date.now();
      // DB pre-filter (same zone OR inside the radius); the pure engine then
      // applies the exact haversine / window / distinct-device rules.
      const area = {
        location: {
          $geoWithin: {
            $centerSphere: [[trigger.lng, trigger.lat], metersToRadians(cfg.radiusMeters * 1.05)],
          },
        },
      };
      const docs = await SosSignal.find({
        createdAt: { $gte: new Date(now - cfg.windowMs), $lte: new Date(now) },
        status: { $in: ["pending", "assigned"] },
        $or: trigger.zone ? [{ zone: trigger.zone }, area] : [area],
      }).limit(5000);

      const result = evaluateCluster({
        signals: docs.map((d) => d.toEngine()),
        trigger: { ...trigger, zone: trigger.zone },
        now,
        cfg,
        excludeSpam: config.sos.spam.excludeFlaggedFromClustering,
      });
      if (!result.triggered) continue;

      await AlertService.raiseSosCluster({
        ruleId: rule.id,
        zoneId: trigger.zone,
        center: centroid(result.signals.map((s) => ({ lat: s.lat, lng: s.lng }))),
        signals: result.signals,
        mode: result.mode,
      });
    }
  },
};

export { sosClusterRule };
