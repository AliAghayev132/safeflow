import { lazy } from 'react'

/** Volunteers module pages (feature flag `volunteers`). */
export const routes = [
  {
    key: 'volunteers',
    path: 'volunteers',
    icon: 'people',
    section: 'Resources',
    feature: 'volunteers',
    permission: ['volunteers:read', 'volunteers:request', 'volunteers:verify'],
    Component: lazy(() =>
      import('@pages/resources/VolunteersPage').then((m) => ({ default: m.VolunteersPage }))
    ),
  },
]
