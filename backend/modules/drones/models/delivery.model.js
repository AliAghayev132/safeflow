import { Schema, Model } from "#constants";

// loading → en_route → arrived → confirmed ; failed if the provider aborts
export const deliveryStatus = ["loading", "en_route", "arrived", "confirmed", "failed"];

/** One drone trip carrying (part of) a supply request. */
const deliverySchema = new Schema(
  {
    request: { type: Schema.Types.ObjectId, ref: "SupplyRequest", required: true, index: true },
    shelter: { type: Schema.Types.ObjectId, ref: "Shelter", required: true, index: true },
    drone: { type: Schema.Types.ObjectId, ref: "Drone", required: true },
    status: { type: String, enum: deliveryStatus, default: "loading", index: true },
    loadKg: { type: Number, required: true },
    distanceKm: { type: Number, default: 0 },
    etaSec: { type: Number, default: 0 },
    etaAt: { type: Date, default: null },
    startedAt: { type: Date, default: Date.now },
    arrivedAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    confirmedBy: { type: String, default: null },
    approvedBy: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

deliverySchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    request: this.request?.toString(),
    shelter: this.shelter?.toString(),
    drone: this.drone?.toString(),
    status: this.status,
    loadKg: this.loadKg,
    distanceKm: this.distanceKm,
    etaSec: this.etaSec,
    etaAt: this.etaAt,
    startedAt: this.startedAt,
    arrivedAt: this.arrivedAt,
    confirmedAt: this.confirmedAt,
    confirmedBy: this.confirmedBy,
    approvedBy: this.approvedBy,
  };
};

export const Delivery = Model("Delivery", deliverySchema);
