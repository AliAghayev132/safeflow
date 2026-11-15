import { bcrypt } from "#lib";
import { Schema, Model } from "#constants";
import { rbac } from "#config";

/**
 * Staff account (dispatcher / brigade lead / admin / any future role).
 * The role list comes from config/rbac.json — adding a role there is enough.
 */
const operatorSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, required: true, select: false, minlength: 8 },
    fullName: { type: String, required: true, trim: true },
    role: {
      type: String,
      required: true,
      validate: {
        validator: (v) => v !== "citizen" && Object.hasOwn(rbac.roles, v),
        message: (p) => `Unknown staff role "${p.value}"`,
      },
    },
    // Brigade lead → the brigade they command
    brigade: { type: Schema.Types.ObjectId, ref: "Brigade", default: null },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

// Hash the password whenever it changes (async hook — no `next` in Mongoose 9).
operatorSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

operatorSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

operatorSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    username: this.username,
    fullName: this.fullName,
    role: this.role,
    brigade: this.brigade?.toString() ?? null,
  };
};

export const Operator = Model("Operator", operatorSchema);
