import { Schema, Model } from "#constants";

/**
 * Personal SOS shortcut token (one per device). Used by home-screen / Siri /
 * Google Assistant shortcuts that call the API without opening the app.
 * Only a SHA-256 hash of the token is stored; the token is shown once.
 */
const shortcutTokenSchema = new Schema(
  {
    deviceId: { type: String, required: true, unique: true },
    tokenHash: { type: String, required: true, unique: true },
    // First characters of the token, to recognise it in the UI ("sfs_ab12…")
    prefix: { type: String, required: true },
    lastUsedAt: { type: Date, default: null },
    useCount: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

shortcutTokenSchema.methods.toPublic = function () {
  return {
    active: true,
    prefix: this.prefix,
    createdAt: this.createdAt,
    lastUsedAt: this.lastUsedAt,
    useCount: this.useCount,
  };
};

export const ShortcutToken = Model("ShortcutToken", shortcutTokenSchema);
