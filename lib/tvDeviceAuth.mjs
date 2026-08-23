import { createHash, randomBytes } from "node:crypto";

export const DEVICE_AUTH_TTL_SECONDS = 10 * 60;
export const DEVICE_AUTH_POLL_INTERVAL_SECONDS = 3;
export const DEVICE_AUTH_REPLAY_GRACE_SECONDS = 30;
export const DEVICE_AUTH_RATE_LIMIT_PER_MINUTE = 8;

const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const USER_CODE_LENGTH = 8;

export function normalizeUserCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, "")
    .slice(0, USER_CODE_LENGTH);
}

export function formatUserCode(value) {
  const normalized = normalizeUserCode(value);
  return normalized.length > 4
    ? `${normalized.slice(0, 4)}-${normalized.slice(4)}`
    : normalized;
}

export function isValidUserCode(value) {
  const normalized = normalizeUserCode(value);
  return (
    normalized.length === USER_CODE_LENGTH &&
    [...normalized].every((character) => USER_CODE_ALPHABET.includes(character))
  );
}

export function isValidDeviceToken(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function hashDeviceCredential(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function generateDeviceCredentials() {
  const bytes = randomBytes(USER_CODE_LENGTH);
  const rawUserCode = [...bytes]
    .map((byte) => USER_CODE_ALPHABET[byte & 31])
    .join("");

  return {
    deviceToken: randomBytes(32).toString("base64url"),
    userCode: formatUserCode(rawUserCode),
  };
}

export function getRequestIp(request) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  return forwarded.split(",")[0].trim().slice(0, 128) || "unknown";
}
