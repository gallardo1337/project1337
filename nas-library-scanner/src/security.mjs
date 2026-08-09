import { createHmac, timingSafeEqual } from "node:crypto";

export class ScannerError extends Error {
  constructor(message, code = "SCANNER_ERROR", status = 500) {
    super(message);
    this.name = "ScannerError";
    this.code = code;
    this.status = status;
  }
}

export function createRequestSignature(secret, timestamp, rawBody) {
  return `sha256=${createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex")}`;
}

export function verifyRequestSignature({
  secret,
  timestamp,
  signature,
  rawBody,
  nowMs = Date.now(),
  maxAgeSeconds = 60,
}) {
  if (!/^\d{10}$/.test(String(timestamp || ""))) {
    throw new ScannerError("Signierter Zeitstempel fehlt.", "AUTH_REQUIRED", 401);
  }

  const requestTimeMs = Number(timestamp) * 1000;
  if (Math.abs(nowMs - requestTimeMs) > maxAgeSeconds * 1000) {
    throw new ScannerError(
      "Die signierte Anfrage ist abgelaufen.",
      "TIMESTAMP_EXPIRED",
      401
    );
  }

  const expected = Buffer.from(
    createRequestSignature(secret, timestamp, rawBody),
    "utf8"
  );
  const received = Buffer.from(String(signature || ""), "utf8");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new ScannerError("Signatur ungültig.", "BAD_SIGNATURE", 401);
  }
}

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
      throw new ScannerError(
        "Zu viele Anfragen. Bitte kurz warten.",
        "RATE_LIMITED",
        429
      );
    }
  }
}
