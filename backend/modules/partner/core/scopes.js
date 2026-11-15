/**
 * Partner API scopes — pure.
 *
 *   incidents:read        active crisis zones / clusters (aggregated)
 *   assembly_points:read  assembly points, occupancy, fill ETA
 *   roads:read            closed / congested roads
 *   requests:write        submit resource / help requests to the crisis center
 */
export const PARTNER_SCOPES = [
  "incidents:read",
  "assembly_points:read",
  "roads:read",
  "requests:write",
];

export const READ_SCOPES = PARTNER_SCOPES.filter((s) => s.endsWith(":read"));

export const PARTNER_TYPES = ["army", "police", "ambulance", "municipality", "other"];
export const PARTNER_STATUS = ["active", "limited", "suspended"];

/** Realtime event → scope that may receive it. */
export const EVENT_SCOPES = {
  "incident.created": "incidents:read",
  "incident.updated": "incidents:read",
  "assembly_point.updated": "assembly_points:read",
  "road.updated": "roads:read",
  "request.updated": "requests:write",
};
export const PARTNER_EVENTS = Object.keys(EVENT_SCOPES);

export const hasScope = (granted = [], required) => granted.includes(required);

/** Keep only known, unique scopes. */
export const normalizeScopes = (scopes) =>
  [...new Set((Array.isArray(scopes) ? scopes : []).filter((s) => PARTNER_SCOPES.includes(s)))];

/**
 * Scopes for a token request: the requested space-separated list must be a
 * subset of what the client is allowed; empty → everything allowed.
 * A "limited" client only gets read scopes.
 * @returns {{ scopes: string[] } | { error: "invalid_scope" }}
 */
export const grantScopes = ({ allowed, requested, status }) => {
  const effective = status === "limited" ? allowed.filter((s) => READ_SCOPES.includes(s)) : allowed;
  if (!requested || !String(requested).trim()) return { scopes: [...effective] };
  const wanted = [...new Set(String(requested).trim().split(/\s+/))];
  if (wanted.some((s) => !effective.includes(s))) return { error: "invalid_scope" };
  return { scopes: wanted };
};

/** Events a subscription may ask for, given the client's scopes. */
export const allowedEvents = (scopes) => PARTNER_EVENTS.filter((e) => scopes.includes(EVENT_SCOPES[e]));
