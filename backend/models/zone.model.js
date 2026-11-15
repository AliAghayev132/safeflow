import { Schema, Model } from "#constants";
import { pointSchema, polygonSchema } from "./schemas/point.schema.js";

/**
 * City zone (district). Used for citizen district selection, SOS grouping and
 * the dispatcher's per-zone analytics.
 */
const zoneSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    center: { type: pointSchema, required: true },
    area: { type: polygonSchema, required: true },
    population: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

zoneSchema.index({ area: "2dsphere" });
zoneSchema.index({ center: "2dsphere" });

zoneSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    code: this.code,
    name: this.name,
    center: { lat: this.center.coordinates[1], lng: this.center.coordinates[0] },
    // Leaflet order: [lat, lng]
    polygon: this.area.coordinates[0].map(([lng, lat]) => [lat, lng]),
    population: this.population,
  };
};

export const Zone = Model("Zone", zoneSchema);
