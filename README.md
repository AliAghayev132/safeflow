# SafeFlow — Urban Crisis & Crowd Evacuation Engine

SafeFlow is used during earthquakes, floods, industrial accidents and mass events. It does two things:
- **Citizens** send an SOS with one tap. They also see the right assembly point, how full it is, and an evacuation route.
- **The crisis center** gets the SOS stream as a priority queue in real time. Critical situations raise automatic red alerts, and the operator decides with one click.

```
Core Project/
├── backend/             # Express 5 + MongoDB + Socket.IO (shared server)
├── client-citizen/      # Module 1 — citizen PWA (mobile-first, offline, az/en/ru) :5173
└── client-dispatcher/   # Module 2 — crisis center dashboard (RBAC, az/en/ru)    :5174
```

Conventions follow the `AliAghayev132/template` template:
- the server uses `#` subpath aliases;
- the clients use `@` aliases (defined in both `vite.config.js` and `jsconfig.json`);
- every folder has an `index.js` barrel;
- all external packages are imported through `lib/`.

## Running it

Requirements: Node 20+ and a MongoDB instance at `mongodb://localhost:27017`.

```bash
cd backend && npm install && npm run dev
```

```bash
cd client-citizen && npm install && npm run dev
```

```bash
cd client-dispatcher && npm install && npm run dev
```

On first start the backend creates the simulated city and three test accounts. The accounts are for dev/test only; set new passwords through the `.env` file before any real use.

| Role | Login | Password |
|---|---|---|
| admin | `admin` | `Admin123!` |
| dispatcher | `dispatcher` | `Dispatcher123!` |
| brigade_lead | `brigade1` | `Brigade123!` |

The citizen app needs no account. It identifies itself with an anonymous device UUID.

## Architecture

```
REST / Socket.IO ─► Controllers ─► Services ─► EventBus ─┬─► RuleEngine ─► rules/*.rule.js
                                    │ (pure logic)        ├─► RealtimeService ─► EventLog (seq) ─► rooms / polling
                                    └─ engine/*.js         └─► (new modules subscribe here)
```

- **`engine/` — pure decision logic.** No I/O and unit-tested. It covers:
  - sliding-window clustering (distinct devices; zone and haversine radius checked separately);
  - cooldown / de-duplication;
  - 90% / 95% shelter levels;
  - triage priority;
  - weighted shelter score;
  - fill-time prediction;
  - spam heuristics;
  - RBAC resolution.
- **Configurable rules engine.** Defaults live in `backend/config/defaults/crisis.json` and are overridden from MongoDB. They can be changed at runtime from the admin panel (`PATCH /api/admin/config`) without a restart. This includes:
  - 4 SOS / 5 min / 500 m / cooldown;
  - 90% / 95% shelter thresholds;
  - triage and routing weights;
  - rate limits.
- **RBAC.** `backend/config/rbac.json` defines roles, inheritance and the permission for each realtime channel.
  - A new role is one entry in that file.
  - Routes are gated only by *permission*, never by role name. This is enforced on both REST and WebSocket.
  - The dispatcher menu and pages are built automatically from the user's permissions.
- **SOS integrity.** Every SOS carries a `clientId` (idempotency key), so a network retry never creates a second ticket.
  - Repeated taps from the same device are merged.
  - Spam is flagged, not blocked; flagged SOS don't count toward clusters.
  - "I am safe" takes that citizen's SOS out of the cluster count.
- **Routing fallback.** The chain is: external OSRM API (short timeout + circuit breaker) → simulated road graph (Dijkstra) → straight line (direction + distance).
  - Every response says which provider answered.
  - A straight-line result is flagged `approximate: true`, and the citizen sees an "approximate route" notice.
- **Realtime.** Every event is `{seq, type, data, epoch}`.
  - After a reconnect, the client receives missed events via `sync`.
  - If the WebSocket is unavailable, the client polls `GET /api/events?after=seq`.
- **Rate limiting.** Limits are separate per IP, per device and per user, and differ by endpoint group. A blocked request gets `429` with `Retry-After`.
- **Audit.** Every operator action is written to an append-only `AuditLog` with operator id, action, target and ISO timestamp.
- **Simulator.** "Yasamalda zəlzələ" and "Səbaildə sel" stream realistic SOS over time. They also drive shelter inflow, road closures and a spam burst.

The road network is a **synthetic grid** over real Baku coordinates, not the real street map. To use a real routing service, set `ROUTING_EXTERNAL_URL` (OSRM-compatible).

## Tests

```bash
cd backend
npm run test:unit          # 35 — algorithm edge cases (4/3 signals, same device ×4, 499/501 m, 4:59/5:01, 89/90%, 94/95%, cooldown…)
npm run test:integration   # 29 — API + WebSocket + MongoDB: RBAC (REST/WS), idempotency, clustering, triage, fallback, 429, replay
npm run test:load          # Artillery — normal + peak
npm run test:stress        # Artillery — ramp to failure
npm run test:realtime      # 1000+ sockets, fan-out and alert creation time
npm run test:integrity     # genuine SOS under a spam flood — none may be lost
npm run test:report        # → tests/load/reports/REPORT.md
```

The latest results are in [backend/tests/load/reports/REPORT.md](backend/tests/load/reports/REPORT.md). They were measured on a single developer machine (API, MongoDB and the load generator on the same host), so the absolute numbers depend on that hardware.

## Design

- Solid colours only, no gradients.
- Statuses are never shown by colour alone: each one has an icon, text and colour.
- 3D icons come from Microsoft Fluent Emoji 3D (MIT licence).
- The UI is available in az (default), en and ru; the chosen language is remembered.
