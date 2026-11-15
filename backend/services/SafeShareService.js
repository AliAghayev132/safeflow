import { crypto } from "#lib";
import { SafeShare, Citizen } from "#models";
import { config } from "#config";
import { AppError, toPoint } from "#utils";
import { CitizenService } from "./CitizenService.js";

/**
 * "I'm safe" one-tap share link: marks the citizen safe and returns a public
 * link (with timestamp and location) for family members.
 */
class SafeShareService {
  static async create({ deviceId, origin, displayName = "", message = "" }) {
    await CitizenService.setStatus({ deviceId, status: "safe", origin });
    const citizen = await Citizen.findOne({ deviceId }).populate("targetShelter");

    const share = await SafeShare.create({
      token: crypto.randomBytes(16).toString("base64url"),
      deviceId,
      displayName: String(displayName).slice(0, 80),
      message: String(message).slice(0, 280),
      location: origin ? toPoint(origin.lat, origin.lng) : citizen?.location ?? null,
      shelterName: citizen?.targetShelter?.name ?? null,
      expiresAt: new Date(Date.now() + config.safeShareTtlHours * 3600 * 1000),
    });

    return {
      ...share.toPublic(),
      url: `${config.publicCitizenUrl.replace(/\/$/, "")}/safe/${share.token}`,
    };
  }

  static async get(token) {
    const share = await SafeShare.findOne({ token, expiresAt: { $gt: new Date() } });
    if (!share) throw AppError.notFound("Link tapılmadı və ya vaxtı bitib");
    return share.toPublic();
  }
}

export { SafeShareService };
