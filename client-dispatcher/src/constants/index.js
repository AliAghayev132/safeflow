// Values, colours, icons and translation-key prefixes. Keep in sync with the
// server enums (backend/constants/shared/enums.js). No UI text here — labels
// are resolved with i18n: t(`sosType.${type}`), t(`brigadeStatus.${s}`), ...

import {
  Clock,
  Navigation,
  CircleCheck,
  Ban,
  MapPin,
  Undo2,
  Siren,
  CircleX,
  CircleDot,
  TriangleAlert,
  ShieldAlert,
  Wifi,
  RefreshCw,
  WifiOff,
  Loader2,
  Lock,
  Hourglass,
  Play,
} from 'lucide-react'

export const MAP_CENTER = [40.4, 49.85]
export const MAP_ZOOM = 13

// Solid palette (mirrors the @theme tokens in App.css)
export const COLORS = {
  critical: '#E5484D',
  orange: '#F76B15',
  warning: '#F5A524',
  success: '#30A46C',
  info: '#3B82F6',
  muted: '#8A96AD',
  subtle: '#5D6A84',
  border: '#22304A',
  road: '#2A3A58',
  spam: '#7C8AA5',
}

// Fallback thresholds until the live config is known
export const DEFAULT_THRESHOLDS = { reroute: 0.9, alert: 0.95 }

// ============ SOS ============
export const SOS_TYPES = {
  fire: { icon: 'fire', color: COLORS.critical },
  collapse: { icon: 'collapse', color: COLORS.orange },
  flood: { icon: 'flood', color: COLORS.info },
  medical: { icon: 'medical', color: COLORS.success },
  general: { icon: 'sos', color: COLORS.warning },
}
export const SOS_TYPE_KEYS = Object.keys(SOS_TYPES)

// Every status = colour variant + icon + text (never colour alone)
export const SOS_STATUS = {
  pending: { variant: 'critical', Icon: Clock },
  assigned: { variant: 'warning', Icon: Navigation },
  resolved: { variant: 'success', Icon: CircleCheck },
  cancelled: { variant: 'neutral', Icon: Ban },
}

export const SOS_NEEDS = ['rescue_trapped', 'medical_aid', 'water', 'shelter', 'evacuation', 'food', 'power']
export const VULNERABLE_FLAGS = ['elderly', 'child', 'disabled']

// ============ SHELTERS ============
export const SHELTER_TYPES = {
  shelter: { icon: 'shelter' },
  park: { icon: 'park' },
  stadium: { icon: 'stadium' },
}

export const SHELTER_LEVEL = {
  normal: { variant: 'success', Icon: CircleCheck },
  warning: { variant: 'warning', Icon: TriangleAlert },
  critical: { variant: 'critical', Icon: Siren },
  inactive: { variant: 'neutral', Icon: Lock },
  reserveOpen: { variant: 'info', Icon: Play },
}

// ============ BRIGADES ============
export const BRIGADE_TYPES = {
  fire: { icon: 'fireEngine' },
  medical: { icon: 'ambulance' },
  rescue: { icon: 'helicopter' },
}

export const BRIGADE_STATUS = {
  available: { variant: 'success', color: COLORS.success, Icon: CircleCheck },
  dispatched: { variant: 'warning', color: COLORS.warning, Icon: Navigation },
  on_scene: { variant: 'critical', color: COLORS.critical, Icon: MapPin },
  returning: { variant: 'info', color: COLORS.info, Icon: Undo2 },
}

// Manual transitions allowed from the dashboard (dispatch is decision-only)
export const BRIGADE_TRANSITIONS = {
  available: [],
  dispatched: ['on_scene', 'returning'],
  on_scene: ['returning', 'available'],
  returning: ['available'],
}

// ============ ALERTS ============
export const ALERT_TYPES = {
  sos_cluster: { icon: 'siren' },
  shelter_overload: { icon: 'people' },
}

export const ALERT_STATUS = {
  active: { variant: 'critical', Icon: Siren },
  approved: { variant: 'success', Icon: CircleCheck },
  rejected: { variant: 'neutral', Icon: CircleX },
  resolved: { variant: 'info', Icon: CircleDot },
}
export const ALERT_STATUS_FILTERS = ['all', 'active', 'approved', 'rejected', 'resolved']

export const ALERT_ACTIONS = {
  dispatch_brigade: { icon: 'fireEngine' },
  open_shelter: { icon: 'tent' },
}

// ============ REALTIME CONNECTION ============
export const CONNECTION_MODES = {
  live: { variant: 'success', Icon: Wifi },
  polling: { variant: 'warning', Icon: RefreshCw },
  connecting: { variant: 'info', Icon: Loader2 },
  offline: { variant: 'critical', Icon: WifiOff },
}

// ============ SYSTEM ============
export const BREAKER_STATE = {
  closed: { variant: 'success', Icon: CircleCheck },
  open: { variant: 'critical', Icon: ShieldAlert },
  'half-open': { variant: 'warning', Icon: Hourglass },
}

// ============ OCCUPANCY (map / bars colour scale) ============
export const OCCUPANCY_COLORS = [
  { max: 0.7, color: COLORS.success },
  { max: 0.9, color: COLORS.warning },
  { max: 0.95, color: COLORS.orange },
  { max: Infinity, color: COLORS.critical },
]

// Map layers (label: map.layers.<key>) and their default visibility
export const DEFAULT_MAP_LAYERS = {
  zones: true,
  roads: true,
  shelters: true,
  brigades: true,
  sos: true,
  heatmap: false,
  alerts: true,
}

// SOS density grid cell (degrees) for the heatmap layer (~280 m)
export const HEAT_CELL_DEG = 0.0025
export const HEAT_LEVELS = [
  { min: 4, color: COLORS.critical, opacity: 0.55 },
  { min: 2, color: COLORS.orange, opacity: 0.45 },
  { min: 1, color: COLORS.warning, opacity: 0.32 },
]
