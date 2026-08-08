import { createHmac, timingSafeEqual } from "node:crypto";
import { BridgeError } from "./errors.js";

const IAFD_HOSTS = new Set(["iafd.com", "www.iafd.com"]);
const IAFD_PATHS = [/^\/title\.rme(?:\/|$)/i, /^\/person\.rme(?:\/|$)/i, /^\/results\.asp$/i];

export function normalizeTargetUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    throw new BridgeError("Die Zieladresse ist ungültig.", "INVALID_TARGET", 400);
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    !IAFD_HOSTS.has(parsed.hostname.toLowerCase()) ||
    !IAFD_PATHS.some((pattern) => pattern.test(parsed.pathname))
  ) {
    throw new BridgeError(
      "Die Bridge erlaubt ausschließlich IAFD-Film-, Darsteller- und Suchseiten.",
      "INVALID_TARGET",
      400
    );
  }

  parsed.hostname = "www.iafd.com";
  parsed.hash = "";
  return parsed.toString();
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
    throw new BridgeError("Signierter Zeitstempel fehlt.", "AUTH_REQUIRED", 401);
  }

  const requestTimeMs = Number(timestamp) * 1000;
  if (Math.abs(nowMs - requestTimeMs) > maxAgeSeconds * 1000) {
    throw new BridgeError("Die signierte Anfrage ist abgelaufen.", "TIMESTAMP_EXPIRED", 401);
  }

  const expected = createRequestSignature(secret, timestamp, rawBody);
  const receivedBuffer = Buffer.from(String(signature || ""), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw new BridgeError("Signatur ungültig.", "BAD_SIGNATURE", 401);
  }
}

function isPrivateIpv4(hostname) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return false;
  const parts = hostname.split(".").map(Number);
  if (parts.some((part) => part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIpv6(hostname) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    host === "::" ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    /^fe[89ab]/.test(host) ||
    host.startsWith("::ffff:127.") ||
    host.startsWith("::ffff:10.") ||
    host.startsWith("::ffff:192.168.")
  );
}

export function isBlockedBrowserUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return true;
  }
  const hostname = parsed.hostname.toLowerCase();
  return (
    !new Set(["http:", "https:"]).has(parsed.protocol) ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    isPrivateIpv4(hostname) ||
    isPrivateIpv6(hostname)
  );
}

export function isIafdHostname(value) {
  try {
    return IAFD_HOSTS.has(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
}
