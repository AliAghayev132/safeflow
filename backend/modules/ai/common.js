import { RealtimeService } from "#services/RealtimeService.js";
import { AuditService } from "#services/AuditService.js";

/** Realtime events of the AI modules (channels from config/rbac.json). */
export const AI_EVENTS = {
  DAMAGE_ASSESSED: "ai:damage", // channel `damage` (ai:damage)
  FORECAST_UPDATED: "ai:forecast", // channel `ai` (ai:forecast)
  SUPPLY_PLAN_UPDATED: "ai:supply-plan", // channel `ai`
  VOICE_PARSED: "ai:voice", // device channel — enrichment of a voice SOS
};

export const publish = (type, data, channel) => RealtimeService.publish({ type, data, channel });
export const publishToDevice = (type, data, deviceId) => RealtimeService.publish({ type, data, deviceId });

/**
 * Audit helper. Staff requests are attributed to the operator; citizen
 * requests to a truncated device id (no full identifier in the log).
 */
export const audit = (req, action, target, details = {}) => {
  if (req.operator) return AuditService.fromRequest(req, action, target, details);
  const device = String(req.deviceId ?? req.body?.deviceId ?? "").slice(0, 8);
  return AuditService.record({
    operator: { _id: undefined, username: device ? `device:${device}…` : "citizen", role: "citizen" },
    action,
    target,
    details,
    ip: req.ip,
  });
};

/** Run a slow job without holding the request (errors are logged, never thrown). */
export const background = (label, fn) => {
  setImmediate(() => {
    Promise.resolve()
      .then(fn)
      .catch((e) => console.error(`⚠️  [AI] ${label}:`, e.message));
  });
};

/** Decode a base64 payload (optionally a data: URL) with a size cap. */
export const decodeBase64 = (value, maxBytes) => {
  if (typeof value !== "string" || !value) return null;
  const m = value.match(/^data:([\w/+.-]+);base64,(.*)$/s);
  const mime = m?.[1] ?? null;
  const raw = m ? m[2] : value;
  if (raw.length > Math.ceil((maxBytes * 4) / 3) + 8) return { tooLarge: true };
  const buffer = Buffer.from(raw, "base64");
  if (!buffer.length || buffer.length > maxBytes) return { tooLarge: buffer.length > maxBytes };
  return { buffer, mime };
};
