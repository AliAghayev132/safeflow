import { Schema, Model } from "#constants";
import { pointSchema } from "#models/schemas/point.schema.js";
import { PROFESSIONS, AVAILABILITY, VERIFICATION } from "../constants.js";

const documentSchema = new Schema(
  {
    originalName: { type: String, maxlength: 160 },
    mime: { type: String },
    size: { type: Number },
    storedName: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

/**
 * Professional volunteer, keyed by the citizen device id (no account).
 * `lastLocation` is private: returned only to dispatchers, and only while the
 * volunteer has accepted an open request.
 */
const volunteerProfileSchema = new Schema(
  {
    deviceId: { type: String, required: true, unique: true },
    displayName: { type: String, trim: true, maxlength: 80, default: "" },
    phone: { type: String, trim: true, maxlength: 32, default: "" },
    profession: { type: String, enum: PROFESSIONS, required: true },
    skills: { type: [{ type: String, trim: true, maxlength: 60 }], default: [] },
    consent: {
      given: { type: Boolean, default: false },
      at: { type: Date, default: null },
      withdrawnAt: { type: Date, default: null },
    },
    availability: { type: String, enum: AVAILABILITY, default: "not_ready" },
    verification: { type: String, enum: VERIFICATION, default: "not_required" },
    verificationNote: { type: String, maxlength: 280, default: "" },
    verifiedAt: { type: Date, default: null },
    documents: { type: [documentSchema], default: [] },
    lastLocation: { type: pointSchema, default: null },
    lastLocationAt: { type: Date, default: null },
    currentShelter: { type: Schema.Types.ObjectId, ref: "Shelter", default: null },
    zone: { type: Schema.Types.ObjectId, ref: "Zone", default: null },
  },
  { timestamps: true, versionKey: false },
);

volunteerProfileSchema.index({ "consent.given": 1, availability: 1, profession: 1 });
volunteerProfileSchema.index({ verification: 1 });
volunteerProfileSchema.index({ lastLocation: "2dsphere" });

/** Shape used by the pure matching engine. */
volunteerProfileSchema.methods.toEngine = function () {
  return {
    deviceId: this.deviceId,
    profession: this.profession,
    consentGiven: this.consent?.given === true,
    availability: this.availability,
    currentShelterId: this.currentShelter?.toString() ?? null,
    location: this.lastLocation
      ? { lat: this.lastLocation.coordinates[1], lng: this.lastLocation.coordinates[0] }
      : null,
  };
};

/** The volunteer's own view (includes nothing about other volunteers). */
volunteerProfileSchema.methods.toSelf = function () {
  return {
    displayName: this.displayName,
    phone: this.phone,
    profession: this.profession,
    skills: this.skills,
    consent: {
      given: this.consent?.given === true,
      at: this.consent?.at ?? null,
      withdrawnAt: this.consent?.withdrawnAt ?? null,
    },
    availability: this.availability,
    verification: this.verification,
    verificationNote: this.verificationNote,
    documents: this.documents.map((d) => ({
      id: d._id.toString(),
      originalName: d.originalName,
      mime: d.mime,
      size: d.size,
      uploadedAt: d.uploadedAt,
    })),
    currentShelter: this.currentShelter?.toString() ?? null,
    updatedAt: this.updatedAt,
  };
};

export const VolunteerProfile = Model("VolunteerProfile", volunteerProfileSchema);
