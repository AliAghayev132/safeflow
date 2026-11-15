/**
 * Feature module registry.
 *
 * Every optional feature is a self-contained module in `modules/<name>/`
 * (its own models / services / controllers / routes, mirroring the core
 * layout) and is switched on/off at runtime by its feature flag
 * (config section `features`).
 *
 * Module contract (modules/<name>/index.js default export):
 *   {
 *     name:      "drones",                 // also the config section name
 *     feature:   "drones",                 // key in config.features
 *     defaults?: { ... },                  // config section (validated, editable)
 *     routers?:  [{ path: "/drones", router }],  // mounted under /api, flag-gated
 *     rootRouters?: [{ path: "/", router }],     // mounted at the root, flag-gated
 *     rules?:    [rule, ...],              // RuleEngine rules (flag-gated)
 *     init?:     async (ctx) => {},        // after DB + core services are ready
 *     stop?:     async () => {},           // graceful shutdown
 *   }
 *
 * Adding a module = create the folder and add ONE import line below.
 */
import volunteers from "./volunteers/index.js";

export const modules = [volunteers];
