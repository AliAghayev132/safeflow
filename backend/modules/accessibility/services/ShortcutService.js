import { crypto } from "#lib";
import { Citizen } from "#models";
import { AppError, isDeviceId } from "#utils";
import { AuditService } from "#services/AuditService.js";
import { ZoneService } from "#services/ZoneService.js";
import { SosService } from "#services/SosService.js";
import { ShortcutToken } from "../models/shortcutToken.model.js";

const PREFIX = "sfs_";
const CITY_CENTER = { lat: 40.4, lng: 49.85 };

const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");

/**
 * Deterministic UUID (v4-shaped) from an arbitrary Idempotency-Key, scoped to
 * the device — so a Siri / Assistant retry with the same key never creates a
 * second SOS (SosService is idempotent on clientId).
 */
const clientIdFor = (deviceId, key) => {
  if (!key) return crypto.randomUUID();
  if (isDeviceId(key)) return key;
  const h = crypto.createHash("sha256").update(`${deviceId}:${key}`).digest("hex");
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

// Device ids are pseudonymous, but keep the audit trail minimal anyway
const auditTarget = (deviceId) => ({ type: "device", id: `${deviceId.slice(0, 8)}…` });

/**
 * Shortcut tokens (create / rotate / revoke) and token-authenticated SOS.
 */
class ShortcutService {
  static async status(deviceId) {
    const doc = await ShortcutToken.findOne({ deviceId });
    return doc ? doc.toPublic() : { active: false };
  }

  /** Create or rotate: the previous token stops working immediately. */
  static async issue(deviceId, { ip } = {}) {
    const token = `${PREFIX}${crypto.randomBytes(24).toString("base64url")}`;
    const existed = await ShortcutToken.exists({ deviceId });
    const doc = await ShortcutToken.findOneAndUpdate(
      { deviceId },
      {
        $set: { tokenHash: hash(token), prefix: token.slice(0, PREFIX.length + 4), lastUsedAt: null, useCount: 0 },
        $setOnInsert: { deviceId },
      },
      { upsert: true, new: true },
    );
    await AuditService.record({
      action: existed ? "a11y.shortcut_token.rotate" : "a11y.shortcut_token.create",
      target: auditTarget(deviceId),
      details: { prefix: doc.prefix },
      ip,
    });
    return { token, ...doc.toPublic() };
  }

  static async revoke(deviceId, { ip } = {}) {
    const doc = await ShortcutToken.findOneAndDelete({ deviceId });
    if (doc) {
      await AuditService.record({
        action: "a11y.shortcut_token.revoke",
        target: auditTarget(deviceId),
        details: { prefix: doc.prefix },
        ip,
      });
    }
    return { active: false, revoked: Boolean(doc) };
  }

  /** Token → device (or null). Updates usage stats. */
  static async authenticate(token) {
    if (typeof token !== "string" || !token.startsWith(PREFIX)) return null;
    const doc = await ShortcutToken.findOneAndUpdate(
      { tokenHash: hash(token) },
      { $set: { lastUsedAt: new Date() }, $inc: { useCount: 1 } },
      { new: true },
    );
    return doc ? { deviceId: doc.deviceId, prefix: doc.prefix } : null;
  }

  /**
   * Where to send the SOS: given coordinates → the device's last known
   * location → its district centre → city centre (flagged as unknown).
   */
  static async locate(deviceId, coords) {
    if (coords) return { origin: coords, located: "given" };
    const citizen = await Citizen.findOne({ deviceId }, { location: 1, zone: 1 }).lean();
    if (citizen?.location?.coordinates) {
      const [lng, lat] = citizen.location.coordinates;
      return { origin: { lat, lng }, located: "last_known" };
    }
    if (citizen?.zone) {
      const zone = ZoneService.list().find((z) => String(z._id) === String(citizen.zone));
      if (zone) {
        return {
          origin: { lat: zone.center.coordinates[1], lng: zone.center.coordinates[0] },
          located: "zone",
        };
      }
    }
    return { origin: CITY_CENTER, located: "city_center" };
  }

  static async sendSos({ deviceId, coords, type = "general", note = "", idempotencyKey, ip }) {
    if (!deviceId) throw AppError.unauthorized();
    const { origin, located } = await ShortcutService.locate(deviceId, coords);
    const notes = ["shortcut", located !== "given" ? `location_${located}` : null, note].filter(Boolean);
    const result = await SosService.create({
      clientId: clientIdFor(deviceId, idempotencyKey),
      deviceId,
      type,
      origin,
      ip,
      details: { note: notes.join(" · ") },
    });
    return { ...result, located };
  }
}

export { ShortcutService, clientIdFor };
