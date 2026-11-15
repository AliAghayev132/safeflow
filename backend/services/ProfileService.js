import { CitizenProfile } from "#models";

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
