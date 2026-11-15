import { AppError } from "./AppError.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Validates a citizen device id (client-generated UUID). */
const requireDeviceId = (value) => {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw AppError.badRequest("Yanlış cihaz identifikatoru (deviceId)");
  }
  return value;
};

const isDeviceId = (value) => typeof value === "string" && UUID_RE.test(value);

/** Parses and validates a lat/lng pair. */
const requireCoords = (lat, lng) => {
  const la = Number(lat);
  const ln = Number(lng);
  if (
    lat === null ||
    lng === null ||
    lat === "" ||
    lng === "" ||
    !Number.isFinite(la) ||
    !Number.isFinite(ln) ||
    la < -90 ||
    la > 90 ||
    ln < -180 ||
    ln > 180
  ) {
    throw AppError.badRequest("Yanlış koordinatlar");
  }
  return { lat: la, lng: ln };
};

/** Optional coords: returns null when both are missing. */
const optionalCoords = (lat, lng) => {
  const empty = (v) => v === undefined || v === null || v === "";
  if (empty(lat) && empty(lng)) return null;
  return requireCoords(lat, lng);
};

/** Ensures `value` is one of `allowed`. */
const requireEnum = (value, allowed, field) => {
  if (!allowed.includes(value)) {
    throw AppError.badRequest(
      `${field} dəyəri yanlışdır. İcazə verilənlər: ${allowed.join(", ")}`,
    );
  }
  return value;
};

export {
  requireDeviceId,
  isDeviceId,
  requireCoords,
  optionalCoords,
  requireEnum,
};
