import { EventLogService } from "#services";
import { asyncHandler, ok } from "#utils";

/**
 * GET /api/events?after=<seq>&epoch=<epoch>
 * Polling fallback when WebSockets are unavailable, and the same replay used
 * by the socket "sync" handshake. Filtered by the caller's permissions
 * (staff token) or device id (citizen).
 */
const pollEvents = asyncHandler(async (req, res) =>
  ok(res, EventLogService.since(req.principal, req.query.after, { epoch: req.query.epoch })),
);

export { pollEvents };
