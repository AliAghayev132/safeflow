import defaults from "./defaults.js";
import { A11yRouter } from "./routes/accessibilityRoutes.js";

/**
 * Accessibility module — SOS for people who cannot speak or can only make
 * one or two touches:
 *   - personal shortcut token per device (hash stored, rotate / revoke)
 *   - POST /api/a11y/v1/sos authenticated by that token (home-screen,
 *     Siri Shortcuts, Google Assistant shortcuts), idempotent via
 *     Idempotency-Key, last-known location fallback, per-token rate limit
 * The audible / visual / vibration SOS signals and the WCAG work live in
 * the citizen app. Feature flag: features.accessibility.
 */
export default {
  name: "accessibility",
  feature: "accessibility",
  defaults,
  routers: [{ path: "/a11y/v1", router: A11yRouter }],
};

export { ShortcutService, clientIdFor } from "./services/ShortcutService.js";
export { ShortcutToken } from "./models/shortcutToken.model.js";
