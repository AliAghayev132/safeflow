import { Schema, Model } from "#constants";
import { pointSchema } from "./schemas/point.schema.js";

/** Intersection in the (simulated) city road graph. */
const roadNodeSchema = new Schema(
  {
    nodeId: { type: String, required: true, unique: true },
    location: { type: pointSchema, required: true },
  },
  { versionKey: false },
);

roadNodeSchema.index({ location: "2dsphere" });

export const RoadNode = Model("RoadNode", roadNodeSchema);
