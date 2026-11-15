import { path } from "#lib";
import { config } from "#config"; // loads .env first

const flag = (v) => String(v ?? "").toLowerCase() === "true";
const num = (v) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * Edge-node runtime identity. The SAME backend code base runs either as the
 * central server (default) or as an edge node at an assembly point
 * (EDGE_MODE=true) with its own local MongoDB.
 */
export const edgeEnv = {
  mode: flag(process.env.EDGE_MODE),
  nodeId: process.env.EDGE_NODE_ID || null,
  shelterCode: process.env.EDGE_SHELTER_CODE || null,
  centralUrl: (process.env.CENTRAL_URL || "").replace(/\/$/, ""),
  token: process.env.EDGE_TOKEN || "",
  // Built citizen PWA served by the edge node (captive portal landing page)
  staticDir:
    process.env.EDGE_STATIC_DIR ||
    path.resolve(process.cwd(), "..", "client-citizen", "dist"),
  // Where captive-portal probes are redirected (default: same host, /)
  portalUrl: process.env.EDGE_PORTAL_URL || null,
  // Test / tuning override for the sync loop interval
  syncIntervalMs: num(process.env.EDGE_SYNC_INTERVAL_MS),
  isTest: config.isTest,
};
