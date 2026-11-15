/**
 * Partner data serializers — pure. Data minimisation by construction:
 * every output object is built from an explicit allow-list of fields, so new
 * internal fields (device ids, names, phones, per-person coordinates) can
 * never leak to partners by accident.
 *
 * Coordinates of aggregated objects (incident centroids) are rounded to
 * 3 decimals (~100 m). Shelters / roads are public infrastructure and keep
 * their coordinates.
 */
const round = (v, d = 3) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);
const iso = (v) => (v ? new Date(v).toISOString() : null);

/** Fields that must never appear in any partner payload. */
export const FORBIDDEN_KEYS = [
  "deviceId",
  "deviceIds",
  "clientId",
  "ip",
  "fullName",
  "name_citizen",
  "phone",
  "emergencyContacts",
  "conditions",
  "allergies",
  "medications",
  "note",
  "transcript",
  "injuries",
  "sosSignals",
  "profile",
];

export const serializeIncident = (alert, zoneName = null) => ({
  id: String(alert.id),
  kind: alert.type === "shelter_overload" ? "assembly_point_overload" : "sos_cluster",
  severity: alert.severity,
  status: alert.status,
  zone: zoneName ?? alert.i18n?.params?.zone ?? null,
  hazard: alert.i18n?.params?.hazard ?? null,
  // distinct reporting devices — an aggregate count, never identities
  reports: Number(alert.signalCount) || 0,
  center: { lat: round(alert.lat), lng: round(alert.lng) },
  startedAt: iso(alert.createdAt),
  updatedAt: iso(alert.updatedAt ?? alert.createdAt),
});

export const serializeZoneLoad = (zone) => ({
  code: zone.code,
  name: zone.name,
  activeSos: Number(zone.sosActive) || 0,
  sosLastWindow: Number(zone.sosLastWindow) || 0,
});

export const serializeAssemblyPoint = (s) => ({
  id: String(s.id),
  code: s.code,
  name: s.name,
  type: s.type,
  location: { lat: s.lat, lng: s.lng },
  address: s.address ?? null,
  isOpen: Boolean(s.isActive),
  capacity: s.capacity,
  occupancy: s.occupancy,
  occupancyRate: s.occupancyRate,
  level: s.level ?? null,
  inflowPerMin: s.inflowPerMin ?? null,
  fillEtaMin: s.fillEtaMin ?? null,
  accessible: s.accessible ?? null,
  medicalPoint: s.medicalPoint ?? null,
});

export const serializeRoad = (edge, path = null) => ({
  id: edge.edgeId,
  name: edge.name,
  status: edge.status,
  congestion: edge.congestion ?? 0,
  closedReason: edge.closedReason || null,
  closedAt: iso(edge.closedAt),
  path,
});

export const serializeRequest = (r) => ({
  id: String(r._id ?? r.id),
  type: r.type,
  priority: r.priority,
  title: r.title,
  description: r.description,
  quantity: r.quantity ?? null,
  unit: r.unit ?? null,
  location: r.location?.coordinates
    ? { lat: r.location.coordinates[1], lng: r.location.coordinates[0] }
    : null,
  status: r.status,
  response: r.response ?? null,
  createdAt: iso(r.createdAt),
  updatedAt: iso(r.updatedAt),
});

/** Deep scan: returns the forbidden keys present anywhere in a payload. */
export const findForbiddenKeys = (payload) => {
  const found = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v)) {
        if (FORBIDDEN_KEYS.includes(k)) found.add(k);
        walk(val);
      }
    }
  };
  walk(payload);
  return [...found];
};
