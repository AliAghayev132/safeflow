import { lazy } from 'react'
import { can } from '@utils/permissions'

const page = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })))

/**
 * THE single route + menu configuration. Every entry declares the permission
 * it needs (config/rbac.json on the backend); the menu and the router are
 * both built from the entries the signed-in user may access.
 *
 * Adding a page for a new role = add one entry here (and its permission to
 * the role in rbac.json). No role names appear anywhere in the UI code.
 *
 *   key        → translation key `nav.<key>` + stable id
 *   path       → URL (relative to /)
 *   permission → string or array (any-of)
 *   section    → menu group (`nav.section<Section>`)
 *   badge      → live counter shown in the menu ('alerts' | 'queue')
 *   order      → optional position inside its section (lower first)
 */
export const ROUTES = [
  {
    key: 'operations',
    path: '',
    icon: 'map',
    section: 'Operations',
    permission: 'dashboard:view',
    badge: 'alerts',
    Component: page(() => import('@pages/dashboard/OperationsPage'), 'OperationsPage'),
  },
  {
    key: 'triage',
    path: 'triage',
    icon: 'sos',
    section: 'Operations',
    permission: 'sos:read',
    badge: 'queue',
    Component: page(() => import('@pages/dashboard/TriagePage'), 'TriagePage'),
  },
  {
    key: 'myBrigade',
    path: 'my-brigade',
    icon: 'helicopter',
    section: 'Operations',
    permission: 'brigade:update_own',
    Component: page(() => import('@pages/dashboard/MyBrigadePage'), 'MyBrigadePage'),
  },
  {
    key: 'alerts',
    path: 'alerts',
    icon: 'siren',
    section: 'Operations',
    permission: 'alert:read',
    Component: page(() => import('@pages/dashboard/AlertsPage'), 'AlertsPage'),
  },
  {
    key: 'shelters',
    path: 'shelters',
    icon: 'stadium',
    section: 'Operations',
    permission: 'shelter:read',
    Component: page(() => import('@pages/dashboard/SheltersPage'), 'SheltersPage'),
  },
  {
    key: 'brigades',
    path: 'brigades',
    icon: 'fireEngine',
    section: 'Operations',
    permission: 'brigade:read',
    Component: page(() => import('@pages/dashboard/BrigadesPage'), 'BrigadesPage'),
  },
  {
    key: 'simulation',
    path: 'simulation',
    icon: 'bullseye',
    section: 'Operations',
    permission: 'simulation:run',
    Component: page(() => import('@pages/dashboard/SimulationPage'), 'SimulationPage'),
  },
  {
    key: 'config',
    order: 10,
    path: 'admin/config',
    icon: 'gear',
    section: 'Admin',
    permission: 'config:read',
    Component: page(() => import('@pages/admin/ConfigPage'), 'ConfigPage'),
  },
  {
    key: 'audit',
    order: 40,
    path: 'admin/audit',
    icon: 'pager',
    section: 'Admin',
    permission: 'audit:read',
    Component: page(() => import('@pages/admin/AuditPage'), 'AuditPage'),
  },
  {
    key: 'roles',
    order: 20,
    path: 'admin/roles',
    icon: 'lock',
    section: 'Admin',
    permission: 'config:read',
    Component: page(() => import('@pages/admin/RolesPage'), 'RolesPage'),
  },
  {
    key: 'system',
    order: 50,
    path: 'admin/system',
    icon: 'antenna',
    section: 'Admin',
    permission: 'config:read',
    Component: page(() => import('@pages/admin/SystemPage'), 'SystemPage'),
  },
]

/**
 * Feature-module routes: each file in routes/modules/*.js exports
 * `routes` (same shape as above, plus `feature` = backend feature flag).
 * Modules never edit this file — they only add their own module file.
 */
const moduleFiles = import.meta.glob('./modules/*.js', { eager: true })
const MODULE_ROUTES = Object.values(moduleFiles).flatMap((m) => m.routes ?? [])
// Stable sort: entries with `order` are placed by it, others keep file order
export const ALL_ROUTES = [...ROUTES, ...MODULE_ROUTES]
  .map((r, i) => ({ r, i }))
  .sort((a, b) => (a.r.order ?? 1000 + a.i) - (b.r.order ?? 1000 + b.i))
  .map(({ r }) => r)

export const SECTIONS = ['Operations', 'Resources', 'Admin']

/**
 * Routes the user may open, in menu order: permission (RBAC) AND, for
 * feature-module pages, the runtime feature flag must be on.
 */
export const accessibleRoutes = (permissions, features = {}) =>
  ALL_ROUTES.filter((r) => can(permissions, r.permission) && (!r.feature || features[r.feature] === true))

/** Absolute URL of a route entry. */
export const routeUrl = (route) => `/${route.path}`
