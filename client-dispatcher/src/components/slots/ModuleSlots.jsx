/**
 * UI extension points for feature modules — the core never imports a module.
 *
 * A module adds `src/modules/<name>/slots.jsx` with a default export:
 *   {
 *     shelterActions?: [Component],   // rendered for an assembly point ({ shelter })
 *     overlays?:       [Component],   // mounted once in the dashboard layout (dialogs)
 *   }
 * Each component decides itself whether it is visible (feature flag, permission).
 */
const found = Object.values(import.meta.glob('/src/modules/*/slots.jsx', { eager: true, import: 'default' }))

const collect = (key) => found.flatMap((slots) => slots?.[key] ?? [])

const SHELTER_ACTIONS = collect('shelterActions')
const OVERLAYS = collect('overlays')

export const hasShelterActions = SHELTER_ACTIONS.length > 0

/** Buttons modules offer for one assembly point (map popup, shelters list). */
export const ShelterActions = ({ shelter, compact = false }) =>
  SHELTER_ACTIONS.map((Action, i) => <Action key={i} shelter={shelter} compact={compact} />)

/** Global dialogs / overlays of modules (mounted once in the layout). */
export const ModuleOverlays = () => OVERLAYS.map((Overlay, i) => <Overlay key={i} />)
