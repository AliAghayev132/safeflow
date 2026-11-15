import { Schema, Model, accessibilityFlags } from "#constants";

/**
 * Optional citizen profile (no account — keyed by device id). Attached to the
 * citizen's SOS tickets so medical teams see conditions / allergies.
 */
const contactSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, maxlength: 32 },
    relation: { type: String, trim: true, maxlength: 40 },
  },
  { _id: false },
);

const list = { type: [{ type: String, trim: true, maxlength: 120 }], default: [] };

const citizenProfileSchema = new Schema(
  {
    deviceId: { type: String, required: true, unique: true },
    fullName: { type: String, trim: true, maxlength: 100, default: "" },
    phone: { type: String, trim: true, maxlength: 32, default: "" },
    birthYear: { type: Number, min: 1900, max: 2100, default: null },
    bloodType: { type: String, trim: true, maxlength: 4, default: "" },
    conditions: list,
    allergies: list,
    medications: list,
    emergencyContacts: { type: [contactSchema], default: [] },
    language: { type: String, enum: ["az", "en", "ru"], default: "az" },
    // Special needs — limited mobility / wheelchair → SOS Priority #1 and
    // barrier-free routing; speech / hearing / vision raise SOS priority.
    accessibility: {
      limitedMobility: { type: Boolean, default: false },
      wheelchair: { type: Boolean, default: false },
      speechImpaired: { type: Boolean, default: false },
      hearingImpaired: { type: Boolean, default: false },
      visionImpaired: { type: Boolean, default: false },
    },
  },
  { timestamps: true, versionKey: false },
);

const accessibilityOf = (doc) =>
  Object.fromEntries(accessibilityFlags.map((f) => [f, Boolean(doc.accessibility?.[f])]));

citizenProfileSchema.methods.toPublic = function () {
  return {
    fullName: this.fullName,
    phone: this.phone,
    birthYear: this.birthYear,
    bloodType: this.bloodType,
    conditions: this.conditions,
    allergies: this.allergies,
    medications: this.medications,
    emergencyContacts: this.emergencyContacts.map((c) => ({
      name: c.name,
      phone: c.phone,
      relation: c.relation,
    })),
    language: this.language,
    accessibility: accessibilityOf(this),
    updatedAt: this.updatedAt,
  };
};

export const CitizenProfile = Model("CitizenProfile", citizenProfileSchema);
