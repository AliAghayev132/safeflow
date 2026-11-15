import { crypto } from "#lib";
import { AppError } from "#utils";
import { ConfigService } from "#services/ConfigService.js";
import { EdgeNode } from "../models.js";
import { nodeHealth } from "../engine.js";

const hash = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const newToken = () => `edge_${crypto.randomBytes(24).toString("base64url")}`;

/**
 * Central-side registry of edge nodes. A node authenticates with a bearer
 * token issued once by an admin (only its SHA-256 hash is stored).
 */
class EdgeRegistryService {
  static health(node, now = Date.now()) {
    return nodeHealth(node, now, ConfigService.get("edge").onlineStaleMs);
  }

  static publicOf(node) {
    return node.toPublic(EdgeRegistryService.health(node));
  }

  static async list() {
    const nodes = await EdgeNode.find().sort({ createdAt: 1 });
    return nodes.map(EdgeRegistryService.publicOf);
  }

  /** Create a node → returns the token ONCE. */
  static async create({ nodeId, name, shelterCode }) {
    const id = String(nodeId ?? "").trim();
    if (!/^[a-z0-9][a-z0-9_-]{2,48}$/i.test(id)) {
      throw AppError.badRequest("nodeId: 3–49 hərf/rəqəm, '-' və '_'", "EDGE_NODE_ID");
    }
    if (!String(name ?? "").trim()) throw AppError.badRequest("name tələb olunur", "EDGE_NODE_NAME");
    if (await EdgeNode.exists({ nodeId: id })) throw AppError.conflict("Bu nodeId artıq mövcuddur", "EDGE_NODE_EXISTS");

    const token = newToken();
    const node = await EdgeNode.create({
      nodeId: id,
      name: String(name).trim(),
      shelterCode: shelterCode ? String(shelterCode).toUpperCase() : null,
      tokenHash: hash(token),
      tokenPrefix: token.slice(0, 10),
    });
    return { node: EdgeRegistryService.publicOf(node), token };
  }

  static async rotate(id) {
    const node = await EdgeNode.findById(id);
    if (!node) throw AppError.notFound("Edge node tapılmadı");
    const token = newToken();
    node.tokenHash = hash(token);
    node.tokenPrefix = token.slice(0, 10);
    node.status = "active";
    node.revokedAt = null;
    await node.save();
    return { node: EdgeRegistryService.publicOf(node), token };
  }

  static async revoke(id) {
    const node = await EdgeNode.findById(id);
    if (!node) throw AppError.notFound("Edge node tapılmadı");
    node.status = "revoked";
    node.revokedAt = new Date();
    await node.save();
    return EdgeRegistryService.publicOf(node);
  }

  /** Active node for a bearer token, or null. */
  static async verify(token) {
    if (!token || typeof token !== "string" || !token.startsWith("edge_")) return null;
    return EdgeNode.findOne({ tokenHash: hash(token), status: "active" });
  }

  static async touch(node, patch = {}) {
    Object.assign(node, { lastSeenAt: new Date(), ...patch });
    await node.save();
    return node;
  }
}

export { EdgeRegistryService, hash as hashEdgeToken };
