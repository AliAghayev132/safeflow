import { Schema } from "#constants";

/**
 * Reusable GeoJSON Point sub-schema. Coordinates are [lng, lat].
 * Add `schema.index({ <field>: "2dsphere" })` on the parent schema.
 */
const pointSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point", required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 2,
        message: "Point coordinates must be [lng, lat]",
      },
    },
  },
  { _id: false },
);

const polygonSchema = new Schema(
  {
    type: { type: String, enum: ["Polygon"], default: "Polygon" },
    coordinates: { type: [[[Number]]], required: true },
  },
  { _id: false },
);

export { pointSchema, polygonSchema };
