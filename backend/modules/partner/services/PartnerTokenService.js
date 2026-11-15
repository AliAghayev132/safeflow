import { jwt, crypto } from "#lib";
import { config } from "#config";
import { ConfigService } from "#services/ConfigService.js";

export const PARTNER_AUDIENCE = "safeflow-partner-api";
const ISSUER = "safeflow";

/**
 * Partner tokens use their OWN signing key and audience, so a staff token can
 * never be replayed against the Partner API (and vice versa).
 * PARTNER_TOKEN_SECRET should be set in production; the fallback is derived
 * from the staff secret with HMAC so the two keys always differ.
 */
const signingKey = () =>
  process.env.PARTNER_TOKEN_SECRET ||
  crypto.createHmac("sha256", config.accessSecretKey).update("partner-api/v1").digest("hex");

class PartnerTokenService {
  static sign(client, scopes) {
    const ttl = ConfigService.get("partner")?.tokenTtlSec ?? 900;
    const token = jwt.sign(
      { cid: client._id.toString(), scp: scopes, ver: client.tokenVersion },
      signingKey(),
      { subject: client.clientId, audience: PARTNER_AUDIENCE, issuer: ISSUER, expiresIn: ttl },
    );
    return { token, expiresIn: ttl };
  }

  /** Throws on invalid / expired / wrong-audience tokens. */
  static verify(token) {
    return jwt.verify(token, signingKey(), { audience: PARTNER_AUDIENCE, issuer: ISSUER });
  }
}

export { PartnerTokenService };
