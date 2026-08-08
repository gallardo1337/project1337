import { BridgeError } from "./errors.js";

export class FixedWindowRateLimiter {
  constructor(limit, windowMs = 60000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.windowStartedAt = Date.now();
    this.count = 0;
  }

  consume(now = Date.now()) {
    if (now - this.windowStartedAt >= this.windowMs) {
      this.windowStartedAt = now;
      this.count = 0;
    }
    this.count += 1;
    if (this.count > this.limit) {
      throw new BridgeError(
        "Zu viele Anfragen. Bitte kurz warten.",
        "RATE_LIMITED",
        429
      );
    }
  }
}
