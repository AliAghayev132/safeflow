import { Schema, Model } from "#constants";

export const supplyKinds = ["water", "food", "medicine", "first_aid"];
export const supplyPriority = ["urgent", "normal"];
// pending → in_progress (≥1 delivery underway) → delivered (all weight
// received) ; cancelled at any point before delivered
export const supplyStatus = ["pending", "in_progress", "delivered", "cancelled"];

const itemSchema = new Schema(
  {
    kind: { type: String, enum: supplyKinds, required: true },
    quantity: { type: Number, min: 1, required: true },
    unit: { type: String, default: "" },
  },
  { _id: false },
);

/** Supply request for an assembly point. */
const supplyRequestSchema = new Schema(
  {
    shelter: { type: Schema.Types.ObjectId, ref: "Shelter", required: true, index: true },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    priority: { type: String, enum: supplyPriority, default: "normal" },
    status: { type: String, enum: supplyStatus, default: "pending", index: true },
    source: { type: String, enum: ["manual", "auto"], default: "manual" },
    totalKg: { type: Number, default: 0 },
    dispatchedKg: { type: Number, default: 0 },
    deliveredKg: { type: Number, default: 0 },
    note: { type: String, default: "", maxlength: 280 },
    createdBy: {
      id: { type: Schema.Types.ObjectId, ref: "Operator", default: null },
      username: { type: String, default: "system" },
    },
  },
  { timestamps: true, versionKey: false },
);

supplyRequestSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    shelter: this.shelter?._id?.toString?.() ?? this.shelter?.toString(),
    items: this.items.map((i) => ({ kind: i.kind, quantity: i.quantity, unit: i.unit })),
    priority: this.priority,
    status: this.status,
    source: this.source,
    totalKg: this.totalKg,
    dispatchedKg: this.dispatchedKg,
    deliveredKg: this.deliveredKg,
    remainingKg: Math.max(0, Math.round((this.totalKg - this.dispatchedKg) * 10) / 10),
    note: this.note,
    createdBy: this.createdBy?.username ?? "system",
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const SupplyRequest = Model("SupplyRequest", supplyRequestSchema);
