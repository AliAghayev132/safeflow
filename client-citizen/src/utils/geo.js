const toRad = (deg) => (deg * Math.PI) / 180

/** Great-circle distance in meters between two { lat, lng } points. */
export const distanceMeters = (a, b) => {
  if (!a || !b) return Infinity
  const R = 6378100
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
