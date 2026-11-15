import { Schema, Model, shelterTypes } from "#constants";
import { pointSchema } from "./schemas/point.schema.js";

/**
 * Safe assembly point (shelter / park / stadium).
 * Reserve shelters start inactive and are opened by an approved alert.
 */
const shelterSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: shelterTypes, required: true },
    zone: { type: Schema.Types.ObjectId, ref: "Zone", required: true },
    location: { type: pointSchema, required: true },
    // Road-network node the shelter entrance is attached to
    nodeId: { type: String, required: true },
    address: { type: String, default: "" },
    capacity: { type: Number, required: true, min: 1 },
    occupancy: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    isReserve: { type: Boolean, default: false },
    // Step-free / wheelchair entrance and an on-site medical point
    accessible: { type: Boolean, default: true },
    medicalPoint: { type: Boolean, default: false },
    openedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

shelterSchema.index({ location: "2dsphere" });
shelterSchema.index({ isActive: 1 });

shelterSchema.virtual("occupancyRate").get(function () {
  return this.capacity ? this.occupancy / this.capacity : 0;
});

shelterSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    code: this.code,
    name: this.name,
    type: this.type,
    zone: this.zone?._id?.toString?.() ?? this.zone?.toString(),
    lat: this.location.coordinates[1],
    lng: this.location.coordinates[0],
    nodeId: this.nodeId,
    address: this.address,
    capacity: this.capacity,
    occupancy: this.occupancy,
    occupancyRate: Number(this.occupancyRate.toFixed(4)),
    isActive: this.isActive,
    isReserve: this.isReserve,
    accessible: this.accessible,
    medicalPoint: this.medicalPoint,
    openedAt: this.openedAt,
  };
};

export const Shelter = Model("Shelter", shelterSchema);
