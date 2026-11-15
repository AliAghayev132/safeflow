/**
 * Partner API config section (`partner`) — editable at runtime from the admin
 * config editor like every other operational setting.
 */
export const partnerDefaults = {
  // Access token lifetime (OAuth2 client_credentials)
  tokenTtlSec: 900,
  // Rate limit for new clients (per client, per minute)
  defaultRateLimitPerMin: 120,
  // Cap applied while a client is "limited" (read-only, throttled)
  limitedRateLimitPerMin: 20,
  // Token endpoint: requests per minute per IP
  tokenRequestsPerMinPerIp: 60,
  mtls: {
    // Header a TLS-terminating reverse proxy sets with the client cert
    // SHA-256 fingerprint. Only trusted from the proxies listed below.
    proxyHeader: "x-client-cert-fingerprint",
    trustedProxies: ["127.0.0.1", "::1", "::ffff:127.0.0.1"],
  },
  webhooks: {
    maxAttempts: 6,
    baseDelayMs: 2000,
    timeoutMs: 5000,
    // Coalesce assembly-point updates per shelter (latest wins)
    coalesceMs: 2000,
    // Production should require https; http allowed for local testing
    requireHttps: false,
  },
};
