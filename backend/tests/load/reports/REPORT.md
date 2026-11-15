# Load & stress test report

Generated 2026-11-15T08:37:09.658Z. Tooling: Artillery (HTTP), Node + socket.io-client (WebSocket, alert latency, SOS integrity).

> Measured on a single developer machine (API, MongoDB, the load generator and two Vite dev servers on the same host, Windows). Absolute numbers are hardware-bound; use them as a baseline and for regressions.

## Load — normal and peak traffic

| Metric | Value |
|---|---|
| Requests | 10340 |
| Mean request rate | 86 req/s |
| Latency p50 / p95 / p99 | 55 / 1653 / 2231 ms |
| Error rate | 0.00 % (0) |
| HTTP codes | 200: 6450, 201: 3890 |
| Transport errors | none |

| Endpoint | p50 | p95 | p99 |
|---|---|---|---|
| GET /citizen/shelters | 39 | 1496 | 1720 |
| GET /citizen/evacuation | 45 | 1686 | 1979 |
| POST /citizen/sos | 63 | 1979 | 2369 |
| PATCH /citizen/sos/:clientId | 53 | 944 | 1249 |

Timeline (10 s windows):

| # | req | req/s | p50 ms | p95 ms | p99 ms | errors | error % |
|---|---|---|---|---|---|---|---|
| 1 | 147 | 18 | 13 | 47 | 69 | 0 | 0.0 |
| 2 | 306 | 34 | 14 | 53 | 78 | 0 | 0.0 |
| 3 | 494 | 50 | 24 | 97 | 133 | 0 | 0.0 |
| 4 | 486 | 49 | 27 | 76 | 103 | 0 | 0.0 |
| 5 | 491 | 50 | 20 | 78 | 101 | 0 | 0.0 |
| 6 | 480 | 50 | 48 | 198 | 279 | 0 | 0.0 |
| 7 | 639 | 66 | 16 | 56 | 93 | 0 | 0.0 |
| 8 | 991 | 102 | 25 | 113 | 194 | 0 | 0.0 |
| 9 | 1349 | 135 | 169 | 518 | 646 | 0 | 0.0 |
| 10 | 1631 | 164 | 78 | 508 | 672 | 0 | 0.0 |
| 11 | 1572 | 157 | 59 | 646 | 1108 | 0 | 0.0 |
| 12 | 1497 | 150 | 1300 | 2144 | 2369 | 0 | 0.0 |
| 13 | 257 | 80 | 1108 | 2369 | 2566 | 0 | 0.0 |

## Stress — ramp to failure

| Metric | Value |
|---|---|
| Requests | 37050 |
| Mean request rate | 318 req/s |
| Latency p50 / p95 / p99 | 2101 / 4771 / 4965 ms |
| Error rate | 77.99 % (28894) |
| HTTP codes | 201: 8156 |
| Transport errors | ECONNREFUSED: 27903, ETIMEDOUT: 991 |

| Endpoint | p50 | p95 | p99 |
|---|---|---|---|
| /api/citizen/sos (POST /citizen/sos) | 2101 | 4771 | 4965 |

Timeline (10 s windows):

| # | req | req/s | p50 ms | p95 ms | p99 ms | errors | error % |
|---|---|---|---|---|---|---|---|
| 1 | 224 | 61 | 34 | 97 | 107 | 0 | 0.0 |
| 2 | 930 | 94 | 550 | 1620 | 1755 | 0 | 0.0 |
| 3 | 1430 | 145 | 2516 | 4493 | 4965 | 465 | 32.5 |
| 4 | 1945 | 196 | 4584 | 4867 | 4965 | 1348 | 69.3 |
| 5 | 2817 | 281 | 3534 | 4584 | 4965 | 1886 | 67.0 |
| 6 | 3844 | 387 | 4147 | 4867 | 4965 | 3291 | 85.6 |
| 7 | 4844 | 486 | 4676 | 4965 | 4965 | 4655 | 96.1 |
| 8 | 6304 | 633 | 1827 | 4231 | 4404 | 5689 | 90.2 |
| 9 | 8018 | 803 | 1790 | 2417 | 2671 | 6275 | 78.3 |
| 10 | 6453 | 672 | 1979 | 2322 | 2417 | 5285 | 81.9 |
| 11 | 200 | 20 | 11 | 21 | 29 | 0 | 0.0 |
| 12 | 41 | 29 | 11 | 22 | 23 | 0 | 0.0 |

**Breaking point:** window #3 at ~145 req/s offered — first window with error rate > 5% or p95 > 2000 ms.

## Realtime (WebSocket)

| Metric | Value |
|---|---|
| Concurrent sockets | 1020 (failed 0) |
| Connect p50 / p95 | 107.4 / 292.1 ms |
| SOS → dispatcher fan-out p50 / p95 / p99 | 8.6 / 16.6 / 39.8 ms (lost: 0) |
| **Alert creation time** (4th SOS response → `alert:new`) p50 / p95 | 17.5 / 28.8 ms (5 runs) |

## Stress integrity — genuine SOS under a spam flood

| Metric | Value |
|---|---|
| Genuine citizens (1 SOS each, retry on Retry-After) | 500 |
| Accepted / lost | 500 / 0 |
| Needed a retry | 149 |
| Missing in DB / duplicate tickets | 0 / 0 |
| Spam devices × requests | 20 × 60 |
| Spam accepted / 429 / transport errors | 380 / 734 / 86 |
| **Verdict** | PASS — no genuine SOS lost; spam stopped by the device limit |

