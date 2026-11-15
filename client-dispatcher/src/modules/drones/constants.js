import {
  CircleCheck,
  PackageOpen,
  Navigation,
  Undo2,
  BatteryCharging,
  Clock,
  Truck,
  PackageCheck,
  XCircle,
  Ban,
} from 'lucide-react'

// Every status = colour variant + icon + text (never colour alone)
export const DRONE_STATUS = {
  idle: { variant: 'success', Icon: CircleCheck },
  loading: { variant: 'info', Icon: PackageOpen },
  en_route: { variant: 'warning', Icon: Navigation },
  returning: { variant: 'neutral', Icon: Undo2 },
  charging: { variant: 'info', Icon: BatteryCharging },
}

export const SUPPLY_STATUS = {
  pending: { variant: 'critical', Icon: Clock },
  in_progress: { variant: 'warning', Icon: Truck },
  delivered: { variant: 'success', Icon: PackageCheck },
  cancelled: { variant: 'neutral', Icon: Ban },
}

export const DELIVERY_STATUS = {
  loading: { variant: 'info', Icon: PackageOpen },
  en_route: { variant: 'warning', Icon: Navigation },
  arrived: { variant: 'critical', Icon: PackageCheck },
  confirmed: { variant: 'success', Icon: CircleCheck },
  failed: { variant: 'neutral', Icon: XCircle },
}

export const SUPPLY_KINDS = ['water', 'food', 'medicine', 'first_aid']
export const SUPPLY_ICONS = { water: 'flood', food: 'tent', medicine: 'medical', first_aid: 'hospital' }

export const batteryVariant = (pct) => (pct >= 60 ? 'success' : pct >= 30 ? 'warning' : 'critical')

/** "4 dəq 05 san" style countdown parts from an ISO timestamp. */
export const remainingSec = (etaAt, now) => Math.max(0, Math.round((new Date(etaAt).getTime() - now) / 1000))
