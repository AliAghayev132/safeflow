import { Schema, Model } from "#constants";
import { pointSchema } from "#models/schemas/point.schema.js";

export const damageSources = ["drone", "citizen", "operator"];
export const damageStatus = ["queued", "done", "failed", "reverted"];

/** One analysed image (drone frame / photo) and what it changed on the map. */
const damageSchema = new Schema(
  {
    source: { type: String, enum: damageSources, default: "drone" },
    droneCode: { type: String, default: null },
    location: { type: pointSchema, required: true },
    status: { type: String, enum: damageStatus, default: "queued", index: true },
    severity: { type: String, default: null }, // none | partial | blocked | collapsed
    passable: { type: Boolean, default: null },
    confidence: { type: Number, default: null },
    summary: { type: String, default: "" },
    hazards: { type: [String], default: [] },
    detections: { type: Schema.Types.Mixed, default: [] },
    provider: { type: String, default: null },
    mock: { type: Boolean, default: true },
    imageHash: { type: String, default: null },
    imageBytes: { type: Number, default: 0 },
    // Road segments changed by this assessment (so it can be reverted)
    applied: {
      type: [{ edgeId: String, action: { type: String, enum: ["closed", "damaged"] } }],
      default: [],
    },
    durationMs: { type: Number, default: null },
    createdBy: { type: String, default: "system" },
  },
  { timestamps: true, versionKey: false },
);

damageSchema.index({ createdAt: -1 });

damageSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    source: this.source,
    droneCode: this.droneCode,
    lat: this.location.coordinates[1],
    lng: this.location.coordinates[0],
    status: this.status,
    severity: this.severity,
    passable: this.passable,
    confidence: this.confidence,
    summary: this.summary,
    hazards: this.hazards,
    detections: this.detections,
    provider: this.provider,
    mock: this.mock,
    applied: this.applied.map((a) => ({ edgeId: a.edgeId, action: a.action })),
    durationMs: this.durationMs,
    createdBy: this.createdBy,
    createdAt: this.createdAt,
  };
};

export const DamageAssessment = Model("DamageAssessment", damageSchema);
