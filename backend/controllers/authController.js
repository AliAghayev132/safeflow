import { Operator } from "#models";
import { AuthTokenService, RbacService } from "#services";
import { asyncHandler, ok, fail } from "#utils";

const session = (operator) => ({
  operator: operator.toPublic(),
  role: operator.role,
  permissions: RbacService.permissionsFor(operator.role),
});

/**
 * Staff login (dispatcher / brigade lead / admin / any configured role).
 * POST /api/auth/login { username, password }
 */
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    return fail(res, "İstifadəçi adı və şifrə tələb olunur", 400, undefined, "CREDENTIALS_REQUIRED");
  }

  const operator = await Operator.findOne({
    username: username.trim().toLowerCase(),
  }).select("+password");

  if (!operator || !operator.isActive || !(await operator.comparePassword(password))) {
    return fail(res, "İstifadəçi adı və ya şifrə yanlışdır", 401, undefined, "CREDENTIALS_INVALID");
  }

  operator.lastLoginAt = new Date();
  await operator.save();

  return ok(res, { ...session(operator), accessToken: AuthTokenService.sign(operator) });
});

/** GET /api/auth/me — current operator + permissions (drives the UI menu). */
const me = asyncHandler(async (req, res) => ok(res, session(req.operator)));

export { login, me };
