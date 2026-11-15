import { CircleCheck, Gauge, Ban, Clock, Loader, CheckCheck, XCircle, Send, AlertTriangle } from 'lucide-react'

// Status = colour + icon + text (never colour alone)
export const PARTNER_STATUS_META = {
  active: { variant: 'success', Icon: CircleCheck },
  limited: { variant: 'warning', Icon: Gauge },
  suspended: { variant: 'critical', Icon: Ban },
}

export const REQUEST_STATUS_META = {
  submitted: { variant: 'critical', Icon: Send },
  acknowledged: { variant: 'info', Icon: Clock },
  in_progress: { variant: 'warning', Icon: Loader },
  fulfilled: { variant: 'success', Icon: CheckCheck },
  rejected: { variant: 'neutral', Icon: XCircle },
}

export const DELIVERY_STATUS_META = {
  pending: { variant: 'warning', Icon: Clock },
  delivered: { variant: 'success', Icon: CircleCheck },
  failed: { variant: 'critical', Icon: AlertTriangle },
}

export const PARTNER_TYPE_ICON = {
  army: 'shield',
  police: 'policeCar',
  ambulance: 'ambulance',
  municipality: 'shelter',
  other: 'antenna',
}

export const REQUEST_STATUSES = ['submitted', 'acknowledged', 'in_progress', 'fulfilled', 'rejected']
