import { Schema, Model, brigadeTypes, brigadeStatus } from "#constants";
import { pointSchema } from "./schemas/point.schema.js";

/** Rescue brigade (fire / medical / rescue) tracked live on the dashboard. */
const brigadeSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: brigadeTypes, required: true },
    status: { type: String, enum: brigadeStatus, default: "available" },
    members: { type: Number, default: 4 },
    location: { type: pointSchema, required: true },
    base: { type: pointSchema, required: true },
    target: { type: pointSchema, default: null },
    alert: { type: Schema.Types.ObjectId, ref: "Alert", default: null },
    statusChangedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

brigadeSchema.index({ location: "2dsphere" });
brigadeSchema.index({ status: 1, type: 1 });

brigadeSchema.methods.toPublic = function () {
  const pt = (p) => (p ? { lat: p.coordinates[1], lng: p.coordinates[0] } : null);
  return {
    id: this._id.toString(),
    code: this.code,
    name: this.name,
    type: this.type,
    status: this.status,
    members: this.members,
    lat: this.location.coordinates[1],
    lng: this.location.coordinates[0],
    base: pt(this.base),
    target: pt(this.target),
    alert: this.alert?.toString() ?? null,
    statusChangedAt: this.statusChangedAt,
  };
};

export const Brigade = Model("Brigade", brigadeSchema);
