import { Schema, Model } from "#constants";
import { PROFESSIONS, REQUEST_STATUS, REQUEST_KINDS, URGENCY } from "../constants.js";

/**
 * A call for professional volunteers at an assembly point (or around a
 * medical SOS). Acceptances are appended atomically; when `accepted.length`
 * reaches `count` the request is filled and closed for everyone else.
 */
const requestSchema = new Schema(
  {
    kind: { type: String, enum: REQUEST_KINDS, default: "shelter" },
    shelter: { type: Schema.Types.ObjectId, ref: "Shelter", required: true },
    sos: { type: Schema.Types.ObjectId, ref: "SosSignal", default: null },
    professions: { type: [{ type: String, enum: PROFESSIONS }], required: true },
    count: { type: Number, min: 1, max: 50, default: 1 },
    urgency: { type: String, enum: URGENCY, default: "normal" },
    note: { type: String, maxlength: 280, default: "" },
    status: { type: String, enum: REQUEST_STATUS, default: "open", index: true },
    createdBy: {
      id: { type: Schema.Types.ObjectId, ref: "Operator", default: null },
      username: { type: String, default: "system" },
      role: { type: String, default: "system" },
    },
    notified: [
      {
        _id: false,
        deviceId: { type: String, required: true },
        stage: { type: Number, default: 1 },
        at: { type: Date, default: Date.now },
      },
    ],
    accepted: [
      {
        _id: false,
        deviceId: { type: String, required: true },
        at: { type: Date, default: Date.now },
      },
    ],
    declined: { type: [String], default: [] },
    filledAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);

requestSchema.index({ "notified.deviceId": 1, status: 1 });
requestSchema.index({ "accepted.deviceId": 1 });

/** Staff view — counts only, never volunteer identities or locations. */
requestSchema.methods.toStaff = function () {
  return {
    id: this._id.toString(),
    kind: this.kind,
    shelter: this.shelter?._id?.toString?.() ?? this.shelter?.toString(),
    sos: this.sos?.toString() ?? null,
    professions: this.professions,
    count: this.count,
    urgency: this.urgency,
    note: this.note,
    status: this.status,
    createdBy: { username: this.createdBy?.username, role: this.createdBy?.role },
    notifiedCount: this.notified.length,
    notifiedByStage: this.notified.reduce((acc, n) => {
      acc[n.stage] = (acc[n.stage] ?? 0) + 1;
      return acc;
    }, {}),
    acceptedCount: this.accepted.length,
    declinedCount: this.declined.length,
    filledAt: this.filledAt,
    closedAt: this.closedAt,
    expiresAt: this.expiresAt,
    createdAt: this.createdAt,
  };
};

/** What a notified volunteer sees about a request. */
requestSchema.methods.toVolunteer = function (deviceId) {
  return {
    id: this._id.toString(),
    kind: this.kind,
    shelter: this.shelter?._id?.toString?.() ?? this.shelter?.toString(),
    professions: this.professions,
    count: this.count,
    urgency: this.urgency,
    note: this.note,
    status: this.status,
    remaining: Math.max(0, this.count - this.accepted.length),
    acceptedByMe: this.accepted.some((a) => a.deviceId === deviceId),
    declinedByMe: this.declined.includes(deviceId),
    expiresAt: this.expiresAt,
    createdAt: this.createdAt,
  };
};

export const VolunteerRequest = Model("VolunteerRequest", requestSchema);
