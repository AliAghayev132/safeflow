import { lazy } from 'react'

const page = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })))

/** AI pages — each behind its own feature flag + permission. */
export const routes = [
  {
    key: 'aiForecast',
    path: 'ai/forecast',
    icon: 'chart',
    section: 'Intelligence',
    permission: 'ai:forecast',
    feature: 'aiForecast',
    Component: page(() => import('@/modules/ai/pages/ForecastPage.jsx'), 'ForecastPage'),
  },
  {
    key: 'aiDamage',
    path: 'ai/damage',
    icon: 'construction',
    section: 'Intelligence',
    permission: 'ai:damage',
    feature: 'aiDamage',
    Component: page(() => import('@/modules/ai/pages/DamagePage.jsx'), 'DamagePage'),
  },
  {
    key: 'aiSupply',
    path: 'ai/supply',
    icon: 'tent',
    section: 'Intelligence',
    permission: 'ai:supply',
    feature: 'aiSupply',
    Component: page(() => import('@/modules/ai/pages/SupplyPlanPage.jsx'), 'SupplyPlanPage'),
  },
  {
    key: 'aiStatus',
    path: 'admin/ai',
    icon: 'bullseye',
    section: 'Admin',
    order: 25,
    permission: 'ai:status',
    feature: 'ai',
    Component: page(() => import('@/modules/ai/pages/AiStatusPage.jsx'), 'AiStatusPage'),
  },
]
