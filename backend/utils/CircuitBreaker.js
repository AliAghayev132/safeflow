/**
 * Minimal circuit breaker for external calls.
 *
 *   closed    → calls pass; `failureThreshold` consecutive failures → open
 *   open      → calls fail fast until `resetTimeoutMs` elapses → half-open
 *   half-open → one trial call; success → closed, failure → open again
 */
class CircuitBreaker {
  constructor({ name, failureThreshold = 3, resetTimeoutMs = 30000, now = Date.now }) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.now = now;
    this.state = "closed";
    this.failures = 0;
    this.openedAt = 0;
  }

  configure({ failureThreshold, resetTimeoutMs }) {
    if (failureThreshold) this.failureThreshold = failureThreshold;
    if (resetTimeoutMs) this.resetTimeoutMs = resetTimeoutMs;
  }

  canRequest() {
    if (this.state === "open" && this.now() - this.openedAt >= this.resetTimeoutMs) {
      this.state = "half-open";
    }
    return this.state !== "open";
  }

  async exec(fn) {
    if (!this.canRequest()) {
      const error = new Error(`Circuit "${this.name}" is open`);
      error.code = "CIRCUIT_OPEN";
      throw error;
    }
    try {
      const result = await fn();
      this.failures = 0;
      this.state = "closed";
      return result;
    } catch (error) {
      this.failures += 1;
      if (this.state === "half-open" || this.failures >= this.failureThreshold) {
        this.state = "open";
        this.openedAt = this.now();
      }
      throw error;
    }
  }

  status() {
    this.canRequest();
    return { name: this.name, state: this.state, failures: this.failures };
  }
}

export { CircuitBreaker };
