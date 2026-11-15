import { ConfigService } from "#services/ConfigService.js";
import { fail } from "#utils";

/**
 * Feature flag gate (config section `features`, editable at runtime).
 * A disabled feature answers 404 FEATURE_DISABLED — the endpoint behaves as
 * if it did not exist.
 */
const requireFeature = (feature) => (req, res, next) => {
  if (!ConfigService.isEnabled(feature)) {
    return fail(res, "Bu funksiya hazırda söndürülüb", 404, undefined, "FEATURE_DISABLED");
  }
  next();
};

export { requireFeature };
