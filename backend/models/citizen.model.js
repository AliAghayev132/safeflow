import { Schema, Model, citizenStatus } from "#constants";
import { pointSchema } from "./schemas/point.schema.js";

/**
 * Anonymous citizen session, keyed by a client-generated device id.
 * Stores the last known location and the active evacuation route so the
 * rerouting engine can find who is affected by a closure / full shelter.
 */
const routeSchema = new Schema(
  {
    nodeIds: { type: [String], default: [] },
    edgeIds: { type: [String], default: [] },
    // Leaflet order: [lat, lng]
    path: { type: [[Number]], default: [] },
    distanceMeters: { type: Number, default: 0 },
    durationSec: { type: Number, default: 0 },
    provider: { type: String, default: "graph" },
    approximate: { type: Boolean, default: false },
    bearing: { type: Number, default: null },
    computedAt: { type: Date, default: null },
  },
  { _id: false },
);

const citizenSchema = new Schema(
  {
    deviceId: { type: String, required: true, unique: true },
    location: { type: pointSchema, default: null },
    zone: { type: Schema.Types.ObjectId, ref: "Zone", default: null },
    status: { type: String, enum: citizenStatus, default: "unknown" },
    targetShelter: {
      type: Schema.Types.ObjectId,
      ref: "Shelter",
      default: null,
    },
    route: { type: routeSchema, default: null },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

citizenSchema.index({ "route.edgeIds": 1 });
citizenSchema.index({ targetShelter: 1, status: 1 });
citizenSchema.index({ status: 1 });

export const Citizen = Model("Citizen", citizenSchema);
