import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { clientIdFor } from "../../modules/accessibility/services/ShortcutService.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DEVICE = "11111111-1111-4111-8111-111111111111";

describe("shortcut SOS idempotency key → clientId", () => {
  test("same device + key → same valid UUID", () => {
    const a = clientIdFor(DEVICE, "siri-2026-11-15T10:00");
    const b = clientIdFor(DEVICE, "siri-2026-11-15T10:00");
    assert.equal(a, b);
    assert.match(a, UUID);
  });

  test("different device or key → different id", () => {
    const base = clientIdFor(DEVICE, "k1");
    assert.notEqual(base, clientIdFor(DEVICE, "k2"));
    assert.notEqual(base, clientIdFor("22222222-2222-4222-8222-222222222222", "k1"));
  });

  test("a UUID key is used as-is; no key → random UUID", () => {
    const key = "33333333-3333-4333-8333-333333333333";
    assert.equal(clientIdFor(DEVICE, key), key);
    const r1 = clientIdFor(DEVICE, null);
    assert.match(r1, UUID);
    assert.notEqual(r1, clientIdFor(DEVICE, null));
  });
});
