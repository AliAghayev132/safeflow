import { CitizenProfile } from "#models";
import { accessibilityFlags } from "#constants";

const NO_NEEDS = Object.fromEntries(accessibilityFlags.map((f) => [f, false]));

const strList = (v, max = 20) =>
  Array.isArray(v)
    ? v.map((s) => String(s).trim()).filter(Boolean).slice(0, max)
    : undefined;

/**
 * Optional citizen profile (medical + emergency contacts), keyed by device.
 * SOS never requires it; when present it is attached to the dispatcher view.
 */
class ProfileService {
  static async get(deviceId) {
    const p = await CitizenProfile.findOne({ deviceId });
    return p?.toPublic() ?? null;
  }

  /**
   * Special-needs flags + whether the profile suggests medical needs
   * (chronic conditions / medications). Lean, projection-only query — used
   * on the SOS and evacuation hot paths.
   */
  static async needs(deviceId) {
    if (!deviceId) return { accessibility: { ...NO_NEEDS }, medical: false };
    const p = await CitizenProfile.findOne(
      { deviceId },
      { accessibility: 1, conditions: 1, medications: 1 },
    ).lean();
    return {
      accessibility: { ...NO_NEEDS, ...(p?.accessibility ?? {}) },
      medical: Boolean(p?.conditions?.length || p?.medications?.length),
    };
  }

  static async upsert(deviceId, body = {}) {
    const set = {};
    for (const k of ["fullName", "phone", "bloodType"]) {
      if (typeof body[k] === "string") set[k] = body[k].trim();
    }
    if (body.birthYear === null || body.birthYear === "") set.birthYear = null;
    else if (Number.isFinite(Number(body.birthYear))) set.birthYear = Number(body.birthYear);
    for (const k of ["conditions", "allergies", "medications"]) {
      const list = strList(body[k]);
      if (list) set[k] = list;
    }
    if (Array.isArray(body.emergencyContacts)) {
      set.emergencyContacts = body.emergencyContacts.slice(0, 5).map((c) => ({
        name: String(c?.name ?? "").trim(),
        phone: String(c?.phone ?? "").trim(),
        relation: String(c?.relation ?? "").trim(),
      }));
    }
    if (["az", "en", "ru"].includes(body.language)) set.language = body.language;
    if (body.accessibility && typeof body.accessibility === "object") {
      for (const flag of accessibilityFlags) {
        if (flag in body.accessibility) set[`accessibility.${flag}`] = Boolean(body.accessibility[flag]);
      }
    }

    const p = await CitizenProfile.findOneAndUpdate(
      { deviceId },
      { $set: set, $setOnInsert: { deviceId } },
      { upsert: true, new: true, runValidators: true },
    );
    return p.toPublic();
  }

  static async remove(deviceId) {
    await CitizenProfile.deleteOne({ deviceId });
  }

  /** deviceId → profile map for the dispatcher (batch). */
  static async forDevices(deviceIds) {
    const rows = await CitizenProfile.find({ deviceId: { $in: [...new Set(deviceIds)] } });
    return Object.fromEntries(rows.map((p) => [p.deviceId, p.toPublic()]));
  }
}

export { ProfileService };
