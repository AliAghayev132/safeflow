import { lazy } from 'react'

/** Volunteers module page — linked from Profile via ModuleLinks (`menu`). */
export const routes = [
  {
    path: 'volunteer',
    feature: 'volunteers',
    menu: { icon: 'hospital', labelKey: 'volunteer.menu', descKey: 'volunteer.menuDesc' },
    Component: lazy(() => import('@pages/volunteers/VolunteerPage').then((m) => ({ default: m.VolunteerPage }))),
  },
]
