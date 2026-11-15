import { Schema, Model } from "#constants";
import { pointSchema } from "./schemas/point.schema.js";

/** "I'm safe" share link — public, expires automatically (TTL index). */
const safeShareSchema = new Schema(
  {
    token: { type: String, required: true, unique: true },
    deviceId: { type: String, required: true, index: true },
    displayName: { type: String, trim: true, maxlength: 80, default: "" },
    location: { type: pointSchema, default: null },
    shelterName: { type: String, default: null },
    message: { type: String, trim: true, maxlength: 280, default: "" },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);

safeShareSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

safeShareSchema.methods.toPublic = function () {
  return {
    token: this.token,
    displayName: this.displayName,
    lat: this.location?.coordinates[1] ?? null,
    lng: this.location?.coordinates[0] ?? null,
    shelterName: this.shelterName,
    message: this.message,
    at: this.createdAt.toISOString(),
    expiresAt: this.expiresAt.toISOString(),
  };
};

export const SafeShare = Model("SafeShare", safeShareSchema);
