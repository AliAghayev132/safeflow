import { haversineMeters } from "#utils/geo.js";
import { MEDICAL_PROFESSIONS } from "./constants.js";

/**
 * Volunteer matching — pure (unit-tested).
 *
 * A volunteer is eligible when consent is active, availability is "ready",
 * the profession matches, and they haven't already been notified/declined.
 *
 *   stage 1 — eligible volunteers AT the requesting shelter
 *   stage 2 — only if stage 1 cannot fill `count`: eligible volunteers within
 *             `radiusMeters` of the shelter (nearest first), optionally widened
 *             to `widenRadiusMeters` when still not enough.
 *
 * Volunteers with no known position are never picked in stage 2.
 */
export const isEligible = (v, { professions, exclude = new Set() }) =>
  v.consentGiven === true &&
  v.availability === "ready" &&
  professions.includes(v.profession) &&
  !exclude.has(v.deviceId);

export const rankCandidates = ({
  volunteers,
  shelter, // { id, lat, lng }
  professions,
  count,
  radiusMeters,
  widenRadiusMeters = 0,
  exclude = new Set(),
  maxNotify = 50,
}) => {
  const eligible = volunteers.filter((v) => isEligible(v, { professions, exclude }));

  const atShelter = eligible
    .filter((v) => v.currentShelterId && String(v.currentShelterId) === String(shelter.id))
    .map((v) => ({ ...v, stage: 1, distanceMeters: 0 }));

  const picked = [...atShelter];
  if (picked.length < count) {
    const taken = new Set(picked.map((v) => v.deviceId));
    const withDistance = eligible
      .filter((v) => !taken.has(v.deviceId) && v.location)
      .map((v) => ({ ...v, distanceMeters: haversineMeters(v.location, shelter) }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    const near = withDistance.filter((v) => v.distanceMeters <= radiusMeters);
    picked.push(...near.map((v) => ({ ...v, stage: 2 })));

    if (picked.length < count && widenRadiusMeters > radiusMeters) {
      const wide = withDistance.filter(
        (v) => v.distanceMeters > radiusMeters && v.distanceMeters <= widenRadiusMeters,
      );
      picked.push(...wide.map((v) => ({ ...v, stage: 3 })));
    }
  }
  return picked.slice(0, maxNotify);
};

/** Medical-SOS call-out: medical professions around the SOS point. */
export const medicalCandidates = ({ volunteers, point, radiusMeters, maxNotify = 20 }) =>
  volunteers
    .filter((v) => isEligible(v, { professions: MEDICAL_PROFESSIONS }) && v.location)
    .map((v) => ({ ...v, distanceMeters: haversineMeters(v.location, point), stage: 2 }))
    .filter((v) => v.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, maxNotify);

/** Verification status for a newly registered / changed profession. */
export const initialVerification = (profession) =>
  MEDICAL_PROFESSIONS.includes(profession) ? "unverified" : "not_required";

/** Does a file buffer start with the magic bytes of the declared type? */
export const matchesMagic = (buffer, signature) =>
  Boolean(buffer) && buffer.length >= signature.length && signature.every((b, i) => buffer[i] === b);

/**
 * Coarse position for staff without exact-location rights: shelter or zone
 * name only — never coordinates.
 */
export const coarseLocation = ({ shelterName, zoneName }) =>
  shelterName ? { kind: "shelter", label: shelterName } : zoneName ? { kind: "zone", label: zoneName } : null;
