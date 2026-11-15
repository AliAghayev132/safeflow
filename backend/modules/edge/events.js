import { eventBus } from "#services/EventBus.js";
import { edgeEnv } from "./env.js";

/**
 * Edge-node events on the shared EventBus — hook points for other modules.
 *
 *   edge.connectivity  { online, error }       center reachable / lost
 *   edge.synced        { pushed, applied }     a sync cycle finished
 *   edge.notification  { audience, type, data, nodeId, shelterCode }
 *       Local notification on the assembly-point network (works with no
 *       internet). The volunteers module subscribes to deliver e.g.
 *       "doctor needed" to volunteers connected to this node.
 */
export const EDGE_EVENTS = {
  CONNECTIVITY: "edge.connectivity",
  SYNCED: "edge.synced",
  NOTIFICATION: "edge.notification",
};

/**
 * Publish a local notification on this node (no center required).
 * @param {object} p
 * @param {string} p.audience  e.g. "volunteers", "volunteers:doctor", "citizens"
 * @param {string} p.type      e.g. "volunteer_request"
 * @param {object} [p.data]
 */
export const notifyLocal = ({ audience, type, data = {} }) =>
  eventBus.publish(EDGE_EVENTS.NOTIFICATION, {
    audience,
    type,
    data,
    nodeId: edgeEnv.nodeId,
    shelterCode: edgeEnv.shelterCode,
  });
