// Keep in sync with backend/constants/shared/enums.js
// UI text lives in src/i18n/locales — constants hold only values and keys.

// Baku city center — default map view / last-resort SOS location
export const CITY_CENTER = { lat: 40.4, lng: 49.85 }
export const CITY_ZOOM = 13
// Beyond this distance from the center the GPS fix is treated as out of area
export const SERVICE_RADIUS_METERS = 20000

// Threshold at which a shelter is shown as "full" (backend rerouteThreshold)
export const SHELTER_FULL_RATE = 0.9

// One-tap SOS types (label: `sos.types.<value>`)
export const sosTypes = [
  { value: 'fire', icon: 'fire' },
  { value: 'collapse', icon: 'collapse' },
  { value: 'flood', icon: 'flood' },
  { value: 'medical', icon: 'medical' },
]
export const sosTypeIcon = { fire: 'fire', collapse: 'collapse', flood: 'flood', medical: 'medical', general: 'sos' }

// Needs (label: `needs.<value>`)
export const sosNeeds = ['rescue_trapped', 'medical_aid', 'water', 'shelter', 'evacuation', 'food', 'power']
export const vulnerableFlags = ['elderly', 'child', 'disabled']

// Ticket status → icon (lucide name resolved in StatusBadge) + tone
export const ticketStatusMeta = {
  queued: { tone: 'busy', icon: 'clock' },
  pending: { tone: 'info', icon: 'hourglass' },
  assigned: { tone: 'brand', icon: 'truck' },
  resolved: { tone: 'ok', icon: 'check' },
  cancelled: { tone: 'neutral', icon: 'shield' },
}

export const citizenStatusMeta = {
  unknown: { tone: 'neutral', icon: 'help' },
  evacuating: { tone: 'info', icon: 'walk' },
  needs_help: { tone: 'sos', icon: 'alert' },
  safe: { tone: 'ok', icon: 'check' },
}

// Disaster guides (text: `guide.steps.<value>`)
export const disasterTypes = [
  { value: 'earthquake', icon: 'collapse' },
  { value: 'fire', icon: 'fire' },
  { value: 'flood', icon: 'flood' },
  { value: 'collapse', icon: 'construction' },
]
// Which guide to show for an active SOS type
export const guideForSosType = {
  fire: 'fire',
  flood: 'flood',
  collapse: 'collapse',
  medical: 'earthquake',
  general: 'earthquake',
}

// Emergency numbers (label: `guide.numbers.n<number>`)
export const emergencyNumbers = [
  { number: '112', icon: 'phone' },
  { number: '101', icon: 'fireEngine' },
  { number: '102', icon: 'policeCar' },
  { number: '103', icon: 'ambulance' },
]

export const shelterTypes = {
  shelter: { icon: 'shelter' },
  park: { icon: 'park' },
  stadium: { icon: 'stadium' },
}

export const rerouteIcons = {
  road_closed: 'construction',
  shelter_full: 'people',
  shelter_opened: 'shelter',
}
