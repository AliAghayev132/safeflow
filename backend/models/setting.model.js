import { Schema, Model } from "#constants";

/**
 * Runtime configuration overrides (key → JSON value). The "crisis" key holds
 * a deep-partial of config/defaults/crisis.json edited from the admin panel.
 */
const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, default: {} },
    version: { type: Number, default: 1 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "Operator", default: null },
  },
  { timestamps: true, versionKey: false, minimize: false },
);

export const Setting = Model("Setting", settingSchema);
