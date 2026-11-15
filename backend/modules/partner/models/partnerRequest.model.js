import { Schema, Model } from "#constants";
import { pointSchema } from "#models/schemas/point.schema.js";

export const REQUEST_TYPES = ["resources", "help", "evacuation_support", "medical", "transport", "other"];
export const REQUEST_PRIORITIES = ["urgent", "normal"];
export const REQUEST_STATUS = ["submitted", "acknowledged", "in_progress", "fulfilled", "rejected"];

/** Resource / help request submitted by a partner organisation. */
const partnerRequestSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: "PartnerClient", required: true, index: true },
    partnerName: { type: String, required: true },
    type: { type: String, enum: REQUEST_TYPES, required: true },
    priority: { type: String, enum: REQUEST_PRIORITIES, default: "normal" },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    quantity: { type: Number, min: 0, default: null },
    unit: { type: String, trim: true, maxlength: 30, default: null },
    location: { type: pointSchema, default: null },
    status: { type: String, enum: REQUEST_STATUS, default: "submitted", index: true },
    response: { type: String, trim: true, maxlength: 1000, default: null },
    handledBy: { type: Schema.Types.ObjectId, ref: "Operator", default: null },
  },
  { timestamps: true, versionKey: false },
);

partnerRequestSchema.index({ createdAt: -1 });

export const PartnerRequest = Model("PartnerRequest", partnerRequestSchema);
