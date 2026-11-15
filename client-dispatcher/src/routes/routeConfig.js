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
    path: 'admin/config',
    icon: 'gear',
    section: 'Admin',
    permission: 'config:read',
    Component: page(() => import('@pages/admin/ConfigPage'), 'ConfigPage'),
  },
  {
    key: 'audit',
    path: 'admin/audit',
    icon: 'pager',
    section: 'Admin',
    permission: 'audit:read',
    Component: page(() => import('@pages/admin/AuditPage'), 'AuditPage'),
  },
  {
    key: 'roles',
    path: 'admin/roles',
    icon: 'lock',
    section: 'Admin',
    permission: 'config:read',
    Component: page(() => import('@pages/admin/RolesPage'), 'RolesPage'),
  },
  {
    key: 'system',
    path: 'admin/system',
    icon: 'antenna',
    section: 'Admin',
    permission: 'config:read',
    Component: page(() => import('@pages/admin/SystemPage'), 'SystemPage'),
  },
]

export const SECTIONS = ['Operations', 'Admin']

/** Routes the user may open, in menu order. */
export const accessibleRoutes = (permissions) => ROUTES.filter((r) => can(permissions, r.permission))

/** Absolute URL of a route entry. */
export const routeUrl = (route) => `/${route.path}`
