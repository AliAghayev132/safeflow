import {
  Schema,
  Model,
  sosTypes,
  sosStatus,
  sosNeeds,
} from "#constants";
import { pointSchema } from "./schemas/point.schema.js";

/**
 * SOS ticket.
 *
 * `clientId` is generated on the device for every SOS — the idempotency key.
 * A network retry with the same clientId never creates a second ticket.
 */
const sosSignalSchema = new Schema(
  {
    clientId: { type: String, required: true, unique: true },
    // clientIds of repeated taps merged into this ticket (still idempotent)
    mergedClientIds: { type: [String], default: [], index: true },
    deviceId: { type: String, required: true, index: true },
    ip: { type: String, default: null, select: false },
    type: { type: String, enum: sosTypes, required: true },
    location: { type: pointSchema, required: true },
    zone: { type: Schema.Types.ObjectId, ref: "Zone", default: null },
    status: { type: String, enum: sosStatus, default: "pending" },

    // Optional, progressive triage details
    note: { type: String, default: "", maxlength: 500 },
    transcript: { type: String, default: "", maxlength: 1000 },
    needs: { type: [{ type: String, enum: sosNeeds }], default: [] },
    headcount: { type: Number, min: 1, max: 500, default: 1 },
    vulnerable: {
      elderly: { type: Boolean, default: false },
      child: { type: Boolean, default: false },
      disabled: { type: Boolean, default: false },
    },
    injuries: { type: String, default: "", maxlength: 280 },
    // Special needs of the reporting citizen (profile snapshot + SOS body)
    accessibility: {
      limitedMobility: { type: Boolean, default: false },
      wheelchair: { type: Boolean, default: false },
      speechImpaired: { type: Boolean, default: false },
      hearingImpaired: { type: Boolean, default: false },
      visionImpaired: { type: Boolean, default: false },
    },
    // Limited mobility / wheelchair → always top of the dispatcher queue
    priorityOne: { type: Boolean, default: false, index: true },

    // Triage
    priority: { type: Number, default: 0, index: true },
    priorityBreakdown: { type: Schema.Types.Mixed, default: {} },
    recommendedBrigade: { type: Schema.Types.ObjectId, ref: "Brigade", default: null },
    // { suggestion{etaSec,...}, alternatives[], noneAvailable, soonestFree }
    brigadeSuggestion: { type: Schema.Types.Mixed, default: null },

    // Integrity
    spamFlags: { type: [String], default: [] },
    spamScore: { type: Number, default: 0 },
    spamFlagged: { type: Boolean, default: false },
    citizenSafe: { type: Boolean, default: false },
    queuedOffline: { type: Boolean, default: false },
    clientCreatedAt: { type: Date, default: null },

    alert: { type: Schema.Types.ObjectId, ref: "Alert", default: null },
    // Primary (first) brigade — kept for older clients; `brigades` is the full team
    brigade: { type: Schema.Types.ObjectId, ref: "Brigade", default: null },
    brigades: { type: [{ type: Schema.Types.ObjectId, ref: "Brigade" }], default: [] },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

sosSignalSchema.index({ location: "2dsphere" });
sosSignalSchema.index({ createdAt: -1 });
sosSignalSchema.index({ zone: 1, createdAt: -1 });
sosSignalSchema.index({ status: 1, priority: -1 });
sosSignalSchema.index({ ip: 1, createdAt: -1 });
sosSignalSchema.index({ alert: 1, status: 1 });
sosSignalSchema.index({ deviceId: 1, createdAt: -1 });

const id = (v) => v?._id?.toString?.() ?? v?.toString?.() ?? null;

sosSignalSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    clientId: this.clientId,
    deviceId: this.deviceId,
    type: this.type,
    lat: this.location.coordinates[1],
    lng: this.location.coordinates[0],
    zone: id(this.zone),
    status: this.status,
    note: this.note,
    transcript: this.transcript,
    needs: this.needs,
    headcount: this.headcount,
    vulnerable: {
      elderly: this.vulnerable?.elderly ?? false,
      child: this.vulnerable?.child ?? false,
      disabled: this.vulnerable?.disabled ?? false,
    },
    injuries: this.injuries,
    accessibility: {
      limitedMobility: Boolean(this.accessibility?.limitedMobility),
      wheelchair: Boolean(this.accessibility?.wheelchair),
      speechImpaired: Boolean(this.accessibility?.speechImpaired),
      hearingImpaired: Boolean(this.accessibility?.hearingImpaired),
      visionImpaired: Boolean(this.accessibility?.visionImpaired),
    },
    priorityOne: Boolean(this.priorityOne),
    priority: this.priority,
    priorityBreakdown: this.priorityBreakdown,
    recommendedBrigade: id(this.recommendedBrigade),
    brigadeSuggestion: this.brigadeSuggestion ?? null,
    spamFlags: this.spamFlags,
    spamScore: this.spamScore,
    spamFlagged: this.spamFlagged,
    citizenSafe: this.citizenSafe,
    queuedOffline: this.queuedOffline,
    alert: id(this.alert),
    brigade: id(this.brigade),
    brigades: (this.brigades ?? []).map(id),
    createdAt: this.createdAt,
    clientCreatedAt: this.clientCreatedAt,
    resolvedAt: this.resolvedAt,
  };
};

/** Shape used by the pure clustering engine. */
sosSignalSchema.methods.toEngine = function () {
  return {
    id: this._id.toString(),
    deviceId: this.deviceId,
    zone: id(this.zone),
    lat: this.location.coordinates[1],
    lng: this.location.coordinates[0],
    type: this.type,
    createdAt: this.createdAt,
    status: this.status,
    citizenSafe: this.citizenSafe,
    spamFlagged: this.spamFlagged,
  };
};

export const SosSignal = Model("SosSignal", sosSignalSchema);
