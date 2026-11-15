import { Operator } from "#models";
import { AuthTokenService } from "#services/AuthTokenService.js";
import { RbacService } from "#services/RbacService.js";
import { fail, isDeviceId } from "#utils";

const bearer = (req) => {
  const header = req.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
};

/**
 * Requires a valid staff access token. Sets `req.operator` and
 * `req.principal` ({ role, permissions, ... } from config/rbac.json).
 */
const authenticate = async (req, res, next) => {
  try {
    const token = bearer(req);
    if (!token) return fail(res, "Avtorizasiya tələb olunur", 401, undefined, "AUTH_REQUIRED");

    const decoded = AuthTokenService.verify(token);
    const operator = await Operator.findById(decoded.id);
    if (!operator || !operator.isActive) {
      return fail(res, "Operator tapılmadı və ya deaktivdir", 401, undefined, "AUTH_INVALID");
    }
    if (!RbacService.isRole(operator.role)) {
      return fail(res, "Rol konfiqurasiyada yoxdur", 403, undefined, "ROLE_UNKNOWN");
    }

    req.operator = operator;
    req.principal = RbacService.operatorPrincipal(operator);
    next();
  } catch (_error) {
    return fail(res, "Sessiyanın vaxtı bitib", 401, undefined, "AUTH_EXPIRED");
  }
};

/**
 * Citizen identity: device id from body, query or the X-Device-Id header.
 * Sets `req.principal` with the citizen role's permissions.
 */
const identifyDevice = (req, _res, next) => {
  const deviceId = req.body?.deviceId ?? req.query?.deviceId ?? req.headers["x-device-id"];
  if (isDeviceId(deviceId)) {
    req.deviceId = deviceId;
    if (!req.principal) req.principal = RbacService.citizenPrincipal(deviceId);
  }
  next();
};

/**
 * Either a staff token or a citizen device id (used by shared endpoints such
 * as event polling).
 */
const authenticateAny = async (req, res, next) => {
  if (bearer(req)) return authenticate(req, res, next);
  identifyDevice(req, res, () => {
    if (!req.principal) {
      return fail(res, "Avtorizasiya və ya cihaz identifikatoru tələb olunur", 401, undefined, "AUTH_REQUIRED");
    }
    next();
  });
};

/**
 * Permission gate. Passes when the principal has ANY of the permissions.
 * Role names are never checked here — only permissions from rbac.json.
 */
const authorize =
  (...permissions) =>
  (req, res, next) => {
    if (!req.principal || !RbacService.canAny(req.principal, permissions)) {
      return fail(res, "Bu əməliyyat üçün icazəniz yoxdur", 403, undefined, "FORBIDDEN");
    }
    next();
  };

export { authenticate, authenticateAny, identifyDevice, authorize };
