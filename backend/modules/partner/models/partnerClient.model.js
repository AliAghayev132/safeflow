import { Schema, Model } from "#constants";
import { PARTNER_SCOPES, PARTNER_TYPES, PARTNER_STATUS, PARTNER_EVENTS } from "../core/scopes.js";

/**
 * Webhook subscription. The signing secret has to be kept in a form we can
 * use for HMAC, so it is stored (select: false) and shown to the admin once.
 */
const webhookSchema = new Schema(
  {
    url: { type: String, required: true, trim: true, maxlength: 500 },
    events: [{ type: String, enum: PARTNER_EVENTS }],
    secret: { type: String, required: true, select: false },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: true },
);

/**
 * Partner organisation registered for the Partner API (OAuth2 client).
 * The client secret is stored only as a bcrypt hash.
 */
const partnerClientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: PARTNER_TYPES, default: "other" },
    contact: { type: String, trim: true, maxlength: 200, default: "" },
    clientId: { type: String, required: true, unique: true },
    secretHash: { type: String, required: true, select: false },
    secretRotatedAt: { type: Date, default: () => new Date() },
    // Bumped on rotate / suspend → previously issued tokens stop working
    tokenVersion: { type: Number, default: 1 },
    scopes: [{ type: String, enum: PARTNER_SCOPES }],
    status: { type: String, enum: PARTNER_STATUS, default: "active" },
    rateLimitPerMin: { type: Number, min: 1, max: 100000, default: 120 },
    requireMtls: { type: Boolean, default: false },
    certFingerprints: { type: [String], default: [] },
    webhooks: { type: [webhookSchema], default: [] },
    lastSeenAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Operator", default: null },
  },
  { timestamps: true, versionKey: false },
);

partnerClientSchema.methods.toAdmin = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    type: this.type,
    contact: this.contact,
    clientId: this.clientId,
    scopes: this.scopes,
    status: this.status,
    rateLimitPerMin: this.rateLimitPerMin,
    requireMtls: this.requireMtls,
    certFingerprints: this.certFingerprints,
    webhooks: this.webhooks.map((w) => ({
      id: w._id.toString(),
      url: w.url,
      events: w.events,
      active: w.active,
      createdAt: w.createdAt,
    })),
    secretRotatedAt: this.secretRotatedAt,
    lastSeenAt: this.lastSeenAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const PartnerClient = Model("PartnerClient", partnerClientSchema);
