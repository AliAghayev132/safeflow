import { Operator } from "#models";
import {
  ConfigService,
  AuditService,
  RbacService,
  RouteService,
  EventLogService,
  socketService,
} from "#services";
import { asyncHandler, ok } from "#utils";

/** GET /api/admin/config — effective config, overrides, defaults. */
const getConfig = asyncHandler(async (_req, res) => ok(res, ConfigService.snapshot()));

/** PATCH /api/admin/config — deep-partial patch, validated against defaults. */
const updateConfig = asyncHandler(async (req, res) => {
  const before = ConfigService.snapshot().overrides;
  const snapshot = await ConfigService.update(req.body ?? {}, req.operator);
  await AuditService.fromRequest(req, "config.update", { type: "config", id: "crisis" }, {
    patch: req.body,
    previousOverrides: before,
    version: snapshot.version,
  });
  return ok(res, snapshot, "Konfiqurasiya yeniləndi", 200, "CONFIG_UPDATED");
});

/** POST /api/admin/config/reset — back to config/defaults/crisis.json. */
const resetConfig = asyncHandler(async (req, res) => {
  const before = ConfigService.snapshot().overrides;
  const snapshot = await ConfigService.reset(req.operator);
  await AuditService.fromRequest(req, "config.reset", { type: "config", id: "crisis" }, { previousOverrides: before });
  return ok(res, snapshot, "Defolt dəyərlər bərpa olundu", 200, "CONFIG_RESET");
});

/** GET /api/admin/audit?action&actor&from&to&before&limit */
const listAudit = asyncHandler(async (req, res) =>
  ok(res, { entries: await AuditService.list(req.query) }),
);

/** GET /api/admin/roles — RBAC config (roles → permissions). */
const listRoles = asyncHandler(async (_req, res) => ok(res, { roles: RbacService.describe() }));

/** GET /api/admin/operators */
const listOperators = asyncHandler(async (_req, res) => {
  const operators = await Operator.find().sort({ role: 1, username: 1 });
  return ok(res, { operators: operators.map((o) => ({ ...o.toPublic(), isActive: o.isActive, lastLoginAt: o.lastLoginAt })) });
});

/** GET /api/admin/system — routing fallback state, realtime log, sockets. */
const getSystem = asyncHandler(async (_req, res) =>
  ok(res, {
    routing: RouteService.status(),
    realtime: {
      epoch: EventLogService.epoch,
      lastSeq: EventLogService.lastSeq,
      connections: socketService.connectionCount(),
    },
    uptimeSec: Math.round(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
  }),
);

export { getConfig, updateConfig, resetConfig, listAudit, listRoles, listOperators, getSystem };
