import {
  Schema,
  Model,
  alertTypes,
  alertStatus,
  alertActionTypes,
  alertSeverity,
} from "#constants";
import { pointSchema } from "./schemas/point.schema.js";

/**
 * Recommended action attached to an alert. The operator approves the whole
 * alert with one click; each action is then executed by AlertService.
 */
const alertActionSchema = new Schema(
  {
    type: { type: String, enum: alertActionTypes, required: true },
    label: { type: String, required: true },
    brigade: { type: Schema.Types.ObjectId, ref: "Brigade", default: null },
    // Preferred brigade type — used to re-pick if the suggested one got busy
    brigadeType: { type: String, default: null },
    shelter: { type: Schema.Types.ObjectId, ref: "Shelter", default: null },
    executed: { type: Boolean, default: false },
    result: { type: String, default: "" },
  },
  { _id: true },
);

/** Red alert raised by the crisis rule engine. */
const alertSchema = new Schema(
  {
    type: { type: String, enum: alertTypes, required: true },
    ruleId: { type: String, required: true },
    severity: { type: String, enum: alertSeverity, default: "critical" },
    status: { type: String, enum: alertStatus, default: "active" },
    // Azerbaijani fallback text + translation keys for the clients
    title: { type: String, required: true },
    message: { type: String, required: true },
    i18n: {
      titleKey: { type: String, default: null },
      messageKey: { type: String, default: null },
      params: { type: Schema.Types.Mixed, default: {} },
    },
    zone: { type: Schema.Types.ObjectId, ref: "Zone", default: null },
    shelter: { type: Schema.Types.ObjectId, ref: "Shelter", default: null },
    location: { type: pointSchema, required: true },
    // Signals that triggered the alert (bounded). The full membership is
    // SosSignal.alert → this alert (indexed), so the alert document never grows.
    sosSignals: [{ type: Schema.Types.ObjectId, ref: "SosSignal" }],
    signalCount: { type: Number, default: 0 },
    actions: { type: [alertActionSchema], default: [] },
    decidedBy: { type: Schema.Types.ObjectId, ref: "Operator", default: null },
    decidedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

alertSchema.index({ status: 1, createdAt: -1 });
alertSchema.index({ location: "2dsphere" });

alertSchema.methods.toPublic = function () {
  const id = (v) => v?._id?.toString?.() ?? v?.toString?.() ?? null;
  return {
    id: this._id.toString(),
    type: this.type,
    ruleId: this.ruleId,
    severity: this.severity,
    status: this.status,
    title: this.title,
    message: this.message,
    i18n: {
      titleKey: this.i18n?.titleKey ?? null,
      messageKey: this.i18n?.messageKey ?? null,
      params: this.i18n?.params ?? {},
    },
    zone: id(this.zone),
    shelter: id(this.shelter),
    lat: this.location.coordinates[1],
    lng: this.location.coordinates[0],
    sosSignals: this.sosSignals.map(id),
    signalCount: this.signalCount,
    actions: this.actions.map((a) => ({
      id: a._id.toString(),
      type: a.type,
      label: a.label,
      brigade: id(a.brigade),
      brigadeType: a.brigadeType,
      shelter: id(a.shelter),
      executed: a.executed,
      result: a.result,
    })),
    decidedBy: id(this.decidedBy),
    decidedAt: this.decidedAt,
    resolvedAt: this.resolvedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Alert = Model("Alert", alertSchema);
