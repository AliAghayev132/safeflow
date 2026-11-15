import { Schema, Model } from "#constants";

/**
 * Immutable operator audit log. Documents can only be inserted: every update /
 * delete path throws at the model level.
 */
const auditLogSchema = new Schema(
  {
    actor: {
      id: { type: Schema.Types.ObjectId, ref: "Operator", default: null },
      username: { type: String, default: "system" },
      role: { type: String, default: "system" },
    },
    action: { type: String, required: true, index: true },
    target: {
      type: { type: String, default: null },
      id: { type: String, default: null },
      label: { type: String, default: null },
    },
    details: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null },
    at: { type: Date, default: () => new Date(), index: true, immutable: true },
  },
  { versionKey: false, minimize: false },
);

auditLogSchema.index({ "actor.id": 1, at: -1 });

const immutable = function () {
  throw new Error("Audit log is append-only");
};
for (const op of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findOneAndReplace",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
]) {
  auditLogSchema.pre(op, immutable);
}
auditLogSchema.pre("save", function () {
  if (!this.isNew) throw new Error("Audit log is append-only");
});

auditLogSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    actor: {
      id: this.actor.id?.toString() ?? null,
      username: this.actor.username,
      role: this.actor.role,
    },
    action: this.action,
    target: this.target,
    details: this.details,
    ip: this.ip,
    at: this.at.toISOString(),
  };
};

export const AuditLog = Model("AuditLog", auditLogSchema);
