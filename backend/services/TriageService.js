import { SosSignal } from "#models";
import { sosTypeToBrigadeType, domainEvents } from "#constants";
import { eventBus } from "./EventBus.js";
import { priorityScore } from "#engine";
import { AppError, fromPoint } from "#utils";
import { ConfigService } from "./ConfigService.js";
import { BrigadeService } from "./BrigadeService.js";

/**
 * Dispatcher triage: priority score, brigade auto-recommendation and the
 * one-click "Confirm" assignment.
 */
class TriageService {
  /** Recompute and store priority on an SOS document (not saved). */
  static applyPriority(sos) {
    const { score, breakdown, priorityOne } = priorityScore(sos, ConfigService.get("triage"));
    sos.priority = score;
    sos.priorityBreakdown = breakdown;
    sos.priorityOne = priorityOne;
    return score;
  }

  /**
   * High-priority, non-spam, pending SOS get the nearest available brigade
   * of the matching type as a recommendation (not dispatched yet).
   */
  static async applyRecommendation(sos) {
    const { autoAssignMinScore } = ConfigService.get("triage");
    if (sos.status !== "pending" || sos.spamFlagged || sos.citizenSafe) {
      sos.recommendedBrigade = null;
      sos.brigadeSuggestion = null;
      return null;
    }
    // Priority #1 always gets a brigade recommendation
    if (sos.priority < autoAssignMinScore && !sos.priorityOne) {
      sos.recommendedBrigade = null;
      return null;
    }
    const target = fromPoint(sos.location);
    const preferred = sosTypeToBrigadeType[sos.type];
    if (ConfigService.isEnabled("brigadeSuggestion")) {
      // ETA-ranked suggestion; soonest-free brigade when nobody is available
      const s = BrigadeService.suggest(target, preferred);
      sos.brigadeSuggestion = s;
      sos.recommendedBrigade = s.suggestion?.brigadeId ?? null;
      return s.suggestion;
    }
    const brigade = await BrigadeService.findNearestAvailable(target, preferred);
    sos.brigadeSuggestion = null;
    sos.recommendedBrigade = brigade?._id ?? null;
    return brigade;
  }

  /** Active queue, highest priority first (then oldest). */
  static async queue({ limit = 200 } = {}) {
    const rows = await SosSignal.find({ status: { $in: ["pending", "assigned"] } })
      .sort({ priority: -1, createdAt: 1 })
      .limit(limit);
    return rows.map((s) => s.toPublic());
  }

  /**
   * Confirm: dispatch the given (or recommended, or nearest) brigade to the
   * SOS location and mark the ticket assigned.
   */
  static async assign(sosId, { brigadeId } = {}) {
    const sos = await SosSignal.findById(sosId);
    if (!sos) throw AppError.notFound("SOS tapılmadı");
    if (!["pending", "assigned"].includes(sos.status)) {
      throw AppError.conflict("Bu SOS artıq bağlanıb");
    }
    const origin = fromPoint(sos.location);

    let brigade = null;
    const candidateId = brigadeId ?? sos.recommendedBrigade;
    if (candidateId) {
      brigade = await BrigadeService.getById(candidateId);
      if (brigade.status !== "available") {
        if (brigadeId) throw AppError.conflict(`${brigade.name} hazırda boş deyil`);
        brigade = null;
      }
    }
    if (!brigade) {
      brigade = await BrigadeService.findNearestAvailable(origin, sosTypeToBrigadeType[sos.type]);
    }
    if (!brigade) throw AppError.conflict("Boş briqada yoxdur");

    brigade = await BrigadeService.dispatch(brigade._id, origin, sos.alert ?? null);

    sos.status = "assigned";
    sos.brigade = brigade._id;
    sos.recommendedBrigade = null;
    await sos.save();
    eventBus.publish(domainEvents.SOS_UPDATED, { sos: [sos.toPublic()] });
    return { sos, brigade };
  }
}

export { TriageService };
