# Accessibility — citizen app

Target: **WCAG 2.1 AA**, and SOS that works for people who **cannot speak, cannot hear, have limited mobility, or can only make one or two touches**.

The backend module is `backend/modules/accessibility`. It is gated by the feature flag `features.accessibility` (on by default).

## 1. SOS without speaking or with 1–2 touches

| Capability | Where | Notes |
|---|---|---|
| **One-tap SOS from the home screen** | `public/manifest.webmanifest` → `shortcuts` → `/quick-sos` | Android: long-press the installed app icon and choose "SOS göndər". `/quick-sos` sends a general SOS **immediately on open** with the last known location (chosen point → district → quick GPS → city centre, flagged). A second open within 15 s is not sent again. The route is deliberately **not** behind the feature flag: an SOS must never be blocked by a toggle. |
| **Siri ("Hey Siri, SOS göndər")** | Profile → "Siri / Assistant ilə SOS" (`/shortcuts`) | Generates a personal token. The page shows the exact `POST /api/a11y/v1/sos` URL, the headers (`Authorization: Bearer …`, `Idempotency-Key`) and the JSON body, with step-by-step "Get Contents of URL" instructions. **A pre-signed `.shortcut` file cannot be generated server-side** (Apple signs shortcuts on the device), and the UI says so. |
| **Android / Google Assistant** | same page | The home-screen shortcut, opened by name ("Hey Google, open Təhlükəsizlik"). Automation apps (Tasker, HTTP Shortcuts) can bind the same request to a voice command. A web app **cannot register its own Assistant command**, and the UI says so. |
| **Token security** | backend | Only a SHA-256 hash is stored, and the token is shown once. Create / rotate / revoke are audited; the audit log stores only a truncated device id. Retries with the same `Idempotency-Key` never create a second SOS. A rate limit applies per token (`accessibility.shortcutRateLimit`, editable at runtime). |
| **Audible SOS signal** | SOS screen → "Danışa bilmirəm — səs siqnalı" | WebAudio square wave at ~2.6 kHz (a whistle-like tone that carries through rubble), in the Morse `··· ––– ···` rhythm, repeating until stopped. The screen is kept awake (Wake Lock) where available. |
| **Visual SOS signal** | same | Full-screen white/red flash in the same rhythm. The unit is 200 ms, so the fastest cycle is 2.5 Hz, **below the 3 flashes/s threshold (WCAG 2.3.1)**. A photosensitivity warning is shown next to the toggle. Flashing is off by default when the OS asks for reduced motion. The full-screen layer is an `alertdialog`: its large Stop button gets focus on open, and Escape also stops the signal. |
| **Torch** | same | The torch is switched with a MediaStream `torch` constraint, after feature detection. When it is unsupported (e.g. iPhone Safari) or permission is denied, the UI says so and the sound and screen signals continue. |
| **Vibration confirmation** | `modules/accessibility/vibration.js` | Each outcome has its own pattern: sent = short·short·long; queued = long·long; failed = one very long. |
| **Special-needs profile** | Profile → "Xüsusi ehtiyaclar" | The options are: can't speak, can't hear, limited mobility, wheelchair, visual impairment. They are sent as `accessibility` with `PUT /api/citizen/profile`. The server attaches them to every SOS and raises its priority; limited mobility or wheelchair gives Priority #1 and a barrier-free route (implemented in the core backend). |

## 2. WCAG 2.1 AA checklist

