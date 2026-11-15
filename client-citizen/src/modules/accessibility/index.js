// Accessibility module (citizen): SOS signals, shortcuts, high contrast,
// special-needs profile fields. Backend: backend/modules/accessibility.
export { SosSignalPanel } from './components/SosSignalPanel'
export { ContrastToggle } from './components/ContrastToggle'
export { AccessibilityFields } from './components/AccessibilityFields'
export { ACCESSIBILITY_FLAGS, emptyAccessibility, toAccessibility } from './flags'
export { vibrateOutcome, VIBRATION } from './vibration'
export { SOS_TIMELINE, SOS_CYCLE_MS, UNIT_MS } from './morse'
export { applyContrast, setContrast, readContrast, isHighContrast } from './contrast'
