import { lazy } from 'react'

const page = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })))

/**
 * Accessibility module routes.
 *
 * /quick-sos is intentionally NOT behind the feature flag: it only uses the
 * regular SOS endpoint, and an SOS must never be blocked by a toggle (the
 * home-screen shortcut points here). The setup page needs the module backend.
 */
export const routes = [
  {
    path: 'quick-sos',
    public: true,
    Component: page(() => import('@/modules/accessibility/pages/QuickSosPage'), 'QuickSosPage'),
  },
  {
    path: 'shortcuts',
    feature: 'accessibility',
    menu: { icon: 'phone', labelKey: 'a11y.shortcuts.menu', descKey: 'a11y.shortcuts.menuDesc' },
    Component: page(() => import('@/modules/accessibility/pages/ShortcutsPage'), 'ShortcutsPage'),
  },
]
