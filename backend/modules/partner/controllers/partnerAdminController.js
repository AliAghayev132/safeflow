import { AuditLog } from "#models";
import { asyncHandler, ok } from "#utils";
import { AuditService } from "#services/AuditService.js";
import { PartnerClientService } from "../services/PartnerClientService.js";
import { PartnerDataService } from "../services/PartnerDataService.js";
import { WebhookService } from "../services/WebhookService.js";
import { PartnerRealtime } from "../services/PartnerRealtime.js";
import { PARTNER_SCOPES, PARTNER_TYPES, PARTNER_STATUS, PARTNER_EVENTS } from "../core/scopes.js";

const target = (client) => ({ type: "partner_client", id: client._id, label: client.name });

/** GET /api/partner/admin/meta — enums for the admin UI */
const meta = asyncHandler(async (_req, res) =>
  ok(res, { scopes: PARTNER_SCOPES, types: PARTNER_TYPES, statuses: PARTNER_STATUS, events: PARTNER_EVENTS }),
);

const listClients = asyncHandler(async (_req, res) => ok(res, { clients: await PartnerClientService.list() }));

/** POST /clients → { client, clientSecret } (secret shown once) */
const createClient = asyncHandler(async (req, res) => {
  const { client, clientSecret } = await PartnerClientService.create(req.body ?? {}, req.operator);
  await AuditService.fromRequest(req, "partner.client_create", target(client), {
    scopes: client.scopes,
    rateLimitPerMin: client.rateLimitPerMin,
    requireMtls: client.requireMtls,
  });
  return ok(res, { client: client.toAdmin(), clientSecret }, undefined, 201, "PARTNER_CREATED");
});

const updateClient = asyncHandler(async (req, res) => {
  const client = await PartnerClientService.update(req.params.id, req.body ?? {});
  await AuditService.fromRequest(req, "partner.client_update", target(client), { changes: req.body });
  return ok(res, { client: client.toAdmin() }, undefined, 200, "PARTNER_UPDATED");
});

/** POST /clients/:id/status { status: active|limited|suspended } — one click */
const setStatus = asyncHandler(async (req, res) => {
  const { client, previous } = await PartnerClientService.setStatus(req.params.id, req.body?.status);
  if (client.status !== "active") PartnerRealtime.disconnectClient(client._id.toString());
  await AuditService.fromRequest(req, `partner.client_${client.status}`, target(client), {
    previous,
    status: client.status,
  });
  return ok(res, { client: client.toAdmin() }, undefined, 200, "PARTNER_STATUS_UPDATED");
});

const rotateSecret = asyncHandler(async (req, res) => {
  const { client, clientSecret } = await PartnerClientService.rotateSecret(req.params.id);
  PartnerRealtime.disconnectClient(client._id.toString());
  await AuditService.fromRequest(req, "partner.secret_rotate", target(client));
  return ok(res, { client: client.toAdmin(), clientSecret }, undefined, 200, "PARTNER_SECRET_ROTATED");
});

const removeClient = asyncHandler(async (req, res) => {
  const client = await PartnerClientService.remove(req.params.id);
  PartnerRealtime.disconnectClient(client._id.toString());
  await AuditService.fromRequest(req, "partner.client_delete", target(client));
  return ok(res, null, undefined, 200, "PARTNER_DELETED");
});

/** POST /clients/:id/webhooks { url, events } → signing secret shown once */
const addWebhook = asyncHandler(async (req, res) => {
  const { client, webhook } = await PartnerClientService.addWebhook(req.params.id, req.body ?? {});
  await AuditService.fromRequest(req, "partner.webhook_add", target(client), { url: webhook.url, events: webhook.events });
  return ok(res, { client: client.toAdmin(), webhook }, undefined, 201, "PARTNER_WEBHOOK_ADDED");
});

const removeWebhook = asyncHandler(async (req, res) => {
  const client = await PartnerClientService.removeWebhook(req.params.id, req.params.webhookId);
  await AuditService.fromRequest(req, "partner.webhook_remove", target(client), { webhookId: req.params.webhookId });
  return ok(res, { client: client.toAdmin() }, undefined, 200, "PARTNER_WEBHOOK_REMOVED");
});

const deliveries = asyncHandler(async (req, res) =>
  ok(res, { deliveries: await WebhookService.deliveries(req.params.id, req.query.limit) }),
);

/** GET /clients/:id/activity — the client's recent API calls (audit log) */
const activity = asyncHandler(async (req, res) => {
  const client = await PartnerClientService.getById(req.params.id);
  const entries = await AuditLog.find({ "actor.id": client._id })
    .sort({ at: -1 })
    .limit(Math.min(200, Number(req.query.limit) || 50));
  return ok(res, { entries: entries.map((e) => e.toPublic()) });
});

// ============ PARTNER REQUESTS (crisis center) ============

const listRequests = asyncHandler(async (req, res) =>
  ok(res, { requests: await PartnerDataService.listAll(req.query) }),
);

const updateRequest = asyncHandler(async (req, res) => {
  const request = await PartnerDataService.updateStatus(req.params.id, req.body ?? {}, req.operator);
  await AuditService.fromRequest(
    req,
    "partner.request_status",
    { type: "partner_request", id: request._id, label: request.title },
    { status: request.status, partner: request.partnerName },
  );
  return ok(res, null, undefined, 200, "PARTNER_REQUEST_UPDATED");
});

export {
  meta,
  listClients,
  createClient,
  updateClient,
  setStatus,
  rotateSecret,
  removeClient,
  addWebhook,
  removeWebhook,
  deliveries,
  activity,
  listRequests,
  updateRequest,
};
