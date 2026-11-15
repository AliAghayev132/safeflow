import { Schema, Model, roadStatus } from "#constants";

/**
 * Road segment between two nodes (undirected). `status` and `congestion` are
 * driven by the traffic simulation endpoint and feed the routing service.
 */
const roadEdgeSchema = new Schema(
  {
    edgeId: { type: String, required: true, unique: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    name: { type: String, default: "" },
    lengthMeters: { type: Number, required: true },
    status: { type: String, enum: roadStatus, default: "open" },
    // 0 = free flow, 1 = gridlock
    congestion: { type: Number, default: 0, min: 0, max: 1 },
    closedReason: { type: String, default: "" },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

roadEdgeSchema.index({ status: 1 });

roadEdgeSchema.methods.toPublic = function () {
  return {
    edgeId: this.edgeId,
    from: this.from,
    to: this.to,
    name: this.name,
    lengthMeters: this.lengthMeters,
    status: this.status,
    congestion: this.congestion,
    closedReason: this.closedReason,
    closedAt: this.closedAt,
  };
};

export const RoadEdge = Model("RoadEdge", roadEdgeSchema);
