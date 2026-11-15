import { Schema, Model } from "#constants";

// ============ CENTRAL SIDE ============

/** Registered edge node (one per assembly point). Token stored hashed. */
const edgeNodeSchema = new Schema(
  {
    nodeId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    shelterCode: { type: String, default: null },
    tokenHash: { type: String, required: true, select: false },
    tokenPrefix: { type: String, default: "" },
    status: { type: String, enum: ["active", "revoked"], default: "active" },
    lastSeenAt: { type: Date, default: null },
    lastSyncAt: { type: Date, default: null },
    lastPullAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    queued: { type: Number, default: 0 }, // items waiting on the node (reported)
    stats: {
      sos: { type: Number, default: 0 },
      sosDuplicates: { type: Number, default: 0 },
      statuses: { type: Number, default: 0 },
      statusesStale: { type: Number, default: 0 },
      details: { type: Number, default: 0 },
      batches: { type: Number, default: 0 },
    },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

edgeNodeSchema.methods.toPublic = function (health) {
  return {
    id: this._id.toString(),
    nodeId: this.nodeId,
    name: this.name,
    shelterCode: this.shelterCode,
    tokenPrefix: this.tokenPrefix,
    status: this.status,
    health: health ?? null,
    lastSeenAt: this.lastSeenAt,
    lastSyncAt: this.lastSyncAt,
    lastPullAt: this.lastPullAt,
    lastError: this.lastError,
    queued: this.queued,
    stats: { ...this.stats },
    createdAt: this.createdAt,
    revokedAt: this.revokedAt,
  };
};

export const EdgeNode = Model("EdgeNode", edgeNodeSchema);

// ============ EDGE SIDE ============

/**
 * Store-and-forward outbox on the edge node. One row per thing the center
 * must learn about; `key` coalesces updates (e.g. the latest status of a
 * device replaces an older unsynced one).
 */
const edgeOutboxSchema = new Schema(
  {
    kind: { type: String, enum: ["sos", "sosDetails", "status"], required: true },
    key: { type: String, required: true, unique: true },
    payload: { type: Schema.Types.Mixed, required: true },
    occurredAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: null },
    syncedAt: { type: Date, default: null, index: true },
    lastError: { type: String, default: null },
    result: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true, versionKey: false, minimize: false },
);

edgeOutboxSchema.index({ syncedAt: 1, nextAttemptAt: 1 });

export const EdgeOutbox = Model("EdgeOutbox", edgeOutboxSchema);
