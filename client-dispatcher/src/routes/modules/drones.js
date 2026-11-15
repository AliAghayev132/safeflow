import { lazy } from 'react'

const page = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })))

/** Drone supply delivery pages (feature flag `drones`). */
export const routes = [
  {
    key: 'drones',
    path: 'drones',
    icon: 'helicopter',
    section: 'Resources',
    permission: 'drones:read',
    feature: 'drones',
    Component: page(() => import('@/modules/drones/pages/DronesPage'), 'DronesPage'),
  },
  {
    key: 'supplies',
    path: 'supplies',
    icon: 'tent',
    section: 'Resources',
    permission: 'supplies:manage',
    feature: 'drones',
    Component: page(() => import('@/modules/drones/pages/SuppliesPage'), 'SuppliesPage'),
  },
  {
    key: 'myShelter',
    path: 'my-shelter',
    icon: 'shelter',
    section: 'Resources',
    permission: 'supplies:confirm',
    feature: 'drones',
    Component: page(() => import('@/modules/drones/pages/MyShelterPage'), 'MyShelterPage'),
  },
]