| Criterion | What was done | Verified |
|---|---|---|
| 1.1.1 Non-text content | Decorative 3D icons use `alt=""` and `aria-hidden`. Icon-only buttons have an `aria-label` (contrast toggle, close, copy, delete contact). | eslint-plugin-jsx-a11y (recommended) |
| 1.3.1 Info & relationships | Every form field has a `<label htmlFor>`. Special needs use a `<fieldset>`/`<legend>`. Steps use `<ol>`. Language and filters use radio/tab roles. | lint + code review |
| 1.4.1 Use of colour | Every status has an icon, text and colour (`StatusBadge`). | code review |
| 1.4.3 Contrast (minimum) | All text/background token pairs are ≥ 4.5:1. Measured: ink/surface 17.9, muted/surface 6.0, muted/canvas 5.4, white/brand 13.2, white/sos 5.9, white/safe 5.6, white/warn 5.0, sos/sos-soft 5.0, safe/safe-soft 4.9, warn/warn-soft 4.5, info/info-soft 5.8. `--color-safe` was darkened from `#157f3b` (4.44:1 on safe-soft, which failed) to `#137837`. | calculated (WCAG relative luminance) |
| 1.4.6-style high contrast (beyond AA) | A header toggle (persisted) plus `prefers-contrast: more` switch the tokens to a high-contrast set: black text, black borders, darker brand / SOS / safe colours. Solid colours only, no gradients. | manual toggle in the browser |
| 1.4.4 / 1.4.10 Resize, reflow | The mobile-first layout works at 375 px with no horizontal scrolling. Text is in rem. | earlier 375 px browser check |
| 2.1.1 Keyboard | Every control is a native `button`/`a`/`input`. There are no click handlers on non-interactive elements (lint rules `click-events-have-key-events`, `no-static-element-interactions`). The signal overlay stops on Escape. | lint |
| 2.3.1 Three flashes | Signal flash ≤ 2.5 Hz. | timing in `morse.js` |
| 2.4.1 Bypass blocks | "Əsas məzmuna keç" skip link; `<main id="main" tabIndex=-1>`. | code review |
| 2.4.7 Focus visible | A global solid 3 px focus ring on every focusable element (4 px in high contrast). | CSS |
| 2.5.5-style target size | Interactive targets are at least 48 × 48 px: buttons sm/md are now `h-12`, the language switcher 48 px, header and dialog buttons 48 px, follow-up chips and steppers 48 px, the SOS controls 64–80 px. | code review (grep for `h-8`/`h-9`/`h-11` on interactive elements) |
| 4.1.3 Status messages | SOS outcome → `role=status aria-live=assertive`. Ticket status (pending → assigned → resolved) → polite live region. The ticking timer is `aria-hidden`, so it is not announced every second. Offline banner, copy confirmation and signal state are also live regions. | code review |
| 2.3.3 / motion | `prefers-reduced-motion: reduce` disables animations and transitions; the flash defaults to off. | CSS |

## 3. Still requires manual testing on devices

These cannot be verified by lint, unit tests or desktop emulation:

- **VoiceOver (iOS)** and **TalkBack (Android)**: reading order on the SOS screen; announcements when an SOS is sent, queued or failed and when the ticket status changes; the signal overlay as a modal dialog.
- **Siri Shortcut**: build it end to end on a real iPhone ("Get Contents of URL" with headers and JSON body), run "Hey Siri, SOS göndər", and confirm that a retry with the same Idempotency-Key does not create a duplicate.
- **Android home-screen shortcut**: the installed PWA shows "SOS göndər" on long-press; Google Assistant opens it by name.
- **Torch**: Chrome on Android with a rear torch (works); iPhone Safari (not supported, the message should appear).
- **Loudness and audibility**: tone level on real speakers through obstacles; behaviour with the phone in silent mode.
- **Vibration patterns**: on real hardware. The Vibration API is unsupported on iOS Safari; there the outcome is still shown and announced.
- **Zoom 200 %** and the OS large-text setting on phones.

## 4. Tests

- Backend unit (`tests/unit/a11y.test.js`): Idempotency-Key → deterministic clientId; a UUID key is used as-is; a missing key → random.
- Backend integration (`tests/integration/a11y.test.js`):
  - token is shown once and its status shows only a prefix;
  - token creation is audited without the full device id;
  - SOS with coordinates, with the last known location, and with the city-centre fallback;
  - idempotency;
  - a rotated or revoked token returns 401;
  - a malformed token returns 401;
  - the per-token rate limit returns 429 with Retry-After;
  - the flag off returns 404 FEATURE_DISABLED.
- Client: `npm run lint` (including jsx-a11y recommended) and `npm run build`.
