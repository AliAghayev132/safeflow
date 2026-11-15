// Imported directly (not via the #constants barrel) so pure utils never pull
// in mongoose/express through constants/shared/variables.js side effects.
import { EARTH_RADIUS_METERS } from "#constants/shared/variables.js";

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Great-circle distance in meters between two { lat, lng } points.
 */
const haversineMeters = (a, b) => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
};

/** GeoJSON Point from lat/lng (GeoJSON order is [lng, lat]). */
const toPoint = (lat, lng) => ({ type: "Point", coordinates: [lng, lat] });

/** { lat, lng } from a GeoJSON Point. */
const fromPoint = (point) =>
  point?.coordinates
    ? { lat: point.coordinates[1], lng: point.coordinates[0] }
    : null;

/** Radius in meters → radians, for MongoDB $centerSphere. */
const metersToRadians = (meters) => meters / EARTH_RADIUS_METERS;

/** Average of a list of { lat, lng } points. */
const centroid = (points) => {
  if (!points.length) return null;
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
};

/** Move from `from` toward `to` by at most `meters`. */
const stepToward = (from, to, meters) => {
  const total = haversineMeters(from, to);
  if (total <= meters || total === 0) return { ...to, arrived: true };
  const ratio = meters / total;
  return {
    lat: from.lat + (to.lat - from.lat) * ratio,
    lng: from.lng + (to.lng - from.lng) * ratio,
    arrived: false,
  };
};

/** Random point within `radiusMeters` of a center (uniform on the disc). */
const randomPointAround = (center, radiusMeters) => {
  const r = radiusMeters * Math.sqrt(Math.random());
  const theta = Math.random() * 2 * Math.PI;
  const dLat = (r * Math.cos(theta)) / 111320;
  const dLng = (r * Math.sin(theta)) / (111320 * Math.cos(toRad(center.lat)));
  return { lat: center.lat + dLat, lng: center.lng + dLng };
};

export {
  haversineMeters,
  toPoint,
  fromPoint,
  metersToRadians,
  centroid,
  stepToward,
  randomPointAround,
};
