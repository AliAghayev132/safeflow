import { useSyncExternalStore } from 'react'

/**
 * Which assembly point the "Request drone supplies" dialog is open for.
 * Tiny external store so the button (inside a Leaflet popup / table row) and
 * the dialog (mounted once in the layout) share state without Redux edits.
 */
let current = null
const listeners = new Set()

export const openSupplyDialog = (shelterId) => {
  current = shelterId
  listeners.forEach((l) => l())
}
export const closeSupplyDialog = () => openSupplyDialog(null)

const subscribe = (l) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useSupplyDialog = () => useSyncExternalStore(subscribe, () => current)
