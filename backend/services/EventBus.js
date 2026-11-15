import { EventEmitter } from "#lib";

/**
 * EventBus (singleton)
 *
 * The backbone of the engine. Services publish domain events
 * (see constants/shared/events.js); rules, the realtime bridge and any future
 * module subscribe. Handlers are isolated: one failing handler never breaks
 * the publisher or other subscribers.
 */
class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /** Publish a domain event (fire-and-forget for the caller). */
  publish(event, payload = {}) {
    const envelope = { ...payload, _event: event, _at: new Date() };
    this.emit(event, envelope);
    this.emit("*", envelope);
  }

  /** Subscribe with error isolation. Returns an unsubscribe function. */
  subscribe(event, handler) {
    const wrapped = async (payload) => {
      try {
        await handler(payload);
      } catch (error) {
        console.error(`❌ [EventBus] handler for "${event}" failed:`, error);
      }
    };
    this.on(event, wrapped);
    return () => this.off(event, wrapped);
  }
}

const eventBus = new EventBus();

export { EventBus, eventBus };
