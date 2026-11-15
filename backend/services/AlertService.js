import { mongoose } from "#lib";
import { Alert, Zone, SosSignal } from "#models";
import { domainEvents, sosTypeToBrigadeType } from "#constants";
import { AppError, toPoint, fromPoint, metersToRadians } from "#utils";
import { decideClusterAlert } from "#engine";
import { eventBus } from "./EventBus.js";
import { ConfigService } from "./ConfigService.js";
import { BrigadeService } from "./BrigadeService.js";
import { ShelterService } from "./ShelterService.js";
import { SosService } from "./SosService.js";

const SOS_LABELS = {
  fire: "Yanğın",
  collapse: "Dağıntı",
  flood: "Su basması",
  medical: "Tibbi yardım",
  general: "Ümumi SOS",
};

const mostCommon = (values) => {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

const publish = (event, alert) =>
  eventBus.publish(event, { alert: alert.toPublic() });

/**
 * Red alerts raised by the crisis rule engine and the one-click decision flow.
 *
 * Every alert carries the recommended actions:
 *   - dispatch_brigade: send an extra rescue brigade
 *   - open_shelter:     open a new (reserve) assembly point
 * Approving the alert executes all of them.
 */
class AlertService {
  static list({ status, limit = 50 } = {}) {
    const filter = status ? { status } : {};
    return Alert.find(filter).sort({ createdAt: -1 }).limit(limit);
  }

  static async getById(id) {
    const alert = await Alert.findById(id);
    if (!alert) throw AppError.notFound("Həyəcan tapılmadı");
    return alert;
  }

  /** Recommended actions around a point. */
  static async #buildActions(center, brigadeType) {
    const actions = [];

    // Auto-suggestion (flag brigadeSuggestion): best free brigade + ETA,
    // alternatives, or the soonest-free one when nobody is available.
    const smart = ConfigService.isEnabled("brigadeSuggestion");
    const suggestion = smart ? BrigadeService.suggest(center, brigadeType) : null;
    const brigade = smart
      ? suggestion.suggestion && { _id: suggestion.suggestion.brigadeId, name: suggestion.suggestion.name }
      : await BrigadeService.findNearestAvailable(center, brigadeType);
    const eta = suggestion?.suggestion
      ? ` (~${Math.max(1, Math.round(suggestion.suggestion.etaSec / 60))} dəq)`
      : "";
    actions.push({
      type: "dispatch_brigade",
      label: brigade
        ? `Əlavə xilasetmə briqadası göndər: ${brigade.name}${eta}`
        : "Əlavə xilasetmə briqadası göndər (hazırda boş briqada yoxdur)",
      brigade: brigade?._id ?? null,
      brigadeType,
      suggestion,
    });

    const reserve = await ShelterService.findReserveNear(center);
    if (reserve) {
      actions.push({
        type: "open_shelter",
        label: `Yeni toplanış nöqtəsi aç: ${reserve.name}`,
        shelter: reserve._id,
      });
    }
    return actions;
  }

  // ============ CLUSTER INCIDENT ATTACHMENT (hot path) ============

  static #publishTimers = new Map();

  /** Coalesce ALERT_UPDATED for a busy incident to at most one per second. */
  static #schedulePublish(alertId) {
    const key = String(alertId);
    if (AlertService.#publishTimers.has(key)) return;
    const timer = setTimeout(async () => {
      AlertService.#publishTimers.delete(key);
      try {
        const alert = await Alert.findById(alertId);
        if (!alert) return;
        // Distinct genuine devices: retro-flagged spam and "I am safe" don't count
        const devices = await SosSignal.distinct("deviceId", {
          alert: alert._id,
          spamFlagged: false,
          citizenSafe: false,
        });
        const count = devices.length;
        const cfg = ConfigService.get("sosCluster");
        const windowMin = Math.round(cfg.windowMs / 60000);
        const hazard = alert.i18n?.params?.hazard;
        const message = `Son ${windowMin} dəqiqədə ${count} fərqli vətəndaşdan SOS siqnalı (${cfg.radiusMeters} m radius). Üstünlük təşkil edən təhlükə: ${SOS_LABELS[hazard] ?? "—"}.`;
        await Alert.collection.updateOne(
          { _id: alert._id },
          { $set: { message, signalCount: count, "i18n.params.count": count, updatedAt: new Date() } },
        );
        alert.message = message;
        alert.signalCount = count;
        if (alert.i18n?.params) alert.i18n.params.count = count;
        publish(domainEvents.ALERT_UPDATED, alert);
      } catch (error) {
        console.error("❌ [Alert] publish failed:", error.message);
      }
    }, 1000);
    timer.unref?.();
    AlertService.#publishTimers.set(key, timer);
  }

  /**
   * Link signals to an incident. Only the (indexed) SosSignal.alert reference
   * is written — the alert document stays small; its distinct-device count is
   * recomputed in the coalesced publish.
   */
  static async #attach(alertId, signals) {
    const ids = signals.map((s) => new mongoose.Types.ObjectId(String(s.id)));
    await SosSignal.updateMany({ _id: { $in: ids }, alert: null }, { $set: { alert: alertId } });
    AlertService.#schedulePublish(alertId);
  }

  /** All open signals of an incident. */
  static #memberIds(alert, statuses) {
    return SosSignal.find({ alert: alert._id, status: { $in: statuses } }).distinct("_id");
  }

  /**
   * Fast path for the cluster rule: an SOS inside the area of an active (or
   * recently decided, within cooldown) incident is attached to it directly —
   * the same outcome `decideClusterAlert` gives ("update" / "attach"),
   * without re-reading the whole window.
   */
  static async attachToIncident(trigger) {
    const cfg = ConfigService.get("sosCluster");
    const now = Date.now();
    const alert = await Alert.findOne({
      type: "sos_cluster",
      $and: [
        {
          $or: [
            { status: "active" },
            { decidedAt: { $gte: new Date(now - cfg.cooldownMs) } },
          ],
        },
        {
          $or: [
            ...(trigger.zone ? [{ zone: trigger.zone }] : []),
            {
              location: {
                $geoWithin: {
                  $centerSphere: [[trigger.lng, trigger.lat], metersToRadians(cfg.radiusMeters)],
                },
              },
            },
          ],
        },
      ],
    }).sort({ createdAt: -1 });
    if (!alert) return null;
    await AlertService.#attach(alert._id, [trigger]);
    return alert;
  }

  /** Rule: >= N distinct SOS in the window within a zone / radius. */
  static async raiseSosCluster({ ruleId, zoneId, center, signals, mode }) {
    const cfg = ConfigService.get("sosCluster");
    const windowMin = Math.round(cfg.windowMs / 60000);
    const devices = new Set(signals.map((s) => s.deviceId));
    const signalIds = signals.map((s) => s.id);
    const dominant = mostCommon(signals.map((s) => s.type));
    const now = Date.now();

    // De-duplicate: update the active alert / attach within cooldown / create
    const recent = await Alert.find({
      type: "sos_cluster",
      $or: [
        { status: "active" },
        { decidedAt: { $gte: new Date(now - cfg.cooldownMs) } },
        { createdAt: { $gte: new Date(now - cfg.cooldownMs) } },
      ],
    });
    const decision = decideClusterAlert({
      alerts: recent.map((a) => ({ ...a.toPublic(), _doc: a })),
      zone: zoneId,
      center,
      now,
      cfg,
    });

    const i18nFor = (count) => ({
      titleKey: "alert.sosCluster.title",
      messageKey: "alert.sosCluster.message",
      params: { count, windowMin, radius: cfg.radiusMeters, hazard: dominant, mode },
    });
    const messageFor = (count) =>
      `Son ${windowMin} dəqiqədə ${count} fərqli vətəndaşdan SOS siqnalı (${cfg.radiusMeters} m radius). Üstünlük təşkil edən təhlükə: ${SOS_LABELS[dominant] ?? "—"}.`;

    if (decision.action !== "create") {
      const existing = decision.alert._doc;
      await AlertService.#attach(existing._id, signals);
      return existing;
    }

    const zone = zoneId ? await Zone.findById(zoneId) : null;
    const actions = await AlertService.#buildActions(
      center,
      sosTypeToBrigadeType[dominant],
    );
    const i18n = i18nFor(devices.size);
    i18n.params.zone = zone?.name ?? null;

    const alert = await Alert.create({
      type: "sos_cluster",
      ruleId,
      severity: "critical",
      title: `Kritik SOS klasteri — ${zone?.name ?? "naməlum zona"}`,
      message: messageFor(devices.size),
      i18n,
      zone: zone?._id ?? null,
      location: toPoint(center.lat, center.lng),
      sosSignals: signalIds.slice(0, 50),
      signalCount: devices.size,
      actions,
    });

    await SosService.setStatusMany(signalIds, { alert: alert._id });
    publish(domainEvents.ALERT_CREATED, alert);
    return alert;
  }

  /** Rule: a shelter's occupancy crossed the alert threshold. */
  static async raiseShelterOverload({ ruleId, shelter }) {
    const existing = await Alert.findOne({
      type: "shelter_overload",
      status: "active",
      shelter: shelter.id,
    });
    if (existing) return existing;

    const center = { lat: shelter.lat, lng: shelter.lng };
    const actions = await AlertService.#buildActions(center, "rescue");
    const percent = Math.round(shelter.occupancyRate * 100);

    const alert = await Alert.create({
      type: "shelter_overload",
      ruleId,
      severity: "critical",
      title: `Toplanış məntəqəsi ${percent}% dolub — ${shelter.name}`,
      message: `${shelter.name} doluluğu ${Math.round(ConfigService.get("shelter").alertThreshold * 100)}% həddini keçdi (${shelter.occupancy}/${shelter.capacity}). Yeni məntəqə açılması və izdihamın idarəsi üçün briqada tövsiyə olunur.`,
      i18n: {
        titleKey: "alert.shelterOverload.title",
        messageKey: "alert.shelterOverload.message",
        params: {
          percent,
          shelter: shelter.name,
          threshold: Math.round(ConfigService.get("shelter").alertThreshold * 100),
          occupancy: shelter.occupancy,
          capacity: shelter.capacity,
        },
      },
      zone: shelter.zone,
      shelter: shelter.id,
      location: toPoint(center.lat, center.lng),
      actions,
    });

    publish(domainEvents.ALERT_CREATED, alert);
    return alert;
  }

  /** One-click approval: execute every recommended action. */
  /**
   * @param {object} [choice] { brigadeId } — dispatcher picked another brigade
   *   from the suggested alternatives instead of the recommended one.
   */
  static async approve(id, operator, choice = {}) {
    const alert = await AlertService.getById(id);
    if (alert.status !== "active") {
      throw AppError.conflict("Bu həyəcan artıq emal olunub");
    }
    const center = fromPoint(alert.location);

    for (const action of alert.actions) {
      try {
        if (action.type === "dispatch_brigade") {
          const chosen = choice.brigadeId ?? action.brigade;
          let brigade = chosen ? await BrigadeService.getById(chosen).catch(() => null) : null;
          if (choice.brigadeId && brigade && brigade.status !== "available") {
            throw AppError.conflict(`${brigade.name} hazırda boş deyil`, "BRIGADE_BUSY");
          }
          if (!brigade || brigade.status !== "available") {
            brigade = await BrigadeService.findNearestAvailable(
              center,
              action.brigadeType,
            );
          }
          if (!brigade) {
            action.result = "Boş briqada tapılmadı";
            continue;
          }
          await BrigadeService.dispatch(brigade._id, center, alert._id);
          action.brigade = brigade._id;
          action.executed = true;
          action.result = `${brigade.name} yola düşdü`;

          const pending = await AlertService.#memberIds(alert, ["pending"]);
          if (pending.length) {
            await SosService.setStatusMany(pending, { status: "assigned", brigade: brigade._id });
          }
        }

        if (action.type === "open_shelter" && action.shelter) {
          const shelter = await ShelterService.activate(action.shelter);
          action.executed = true;
          action.result = `${shelter.name} açıldı`;
        }
      } catch (error) {
        action.result = error.message;
      }
    }

    alert.status = "approved";
    alert.decidedBy = operator?._id ?? null;
    alert.decidedAt = new Date();
    await alert.save();
    publish(domainEvents.ALERT_UPDATED, alert);
    return alert;
  }

  static async reject(id, operator) {
    const alert = await AlertService.getById(id);
    if (alert.status !== "active") {
      throw AppError.conflict("Bu həyəcan artıq emal olunub");
    }
    alert.status = "rejected";
    alert.decidedBy = operator?._id ?? null;
    alert.decidedAt = new Date();
    await alert.save();
    publish(domainEvents.ALERT_UPDATED, alert);
    return alert;
  }

  /** Close the incident: linked SOS signals are resolved. */
  static async resolve(id) {
    const alert = await AlertService.getById(id);
    if (alert.status === "resolved") return alert;
    alert.status = "resolved";
    alert.resolvedAt = new Date();
    await alert.save();
    const open = await AlertService.#memberIds(alert, ["pending", "assigned"]);
    if (open.length) await SosService.setStatusMany(open, { status: "resolved" });
    publish(domainEvents.ALERT_UPDATED, alert);
    return alert;
  }
}

export { AlertService, SOS_LABELS };
