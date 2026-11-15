/**
 * Domain events — published on the internal EventBus.
 * Every state change in the engine goes through one of these, so new modules
 * (rules, notifications, analytics...) only need to subscribe.
 */
const domainEvents = {
  SOS_CREATED: "sos.created",
  SOS_UPDATED: "sos.updated",
  SHELTER_UPDATED: "shelter.updated",
  SHELTER_ACTIVATED: "shelter.activated",
  ROAD_UPDATED: "road.updated",
  BRIGADE_UPDATED: "brigade.updated",
  ALERT_CREATED: "alert.created",
  ALERT_UPDATED: "alert.updated",
  CITIZEN_UPDATED: "citizen.updated",
  CITIZEN_ROUTE_UPDATED: "citizen.route_updated",
  CONFIG_UPDATED: "config.updated",
  SCENARIO_UPDATED: "scenario.updated",
  SYSTEM_RESET: "system.reset",
};

/**
 * Realtime event types delivered to clients. Every delivery is wrapped as
 *   socket.emit("evt", { seq, type, data, at })
 * `seq` is monotonic so clients can request missed events after a reconnect
 * (socket "sync") or poll them (GET /api/events?after=seq).
 */
const socketEvents = {
  SOS_NEW: "sos:new",
  SOS_UPDATED: "sos:updated",
  SHELTER_UPDATED: "shelter:updated",
  ROAD_UPDATED: "road:updated",
  BRIGADE_UPDATED: "brigade:updated",
  ALERT_NEW: "alert:new",
  ALERT_UPDATED: "alert:updated",
  ROUTE_UPDATED: "route:updated",
  STATS_UPDATED: "stats:updated",
  CONFIG_UPDATED: "config:updated",
  SCENARIO_UPDATED: "scenario:updated",
  SYSTEM_RESET: "system:reset",
};

/** Realtime channels (permission per channel lives in config/rbac.json). */
const channels = {
  SOS: "sos",
  ALERTS: "alerts",
  BRIGADES: "brigades",
  SHELTERS: "shelters",
  ROADS: "roads",
  STATS: "stats",
  CONFIG: "config",
  SCENARIO: "scenario",
  SYSTEM: "system",
};

const socketRooms = {
  channel: (name) => `ch:${name}`,
  device: (deviceId) => `device:${deviceId}`,
};

export { domainEvents, socketEvents, channels, socketRooms };
