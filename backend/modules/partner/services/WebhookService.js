import { crypto } from "#lib";
import { ConfigService } from "#services/ConfigService.js";
import { PartnerClient } from "../models/partnerClient.model.js";
import { WebhookDelivery } from "../models/webhookDelivery.model.js";
import { EVENT_SCOPES } from "../core/scopes.js";
import { signPayload, backoffDelay } from "../core/signing.js";

/**
 * Outbound webhooks.
 *
 *   POST <url>
 *   X-SafeFlow-Event:     incident.created | …
 *   X-SafeFlow-Delivery:  unique delivery id (receivers de-duplicate on it)
 *   X-SafeFlow-Timestamp: unix seconds
 *   X-SafeFlow-Signature: sha256=HMAC_SHA256(secret, `${timestamp}.${body}`)
 *
 * Non-2xx / timeout → retried with exponential backoff (partner.webhooks).
 * Every attempt is recorded in the WebhookDelivery log.
 */
class WebhookService {
  static #timers = new Set();

  /** Fan an event out to every subscribed, non-suspended client with the scope. */
  static async dispatch(event, data, { onlyClientId = null } = {}) {
    const scope = EVENT_SCOPES[event];
    const filter = {
      status: { $ne: "suspended" },
      scopes: scope,
      webhooks: { $elemMatch: { active: true, events: event } },
    };
    if (onlyClientId) filter._id = onlyClientId;
    const clients = await PartnerClient.find(filter).select("+webhooks.secret");

    for (const client of clients) {
      for (const hook of client.webhooks) {
        if (!hook.active || !hook.events.includes(event)) continue;
        const delivery = await WebhookDelivery.create({
          client: client._id,
          subscriptionId: hook._id.toString(),
          url: hook.url,
          event,
          deliveryId: `whd_${crypto.randomBytes(12).toString("base64url")}`,
        });
        const body = JSON.stringify({
          id: delivery.deliveryId,
          event,
          createdAt: new Date().toISOString(),
          data,
        });
        WebhookService.#attempt(delivery._id, hook.url, hook.secret, event, body);
      }
    }
  }

  static async #attempt(deliveryDbId, url, secret, event, body) {
    const cfg = ConfigService.get("partner")?.webhooks ?? {};
    const delivery = await WebhookDelivery.findById(deliveryDbId);
    if (!delivery || delivery.status !== "pending") return;

    const timestamp = Math.floor(Date.now() / 1000);
    let statusCode = null;
    let error = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "SafeFlow-Webhooks/1",
          "X-SafeFlow-Event": event,
          "X-SafeFlow-Delivery": delivery.deliveryId,
          "X-SafeFlow-Timestamp": String(timestamp),
          "X-SafeFlow-Signature": signPayload(secret, timestamp, body),
        },
        body,
        signal: AbortSignal.timeout(cfg.timeoutMs ?? 5000),
        redirect: "manual",
      });
      statusCode = res.status;
      await res.arrayBuffer().catch(() => null);
    } catch (e) {
      error = e.name === "TimeoutError" ? "timeout" : e.message;
    }

    delivery.attempts += 1;
    delivery.lastStatusCode = statusCode;
    delivery.lastError = error;

    if (statusCode && statusCode >= 200 && statusCode < 300) {
      delivery.status = "delivered";
      delivery.deliveredAt = new Date();
      delivery.nextAttemptAt = null;
      await delivery.save();
      return;
    }

    const wait = backoffDelay(delivery.attempts, {
      baseDelayMs: cfg.baseDelayMs ?? 2000,
      maxAttempts: cfg.maxAttempts ?? 6,
    });
    if (wait === null) {
      delivery.status = "failed";
      delivery.nextAttemptAt = null;
      await delivery.save();
      return;
    }
    delivery.nextAttemptAt = new Date(Date.now() + wait);
    await delivery.save();
    const timer = setTimeout(() => {
      WebhookService.#timers.delete(timer);
      WebhookService.#attempt(deliveryDbId, url, secret, event, body).catch((e) =>
        console.error("❌ [Partner webhook] retry failed:", e.message),
      );
    }, wait);
    timer.unref?.();
    WebhookService.#timers.add(timer);
  }

  static async deliveries(clientId, limit = 50) {
    const rows = await WebhookDelivery.find({ client: clientId })
      .sort({ createdAt: -1 })
      .limit(Math.min(200, Number(limit) || 50));
    return rows.map((d) => d.toAdmin());
  }

  static stop() {
    for (const t of WebhookService.#timers) clearTimeout(t);
    WebhookService.#timers.clear();
  }
}

export { WebhookService };
