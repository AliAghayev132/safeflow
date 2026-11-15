import { Schema, Model } from "#constants";
import { pointSchema } from "#models/schemas/point.schema.js";

export const droneStatus = ["idle", "loading", "en_route", "returning", "charging"];

/** Supply drone (simulated today, a real fleet via DroneProvider tomorrow). */
const droneSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: droneStatus, default: "idle" },
    batteryPct: { type: Number, min: 0, max: 100, default: 100 },
    payloadKg: { type: Number, min: 0, required: true },
    speedKmh: { type: Number, min: 1, default: 60 },
    rangeKm: { type: Number, min: 1, default: 20 },
    location: { type: pointSchema, required: true },
    base: { type: pointSchema, required: true },
    target: { type: pointSchema, default: null },
    delivery: { type: Schema.Types.ObjectId, ref: "Delivery", default: null },
    loadKg: { type: Number, default: 0 },
    // Ground-handling countdown while status = loading
    loadingRemainingSec: { type: Number, default: 0 },
    statusChangedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

droneSchema.methods.toPublic = function () {
  const pt = (p) => (p ? { lat: p.coordinates[1], lng: p.coordinates[0] } : null);
  return {
    id: this._id.toString(),
    code: this.code,
    name: this.name,
    status: this.status,
    batteryPct: Math.round(this.batteryPct * 10) / 10,
    payloadKg: this.payloadKg,
    speedKmh: this.speedKmh,
    rangeKm: this.rangeKm,
    lat: this.location.coordinates[1],
    lng: this.location.coordinates[0],
    base: pt(this.base),
    target: pt(this.target),
    delivery: this.delivery?.toString() ?? null,
    loadKg: this.loadKg,
    statusChangedAt: this.statusChangedAt,
  };
};

export const Drone = Model("Drone", droneSchema);
