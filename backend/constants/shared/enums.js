// ============ SOS ============
// "general" = the big SOS button (type not chosen yet)
const sosTypes = ["fire", "collapse", "flood", "medical", "general"];
const sosStatus = ["pending", "assigned", "resolved", "cancelled"];
// Predefined needs a citizen can tap / say
const sosNeeds = ["medical_aid", "water", "rescue_trapped", "shelter", "evacuation", "food", "power"];
const vulnerableFlags = ["elderly", "child", "disabled"];
// Disaster types for the "what to do now" guides (client-side content)
const disasterTypes = ["earthquake", "fire", "flood", "collapse"];

// ============ CITIZEN ============
const citizenStatus = ["unknown", "evacuating", "needs_help", "safe"];

// ============ SHELTERS ============
const shelterTypes = ["shelter", "park", "stadium"];
const shelterLevels = ["normal", "warning", "critical"];

// ============ ROADS ============
const roadStatus = ["open", "closed"];

// ============ BRIGADES ============
const brigadeTypes = ["fire", "medical", "rescue"];
const brigadeStatus = ["available", "dispatched", "on_scene", "returning"];

// Which brigade type answers which SOS type
const sosTypeToBrigadeType = {
  fire: "fire",
  collapse: "rescue",
  flood: "rescue",
  medical: "medical",
  general: "rescue",
};

// ============ ALERTS ============
const alertTypes = ["sos_cluster", "shelter_overload"];
const alertStatus = ["active", "approved", "rejected", "resolved"];
const alertActionTypes = ["dispatch_brigade", "open_shelter"];
const alertSeverity = ["critical", "high"];

// ============ ROUTING ============
const rerouteReasons = ["road_closed", "shelter_full", "shelter_opened"];
const routeProviders = ["external", "graph", "straight"];

export {
  sosTypes,
  sosStatus,
  sosNeeds,
  vulnerableFlags,
  disasterTypes,
  citizenStatus,
  shelterTypes,
  shelterLevels,
  roadStatus,
  brigadeTypes,
  brigadeStatus,
  sosTypeToBrigadeType,
  alertTypes,
  alertStatus,
  alertActionTypes,
  alertSeverity,
  rerouteReasons,
  routeProviders,
};
