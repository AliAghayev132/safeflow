import { RoadService } from "#services";
import { asyncHandler, ok } from "#utils";

/**
 * Simulated road / traffic endpoint ("external routing API" stand-in).
 * GET /api/roads          → full network (nodes + edges with status)
 * GET /api/roads/traffic  → only closed / congested segments
 */
const getNetwork = asyncHandler(async (_req, res) =>
  ok(res, RoadService.network()),
);

const getTraffic = asyncHandler(async (_req, res) =>
  ok(res, { edges: await RoadService.traffic(), generatedAt: new Date() }),
);

export { getNetwork, getTraffic };
