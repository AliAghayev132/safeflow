import { asyncHandler } from "#utils";
import { PartnerDataService } from "../services/PartnerDataService.js";
import { serializeRequest } from "../core/serializers.js";

/** GET /api/partner/v1/incidents — incidents:read */
const incidents = asyncHandler(async (_req, res) => {
  const data = await PartnerDataService.incidents();
  res.locals.partnerCount = data.incidents.length;
  res.json(data);
});

/** GET /api/partner/v1/assembly-points — assembly_points:read */
const assemblyPoints = asyncHandler(async (_req, res) => {
  const data = await PartnerDataService.assemblyPoints();
  res.locals.partnerCount = data.assemblyPoints.length;
  res.json(data);
});

/** GET /api/partner/v1/roads — roads:read */
const roads = asyncHandler(async (_req, res) => {
  const data = await PartnerDataService.roads();
  res.locals.partnerCount = data.roads.length;
  res.json(data);
});

/** POST /api/partner/v1/requests — requests:write */
const createRequest = asyncHandler(async (req, res) => {
  const request = await PartnerDataService.createRequest(req.partner.client, req.body);
  res.status(201).json({ request: serializeRequest(request) });
});

/** GET /api/partner/v1/requests — own requests (requests:write) */
const listRequests = asyncHandler(async (req, res) => {
  const requests = await PartnerDataService.listOwnRequests(req.partner.client, req.query);
  res.locals.partnerCount = requests.length;
  res.json({ requests });
});

/** GET /api/partner/v1/requests/:id */
const getRequest = asyncHandler(async (req, res) => {
  res.json({ request: await PartnerDataService.getOwnRequest(req.partner.client, req.params.id) });
});

/** GET /api/partner/v1/me — the calling client (no secrets) */
const me = asyncHandler(async (req, res) => {
  const c = req.partner.client;
  res.json({
    clientId: c.clientId,
    name: c.name,
    type: c.type,
    status: c.status,
    scopes: req.partner.scopes,
    rateLimitPerMin: c.rateLimitPerMin,
  });
});

export { incidents, assemblyPoints, roads, createRequest, listRequests, getRequest, me };
