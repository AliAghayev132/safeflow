import { lazy } from 'react'

/** Feature module "edgeNode" — edge nodes at assembly points. */
export const routes = [
  {
    key: 'edgeNodes',
    path: 'edge-nodes',
    icon: 'antenna',
    section: 'Resources',
    permission: 'edge:read',
    feature: 'edgeNode',
    Component: lazy(() => import('@pages/modules/EdgeNodesPage').then((m) => ({ default: m.EdgeNodesPage }))),
  },
]
