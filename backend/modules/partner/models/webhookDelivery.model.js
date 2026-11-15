import { Schema, Model } from "#constants";

/** Delivery log of one webhook event (with retry state). */
const webhookDeliverySchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: "PartnerClient", required: true, index: true },
    subscriptionId: { type: String, required: true },
    url: { type: String, required: true },
    event: { type: String, required: true },
    deliveryId: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "delivered", "failed"], default: "pending" },
    attempts: { type: Number, default: 0 },
    lastStatusCode: { type: Number, default: null },
    lastError: { type: String, default: null },
    nextAttemptAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

webhookDeliverySchema.index({ client: 1, createdAt: -1 });
// Keep the log bounded: deliveries expire after 7 days
webhookDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

webhookDeliverySchema.methods.toAdmin = function () {
  return {
    id: this.deliveryId,
    subscriptionId: this.subscriptionId,
    url: this.url,
    event: this.event,
    status: this.status,
    attempts: this.attempts,
    lastStatusCode: this.lastStatusCode,
    lastError: this.lastError,
    nextAttemptAt: this.nextAttemptAt,
    deliveredAt: this.deliveredAt,
    createdAt: this.createdAt,
  };
};

export const WebhookDelivery = Model("WebhookDelivery", webhookDeliverySchema);
