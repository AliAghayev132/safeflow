import { ConfigService } from "#services/ConfigService.js";
import { normalizeFingerprint } from "../core/signing.js";

/**
 * mTLS client-certificate check for critical partners. Two deployments:
 *
 *  1. Node terminates TLS (https.createServer({ requestCert: true, ca })):
 *     the verified peer certificate's SHA-256 fingerprint is read from the
 *     socket — only when the TLS layer authorised it.
 *  2. A reverse proxy (nginx / envoy) terminates mTLS and forwards the
 *     fingerprint in a header (partner.mtls.proxyHeader). The header is only
 *     trusted when the TCP peer is one of partner.mtls.trustedProxies —
 *     otherwise anyone could send it.
 */
class MtlsService {
  /** Fingerprint of the client certificate presented on this request, or null. */
  static presentedFingerprint(req) {
    const socket = req.socket;
    if (socket?.encrypted && typeof socket.getPeerCertificate === "function" && socket.authorized) {
      const cert = socket.getPeerCertificate();
      if (cert?.fingerprint256) return normalizeFingerprint(cert.fingerprint256);
    }

    const cfg = ConfigService.get("partner")?.mtls ?? {};
    const header = req.headers[String(cfg.proxyHeader ?? "").toLowerCase()];
    const peer = socket?.remoteAddress;
    if (header && (cfg.trustedProxies ?? []).includes(peer)) return normalizeFingerprint(header);
    return null;
  }

  /** true when the client does not need mTLS or presented an allowed cert. */
  static satisfies(client, req) {
    if (!client.requireMtls) return true;
    const fp = MtlsService.presentedFingerprint(req);
    if (!fp) return false;
    return (client.certFingerprints ?? []).map(normalizeFingerprint).includes(fp);
  }
}

export { MtlsService };
