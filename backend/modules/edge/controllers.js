import { AuditService } from "#services/AuditService.js";
import { asyncHandler, ok, AppError } from "#utils";
import { edgeEnv } from "./env.js";
import { EdgeRegistryService } from "./services/EdgeRegistryService.js";
import { EdgeIngestService } from "./services/EdgeIngestService.js";
import { EdgeOutboxService } from "./services/EdgeOutboxService.js";
import { EdgeSyncService } from "./services/EdgeSyncService.js";

const edgeActor = (node) => ({ _id: null, username: `edge:${node.nodeId}`, role: "edge_node" });

// ============ PUBLIC ============

/**
 * GET /api/edge/v1/info — lets the citizen app know it is served by an edge
 * node (banner "local network, no internet") and show the sync state.
 */
const info = asyncHandler(async (_req, res) => {
  if (!edgeEnv.mode) return ok(res, { edgeMode: false });
  const outbox = await EdgeOutboxService.summary();
  const st = EdgeSyncService.state;
  return ok(res, {
    edgeMode: true,
    nodeId: edgeEnv.nodeId,
    shelterCode: edgeEnv.shelterCode,
    centralOnline: st.online,
    lastSyncAt: st.lastSyncAt,
    lastPullAt: st.lastPullAt,
    pending: outbox.pending,
    failed: outbox.failed,
  });
});

// ============ CENTRAL: node-authenticated ============

const ping = asyncHandler(async (req, res) => {
  await EdgeRegistryService.touch(req.edgeNode, { lastError: null });
  return ok(res, { serverTime: new Date().toISOString(), nodeId: req.edgeNode.nodeId });
});

/** POST /api/edge/v1/sync { items, queued } */
const sync = asyncHandler(async (req, res) => {
  const node = req.edgeNode;
  const items = req.body?.items;
  if (!Array.isArray(items)) throw AppError.badRequest("items tələb olunur", "EDGE_ITEMS");
  const { results, counts } = await EdgeIngestService.apply(node, items);
  const remaining = Math.max(0, Number(req.body?.queued ?? 0) - results.filter((r) => r.ok).length);
  const failed = results.filter((r) => !r.ok);
  await EdgeRegistryService.touch(node, {
    lastSyncAt: new Date(),
    queued: remaining,
    lastError: failed.length ? `${failed.length} item(s) failed: ${failed[0].error}` : null,
  });
  await AuditService.record({
    operator: edgeActor(node),
    action: "edge.sync",
    target: { type: "edge_node", id: node.nodeId, label: node.name },
    details: { ...counts, received: items.length, failed: failed.length },
    ip: req.ip,
  });
  return ok(res, { results });
});

/** GET /api/edge/v1/snapshot */
const snapshot = asyncHandler(async (req, res) => {
  const data = await EdgeIngestService.snapshot(req.edgeNode);
  await EdgeRegistryService.touch(req.edgeNode, { lastPullAt: new Date() });
  return ok(res, data);
});

// ============ CENTRAL: admin (RBAC) ============

const listNodes = asyncHandler(async (_req, res) => ok(res, { nodes: await EdgeRegistryService.list() }));

const createNode = asyncHandler(async (req, res) => {
  const { node, token } = await EdgeRegistryService.create(req.body ?? {});
  await AuditService.fromRequest(req, "edge.node_create", { type: "edge_node", id: node.nodeId, label: node.name }, {
    shelterCode: node.shelterCode,
  });
  return ok(res, { node, token }, "Edge node yaradıldı", 201, "EDGE_NODE_CREATED");
});

const rotateNode = asyncHandler(async (req, res) => {
  const { node, token } = await EdgeRegistryService.rotate(req.params.id);
  await AuditService.fromRequest(req, "edge.node_rotate", { type: "edge_node", id: node.nodeId, label: node.name });
  return ok(res, { node, token }, "Yeni token yaradıldı", 200, "EDGE_TOKEN_ROTATED");
});

const revokeNode = asyncHandler(async (req, res) => {
  const node = await EdgeRegistryService.revoke(req.params.id);
  await AuditService.fromRequest(req, "edge.node_revoke", { type: "edge_node", id: node.nodeId, label: node.name });
  return ok(res, { node }, "Edge node bağlandı", 200, "EDGE_NODE_REVOKED");
});

// ============ EDGE: local admin ============

/** POST /api/edge/v1/local/sync-now?force=1 — run a sync cycle now. */
const syncNow = asyncHandler(async (req, res) => {
  if (!edgeEnv.mode) throw AppError.conflict("Bu server edge node deyil", "NOT_EDGE");
  const force = req.query.force === "1" || req.body?.force === true;
  const result = await EdgeSyncService.syncOnce({ force });
  return ok(res, { result, state: EdgeSyncService.state, outbox: await EdgeOutboxService.summary() });
});

const localStatus = asyncHandler(async (_req, res) => {
  if (!edgeEnv.mode) throw AppError.conflict("Bu server edge node deyil", "NOT_EDGE");
  return ok(res, { state: EdgeSyncService.state, outbox: await EdgeOutboxService.summary() });
});

export { info, ping, sync, snapshot, listNodes, createNode, rotateNode, revokeNode, syncNow, localStatus };
