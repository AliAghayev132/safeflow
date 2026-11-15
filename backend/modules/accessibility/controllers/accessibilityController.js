import { sosTypes } from "#constants";
import { asyncHandler, ok, fail, requireDeviceId, optionalCoords, requireEnum } from "#utils";
import { ShortcutService } from "../services/ShortcutService.js";

/** GET /api/a11y/v1/shortcut-token?deviceId — is a token active? */
const tokenStatus = asyncHandler(async (req, res) =>
  ok(res, { token: await ShortcutService.status(requireDeviceId(req.query.deviceId)) }),
);

/**
 * POST /api/a11y/v1/shortcut-token { deviceId } — create or rotate.
 * The plain token is returned ONCE; only its hash is stored.
 */
const issueToken = asyncHandler(async (req, res) => {
  const token = await ShortcutService.issue(requireDeviceId(req.body?.deviceId), { ip: req.ip });
  return ok(res, { token }, "Qısayol açarı yaradıldı", 201, "SHORTCUT_TOKEN_ISSUED");
});

/** DELETE /api/a11y/v1/shortcut-token { deviceId } — revoke. */
const revokeToken = asyncHandler(async (req, res) => {
  const deviceId = requireDeviceId(req.body?.deviceId ?? req.query.deviceId);
  return ok(res, await ShortcutService.revoke(deviceId, { ip: req.ip }), "Qısayol açarı ləğv edildi", 200, "SHORTCUT_TOKEN_REVOKED");
});

/** Bearer shortcut token → req.shortcut = { deviceId, prefix }. */
const authenticateShortcut = async (req, res, next) => {
  try {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
    const shortcut = token ? await ShortcutService.authenticate(token) : null;
    if (!shortcut) return fail(res, "Qısayol açarı etibarsızdır və ya ləğv edilib", 401, undefined, "SHORTCUT_TOKEN_INVALID");
    req.shortcut = shortcut;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/a11y/v1/sos  (Authorization: Bearer sfs_…)
 * { lat?, lng?, type?, note? } — header Idempotency-Key makes retries safe.
 */
const shortcutSos = asyncHandler(async (req, res) => {
  const b = req.body ?? {};
  const result = await ShortcutService.sendSos({
    deviceId: req.shortcut.deviceId,
    coords: optionalCoords(b.lat, b.lng),
    type: b.type === undefined ? "general" : requireEnum(b.type, sosTypes, "type"),
    note: typeof b.note === "string" ? b.note.slice(0, 200) : "",
    idempotencyKey: req.get("Idempotency-Key")?.slice(0, 200) || null,
    ip: req.ip,
  });
  return ok(
    res,
    result,
    result.duplicate ? "SOS siqnalınız artıq qəbul edilib" : "SOS siqnalı göndərildi",
    result.duplicate ? 200 : 201,
    result.duplicate ? "SOS_DUPLICATE" : "SOS_CREATED",
  );
});

export { tokenStatus, issueToken, revokeToken, authenticateShortcut, shortcutSos };
