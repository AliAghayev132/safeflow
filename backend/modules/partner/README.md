# SafeFlow Partner API (v1)

Secure crisis data exchange for partner agencies (army, police, ambulance,
municipality). Feature flag: `features.partnerApi`. OpenAPI 3.1:
`GET /api/partner/v1/openapi.json`.

## 1. Registration (admin)

Dispatcher dashboard → **Admin → Partner agencies** (permission `partners:manage`):

- create a client: name, type, scopes, per-client rate limit, optional mTLS
  (+ allowed certificate SHA-256 fingerprints);
- the `client_id` / `client_secret` pair is shown **once**;
- one click **Enable / Limit / Suspend**:
  - *limited* = read-only scopes and a throttled rate (`partner.limitedRateLimitPerMin`);
  - *suspended* = no tokens, live tokens are revoked;
- **Rotate secret** immediately invalidates the old secret and all issued tokens;
- webhooks: URL + events (only events covered by the client's scopes); the
  signing secret is shown once;
- every API call, token issue / denial and admin change is in the audit log.

## 2. Getting a token (OAuth2 client credentials)

```bash
curl -s -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d grant_type=client_credentials -d "scope=incidents:read roads:read" \
  https://<host>/api/partner/v1/oauth/token
# → { "access_token": "…", "token_type": "Bearer", "expires_in": 900, "scope": "incidents:read roads:read" }
```

Partner tokens are signed with their own key (`PARTNER_TOKEN_SECRET`) and
audience — staff tokens are not accepted here and vice versa.

| Scope | Endpoint |
|---|---|
| `incidents:read` | `GET /incidents` — active crisis clusters (aggregated), per-zone SOS load |
| `assembly_points:read` | `GET /assembly-points` — occupancy, fill ETA, accessibility |
| `roads:read` | `GET /roads` — closed / congested segments |
| `requests:write` | `POST /requests`, `GET /requests[/:id]` — resource / help requests |

Errors use the OAuth2 shape `{ "error": "...", "error_description": "..." }`
(`invalid_client`, `invalid_scope`, `invalid_token`, `insufficient_scope`,
`access_denied`, `rate_limited` …). A rate-limited call returns `429` with `Retry-After`.

## 3. Data minimisation

Responses are built by explicit allow-list serializers
(`core/serializers.js`). Partners never receive citizen names, phones, device
ids, notes, medical data or per-person coordinates. Incidents carry only an
aggregate `reports` count and a centroid rounded to ~100 m.

## 4. mTLS for critical agencies

When a client has `requireMtls`, both the token endpoint and every API call
require a client certificate whose SHA-256 fingerprint is on the client's
allow-list. Two deployments are supported:

**A. Node terminates TLS** — run the API behind `https.createServer({ key, cert, ca, requestCert: true, rejectUnauthorized: false })`.
The fingerprint is read from the verified peer certificate (`socket.authorized`).

**B. Reverse proxy terminates mTLS** (recommended) — e.g. nginx:

```nginx
ssl_client_certificate /etc/ssl/partners-ca.pem;
ssl_verify_client optional;
location /api/partner/ {
  proxy_set_header X-Client-Cert-Fingerprint $ssl_client_fingerprint;  # SHA-1 in nginx;
  # use a module / njs or envoy (x-forwarded-client-cert) to pass the SHA-256 hash
  proxy_pass http://safeflow-api;
}
```

The header name is `partner.mtls.proxyHeader`. It is **only trusted when the
TCP peer is listed in `partner.mtls.trustedProxies`** — otherwise it is ignored.
Strip the header from incoming client requests at the proxy.

## 5. Realtime

**Webhooks**: `POST` to your URL with the headers

```
X-SafeFlow-Event: incident.created | incident.updated | assembly_point.updated | road.updated | request.updated
X-SafeFlow-Delivery: whd_…        (unique — de-duplicate on it)
X-SafeFlow-Timestamp: 1763200000  (unix seconds)
X-SafeFlow-Signature: sha256=<hex HMAC-SHA256(secret, `${timestamp}.${rawBody}`)>
```

Verify (Node):

```js
import { createHmac, timingSafeEqual } from "node:crypto";
const expected = "sha256=" + createHmac("sha256", SECRET).update(`${ts}.${rawBody}`).digest("hex");
const ok = Math.abs(Date.now() / 1000 - ts) < 300 &&
  timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
```

Reply `2xx`. Anything else (or a timeout) is retried with exponential backoff
(`partner.webhooks.baseDelayMs × 2^(n-1)`, up to `maxAttempts`). Assembly-point
updates are coalesced per point (`coalesceMs`).

**WebSocket**: Socket.IO namespace `/partner`, `auth: { token: <access_token> }`.
Events arrive as `evt` `{ type, data, at }`. Each socket only joins the rooms of
its token scopes, and `request.updated` goes only to the requesting agency.
