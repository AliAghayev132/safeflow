import { crypto } from "#lib";
import { Schema, Model } from "#constants";
import { AppError } from "#utils";

/**
 * AI provider secrets entered by an admin in the dispatcher (alternative to
 * .env). Stored AES-256-GCM encrypted; the plaintext lives only in server
 * memory and is NEVER returned to a client (only the last 4 characters).
 * A value saved here overrides the same variable from .env.
 */
export const SECRET_NAMES = {
  GEMINI_API_KEY: { kind: "key" },
  ANTHROPIC_API_KEY: { kind: "key" },
  OPENAI_API_KEY: { kind: "key" },
  AI_LOCAL_URL: { kind: "url" },
  STT_BASE_URL: { kind: "url" },
  VISION_YOLO_URL: { kind: "url" },
};

const aiSecretSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    data: { type: String, required: true },
    last4: { type: String, default: "" },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);
const AiSecret = Model("AiSecret", aiSecretSchema);

// Encryption key: AI_SECRETS_KEY, else derived from the access-token secret
const masterKey = () =>
  crypto
    .createHash("sha256")
    .update(process.env.AI_SECRETS_KEY || process.env.ACCESS_SECRET_KEY || "crisis_engine_dev_access_secret_key")
    .digest();

const encrypt = (plain) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
};

const decrypt = ({ iv, tag, data }) => {
  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
};

class SecretStore {
  static #values = new Map(); // name → plaintext (memory only)
  static #meta = new Map(); // name → { last4, updatedAt, updatedBy }
  static #listeners = new Set();

  static async load() {
    const rows = await AiSecret.find().lean();
    SecretStore.#values.clear();
    SecretStore.#meta.clear();
    for (const r of rows) {
      try {
        SecretStore.#values.set(r.name, decrypt(r));
        SecretStore.#meta.set(r.name, { last4: r.last4, updatedAt: r.updatedAt, updatedBy: r.updatedBy });
      } catch {
        console.error(`⚠️  [AI] secret ${r.name} cannot be decrypted (key changed?) — ignored`);
      }
    }
  }

  /** Stored value, else the environment variable. */
  static get(name) {
    return (SecretStore.#values.get(name) ?? process.env[name] ?? "").trim();
  }

  static onChange(fn) {
    SecretStore.#listeners.add(fn);
  }

  static list() {
    return Object.entries(SECRET_NAMES).map(([name, { kind }]) => {
      const meta = SecretStore.#meta.get(name);
      const env = Boolean((process.env[name] ?? "").trim());
      return {
        name,
        kind,
        source: meta ? "dashboard" : env ? "env" : null,
        // URLs are not secret; keys are only ever shown as …last4
        preview: meta ? (kind === "url" ? SecretStore.#values.get(name) : `…${meta.last4}`) : env ? (kind === "url" ? process.env[name] : "…env") : null,
        updatedAt: meta?.updatedAt ?? null,
        updatedBy: meta?.updatedBy ?? null,
      };
    });
  }

  static async set(name, value, operator) {
    const def = SECRET_NAMES[name];
    if (!def) throw AppError.badRequest("Naməlum açar", "SECRET_NAME");
    const v = String(value ?? "").trim();
    if (!v || v.length > 500) throw AppError.badRequest("Dəyər boşdur və ya çox uzundur", "SECRET_VALUE");
    if (def.kind === "url" && !/^https?:\/\/[^\s]+$/i.test(v)) throw AppError.badRequest("URL http(s):// ilə başlamalıdır", "SECRET_URL");
    const enc = encrypt(v);
    const last4 = def.kind === "key" ? v.slice(-4) : "";
    await AiSecret.findOneAndUpdate(
      { name },
      { $set: { ...enc, last4, updatedBy: operator?.username ?? null } },
      { upsert: true, new: true },
    );
    SecretStore.#values.set(name, v);
    SecretStore.#meta.set(name, { last4, updatedAt: new Date(), updatedBy: operator?.username ?? null });
    SecretStore.#listeners.forEach((fn) => fn(name));
  }

  static async remove(name) {
    if (!SECRET_NAMES[name]) throw AppError.badRequest("Naməlum açar", "SECRET_NAME");
    await AiSecret.deleteOne({ name });
    SecretStore.#values.delete(name);
    SecretStore.#meta.delete(name);
    SecretStore.#listeners.forEach((fn) => fn(name));
  }
}

export { SecretStore };
