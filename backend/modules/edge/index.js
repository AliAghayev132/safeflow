/**
 * Feature module: edge node — local network at an assembly point
 * (works with no internet; syncs with the center when reachable).
 *
 * Flag: features.edgeNode · Config section: edge · Docs: /edge/README.md
 */
import { edgeEnv } from "./env.js";
import { EdgeRouter, CaptiveRouter } from "./routes.js";
import { EdgeOutboxService } from "./services/EdgeOutboxService.js";
import { EdgeSyncService } from "./services/EdgeSyncService.js";

export { EDGE_EVENTS, notifyLocal } from "./events.js";
export { edgeEnv };

export default {
  name: "edge",
  feature: "edgeNode",
  defaults: {
    syncIntervalMs: 15000,
    pushBatchSize: 200,
    backoffBaseMs: 2000,
    backoffMaxMs: 300000,
    requestTimeoutMs: 8000,
    onlineStaleMs: 120000,
    rateLimitPerMin: 600,
  },
  routers: [{ path: "/edge/v1", router: EdgeRouter }],
  rootRouters: [{ path: "/", router: CaptiveRouter }],
  async init() {
    if (!edgeEnv.mode) return;
    EdgeOutboxService.subscribe();
    EdgeSyncService.start();
    if (!edgeEnv.isTest) {
      console.log(`📡 Edge node "${edgeEnv.nodeId}" (${edgeEnv.shelterCode}) → center ${edgeEnv.centralUrl || "—"}`);
    }
  },
  async stop() {
    EdgeSyncService.stop();
  },
};
