import { bcrypt, crypto } from "#lib";
import { AppError } from "#utils";
import { ConfigService } from "#services/ConfigService.js";
import { PartnerClient } from "../models/partnerClient.model.js";
import { PARTNER_STATUS, PARTNER_TYPES, normalizeScopes, allowedEvents } from "../core/scopes.js";
import { normalizeFingerprint } from "../core/signing.js";

let dummyHash = null;
const newClientId = () => `pc_${crypto.randomBytes(9).toString("base64url")}`;
const newSecret = () => `pcs_${crypto.randomBytes(32).toString("base64url")}`;

const validateWebhookUrl = (url) => {
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    throw AppError.badRequest("Webhook URL yanlışdır", "WEBHOOK_URL_INVALID");
  }
  const { requireHttps } = ConfigService.get("partner")?.webhooks ?? {};
  if (!["https:", "http:"].includes(parsed.protocol) || (requireHttps && parsed.protocol !== "https:")) {
    throw AppError.badRequest("Webhook URL https olmalıdır", "WEBHOOK_URL_INSECURE");
  }
  return parsed.toString();
};

/**
 * Partner client registry: credentials (hashed), scopes, status, rate limit,
 * mTLS requirement and webhook subscriptions.
 */
class PartnerClientService {
  static async list() {
    const rows = await PartnerClient.find().sort({ createdAt: -1 });
    return rows.map((c) => c.toAdmin());
  }

  static async getById(id) {
    const client = await PartnerClient.findById(id);
    if (!client) throw AppError.notFound("Partnyor tapılmadı", "PARTNER_NOT_FOUND");
    return client;
  }

  /** Creates a client; the plain secret is returned ONCE. */
  static async create(body, operator) {
    const name = String(body?.name ?? "").trim();
    if (!name) throw AppError.badRequest("Ad tələb olunur", "PARTNER_NAME_REQUIRED");
    const scopes = normalizeScopes(body.scopes);
    if (!scopes.length) throw AppError.badRequest("Ən azı bir scope seçin", "PARTNER_SCOPES_REQUIRED");

    const clientSecret = newSecret();
    const client = await PartnerClient.create({
      name,
      type: PARTNER_TYPES.includes(body.type) ? body.type : "other",
      contact: String(body.contact ?? "").slice(0, 200),
      clientId: newClientId(),
      secretHash: await bcrypt.hash(clientSecret, 10),
      scopes,
      rateLimitPerMin:
        Number(body.rateLimitPerMin) > 0
          ? Math.round(Number(body.rateLimitPerMin))
          : ConfigService.get("partner")?.defaultRateLimitPerMin ?? 120,
      requireMtls: Boolean(body.requireMtls),
      certFingerprints: (body.certFingerprints ?? []).map(normalizeFingerprint).filter(Boolean),
      createdBy: operator?._id ?? null,
    });
    return { client, clientSecret };
  }

  /** Checks client credentials. Returns the client or null (constant-ish time). */
  static async authenticate(clientId, clientSecret) {
    const client = await PartnerClient.findOne({ clientId: String(clientId ?? "") }).select("+secretHash");
    // Compare against a dummy hash too, so unknown ids take the same time
    dummyHash ??= await bcrypt.hash("no-such-client", 10);
    const hash = client?.secretHash ?? dummyHash;
    const okSecret = await bcrypt.compare(String(clientSecret ?? ""), hash);
    return client && okSecret ? client : null;
  }

  static async update(id, body) {
    const client = await PartnerClientService.getById(id);
    if (typeof body.name === "string" && body.name.trim()) client.name = body.name.trim();
    if (PARTNER_TYPES.includes(body.type)) client.type = body.type;
    if (typeof body.contact === "string") client.contact = body.contact.slice(0, 200);
    if (Array.isArray(body.scopes)) {
      const scopes = normalizeScopes(body.scopes);
      if (!scopes.length) throw AppError.badRequest("Ən azı bir scope seçin", "PARTNER_SCOPES_REQUIRED");
      client.scopes = scopes;
      client.tokenVersion += 1; // scope reduction takes effect immediately
    }
    if (body.rateLimitPerMin !== undefined) {
      const n = Math.round(Number(body.rateLimitPerMin));
      if (!(n > 0)) throw AppError.badRequest("Limit müsbət olmalıdır", "PARTNER_RATE_INVALID");
      client.rateLimitPerMin = n;
    }
    if (typeof body.requireMtls === "boolean") client.requireMtls = body.requireMtls;
    if (Array.isArray(body.certFingerprints)) {
      client.certFingerprints = body.certFingerprints.map(normalizeFingerprint).filter(Boolean);
    }
    await client.save();
    return client;
  }

  /** One-click activate / limit / suspend. Suspending revokes live tokens. */
  static async setStatus(id, status) {
    if (!PARTNER_STATUS.includes(status)) throw AppError.badRequest("Status yanlışdır", "PARTNER_STATUS_INVALID");
    const client = await PartnerClientService.getById(id);
    const previous = client.status;
    client.status = status;
    if (status !== "active") client.tokenVersion += 1;
    await client.save();
    return { client, previous };
  }

  static async rotateSecret(id) {
    const client = await PartnerClientService.getById(id);
    const clientSecret = newSecret();
    client.secretHash = await bcrypt.hash(clientSecret, 10);
    client.secretRotatedAt = new Date();
    client.tokenVersion += 1;
    await client.save();
    return { client, clientSecret };
  }

  static async remove(id) {
    const client = await PartnerClientService.getById(id);
    await client.deleteOne();
    return client;
  }

  /** Adds a webhook subscription; the signing secret is returned ONCE. */
  static async addWebhook(id, { url, events }) {
    const client = await PartnerClientService.getById(id);
    const permitted = allowedEvents(client.scopes);
    const wanted = [...new Set(Array.isArray(events) && events.length ? events : permitted)];
    const invalid = wanted.filter((e) => !permitted.includes(e));
    if (invalid.length) {
      throw AppError.badRequest(`İcazə verilməyən hadisələr: ${invalid.join(", ")}`, "WEBHOOK_EVENTS_NOT_ALLOWED");
    }
    const secret = `whsec_${crypto.randomBytes(24).toString("base64url")}`;
    client.webhooks.push({ url: validateWebhookUrl(url), events: wanted, secret });
    await client.save();
    const hook = client.webhooks.at(-1);
    return { client, webhook: { id: hook._id.toString(), url: hook.url, events: hook.events, secret } };
  }

  static async removeWebhook(id, webhookId) {
    const client = await PartnerClientService.getById(id);
    const before = client.webhooks.length;
    client.webhooks = client.webhooks.filter((w) => w._id.toString() !== String(webhookId));
    if (client.webhooks.length === before) throw AppError.notFound("Webhook tapılmadı", "WEBHOOK_NOT_FOUND");
    await client.save();
    return client;
  }
}

export { PartnerClientService };
