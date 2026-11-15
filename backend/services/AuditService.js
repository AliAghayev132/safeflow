import { AuditLog } from "#models";

/**
 * Append-only audit trail of every operator action.
 */
class AuditService {
  /**
   * @param {object} p
   * @param {object} [p.operator]  Operator document (null → "system")
   * @param {string}  p.action     e.g. "alert.approve", "brigade.status"
   * @param {object} [p.target]    { type, id, label }
   * @param {object} [p.details]
   * @param {string} [p.ip]
   */
  static async record({ operator, action, target = {}, details = {}, ip = null }) {
    const entry = await AuditLog.create({
      actor: operator
        ? { id: operator._id, username: operator.username, role: operator.role }
        : { id: null, username: "system", role: "system" },
      action,
      target: {
        type: target.type ?? null,
        id: target.id ? String(target.id) : null,
        label: target.label ?? null,
      },
      details,
      ip,
    });
    return entry;
  }

  /** Convenience for controllers: pulls operator + ip from the request. */
  static fromRequest(req, action, target, details) {
    return AuditService.record({
      operator: req.operator,
      action,
      target,
      details,
      ip: req.ip,
    });
  }

  static async list({ action, actor, from, to, limit = 100, before } = {}) {
    const filter = {};
    if (action) filter.action = action;
    if (actor) filter["actor.username"] = String(actor).toLowerCase();
    if (from || to || before) {
      filter.at = {};
      if (from) filter.at.$gte = new Date(from);
      if (to) filter.at.$lte = new Date(to);
      if (before) filter.at.$lt = new Date(before);
    }
    const rows = await AuditLog.find(filter)
      .sort({ at: -1 })
      .limit(Math.min(500, Math.max(1, Number(limit) || 100)));
    return rows.map((r) => r.toPublic());
  }
}

export { AuditService };
