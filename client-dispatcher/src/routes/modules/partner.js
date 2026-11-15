import { lazy } from 'react'

const page = (name) =>
  lazy(() => import('@pages/modules/partner').then((m) => ({ default: m[name] })))

/** Partner API module (feature flag: partnerApi). */
export const routes = [
  {
    key: 'partnerRequests',
    path: 'partner-requests',
    icon: 'megaphone',
    section: 'Resources',
    permission: ['alert:decide', 'partners:manage'],
    feature: 'partnerApi',
    Component: page('PartnerRequestsPage'),
  },
  {
    key: 'partners',
    order: 30,
    path: 'partners',
    icon: 'shield',
    section: 'Admin',
    permission: 'partners:manage',
    feature: 'partnerApi',
    Component: page('PartnersPage'),
  },
]
