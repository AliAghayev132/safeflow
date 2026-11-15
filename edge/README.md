# SafeFlow edge node — local network at an assembly point

When the internet is down, every assembly point keeps working as a small
**island**:
- a local server (the "edge node") runs at the assembly point;
- citizens join its open Wi-Fi **SafeFlow-SOS**;
- the phone's captive-portal window opens the SafeFlow app automatically.

On the local network citizens can:
- send an SOS and set "I am safe";
- see the occupancy of this and nearby assembly points;
- read the survival guides.

Local notifications (e.g. for volunteers) work without the center too.
Everything is stored on the node and is **synchronised with the central
server as soon as any link comes back**: internet, satellite or a radio
bridge — to the node it is all just "the center answers HTTP".

> Feature flag: `features.edgeNode` (admin → rules engine). Config section:
> `edge` (sync interval, batch size, backoff, timeouts, per-node rate limit).

## How it works

```
 phone ──Wi-Fi── [ edge node: hostapd + dnsmasq + nftables + SafeFlow backend (EDGE_MODE) + MongoDB ]
                                   │   store-and-forward outbox
                                   └── uplink (internet / satellite / radio) ──► central SafeFlow API
```

- **One code base.** The edge node is the regular backend started with
  `EDGE_MODE=true` and its own local MongoDB. The normal citizen endpoints
  (`/api/citizen/sos`, `/status`, `/shelters`, …) work against the local DB.
- **Captive portal.** `dnsmasq` answers every DNS name with the node's IP,
  so the OS connectivity probes (`/generate_204`, `/hotspot-detect.html`,
  `/connecttest.txt`, `/ncsi.txt`, `/redirect`, `/canonical.html`, …) reach
  the node. The node answers them with a redirect to the app, which makes
  the phone open its captive-portal window. DHCP option 114 (RFC 8910) also
  advertises the portal URL. **HTTPS cannot be intercepted** (no valid
  certificate for other sites), so we never try to rewrite HTTPS traffic —
  port 443 is simply rejected and the probe mechanism does the job.
- **Walled garden.** `nftables` lets Wi-Fi clients reach only DHCP, DNS and
  the SafeFlow server; nothing is forwarded to the uplink.
- **Serving the app.** The node serves the built citizen PWA
  (`EDGE_STATIC_DIR`) with an SPA fallback; `/api` stays JSON. The app
  detects the node (`GET /api/edge/v1/info`) and shows a "local network"
  banner with the sync state.

## Synchronisation and conflicts

Every citizen action on the node is mirrored into an **outbox**:

| Item | Key | Rule |
|---|---|---|
| SOS | `sos:<clientId>` | immutable; the center stores it via the idempotent SOS intake — the same `clientId` is **never stored twice** (lost ack, retry, resend) |
| SOS follow-up details | `details:<clientId>` | coalesced to the latest version; merged on the center (union / max) |
| Citizen status | `status:<deviceId>` | coalesced; **latest status wins** — the device timestamp is compared with the center's `statusAt`, an older status never overwrites a newer one (ties keep the current value) |

The sync cycle (every `edge.syncIntervalMs`) runs in four steps:

1. **Check the link.** `GET /api/edge/v1/ping` tells whether the center is reachable.
2. **Push.** `POST /api/edge/v1/sync` sends the due items, oldest first. At the same time an SOS goes before its details, and both go before a status — so "I am safe" never arrives before the SOS it cancels. Each item gets its own result:
   - `ok` → the item is marked synced;
   - `permanent` failure → the item is closed with the error kept (a visible dead letter);
   - retryable failure, or a failed transport → exponential backoff with jitter (`backoffBaseMs` … `backoffMaxMs`).
3. **Pull.** `GET /api/edge/v1/snapshot` returns shelters (occupancy, open/closed), nearby points, zones, closed and congested roads, feature flags and a config subset. The node applies it to its local DB. The center is authoritative for occupancy and roads, so local rerouting follows the center.
4. **Report.** The node reports how many items it still has queued; the dispatcher sees this per node.

## Center side

- **Resources → Edge nodes** in the dispatcher dashboard:
  - create a node — the token is shown **once**, and only its SHA-256 hash is stored;
  - rotate or revoke the token;
  - see each node's health (online / with errors / no contact / never connected / revoked), last sync, items queued on the node, received SOS and statuses, and the last error.
- Permissions: `edge:read` for dispatchers and `edge:manage` for admins (`config/rbac.json`).
- Node calls authenticate with `X-Edge-Token`. They are rate-limited per node (`edge.rateLimitPerMin`) and every sync batch is written to the audit log (actor `edge:<nodeId>`).

## Local admin on the node

The node has its own staff accounts (local database):
- `GET /api/edge/v1/local/status` (`edge:read`) returns the sync state and outbox counts.
- `POST /api/edge/v1/local/sync-now?force=1` (`edge:manage`) syncs now and ignores the backoff.

## Hook for other modules

`modules/edge/events.js`:

| Event | Payload | When |
|---|---|---|
| `edge.connectivity` | `{ online, error }` | the center became reachable or was lost |
| `edge.synced` | `{ pushed, applied }` | a sync cycle finished |
| `edge.notification` | `{ audience, type, data, nodeId, shelterCode }` | a local notification on the node |

Publish a local notification with `notifyLocal({ audience, type, data })`. For example, the volunteers module can deliver "doctor needed" to volunteers connected to this node without any internet.

## Setup (Debian / Ubuntu / Raspberry Pi OS)

1. Install the packages:
   ```bash
   sudo apt install hostapd dnsmasq nftables mongodb-org nodejs
   ```
2. Give the Wi-Fi interface a static address, e.g. `wlan0` → `10.88.0.1/22` (with systemd-networkd or NetworkManager).
3. Copy the configs:
   - `config/hostapd.conf` → `/etc/hostapd/hostapd.conf`
   - `config/dnsmasq.conf` → `/etc/dnsmasq.d/safeflow.conf`
   - `config/nftables.conf` → `/etc/nftables.conf`

   Adjust the interface names (`wlan0`, uplink `eth0`).
4. Deploy the app:
   ```bash
   cd /opt/safeflow/backend && npm ci --omit=dev
   cd /opt/safeflow/client-citizen && npm ci && VITE_API_URL=same-origin npm run build
   ```
5. On the center, create the node (dispatcher → Resources → Edge nodes) and copy the token.
6. Copy `config/edge.env.example` to `/etc/safeflow/edge.env` and fill in the node id, shelter code, `CENTRAL_URL`, `EDGE_TOKEN` and new local passwords.
7. Install and start the service:
   ```bash
   cp systemd/safeflow-edge.service /etc/systemd/system/
   sudo systemctl enable --now mongod hostapd dnsmasq nftables safeflow-edge
   ```

## Limitations

- **No internet through the node, by design.** Only SafeFlow is reachable on its Wi-Fi.
- **The captive-portal popup depends on the OS.** If it does not open, the citizen can type `http://safeflow.local` or scan a QR code at the point.
- **HTTPS sites cannot be redirected.** This is by design, see above.
- **The node does not get central SOS.** Each node runs its own rule engine on its local data (clusters, rerouting); the center sees everything after sync.
- **Occupancy between syncs.** Check-ins at the node update its local occupancy, but the next snapshot from the center overwrites it. The center stays the source of truth.
- **Map tiles are not cached.** They come from the internet, so offline the map shows no basemap. Routes, shelters and guides still work.
