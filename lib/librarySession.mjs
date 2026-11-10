import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function issueLibrarySession(secret, now = Date.now()) {
  if (!secret) throw new Error("Library session secret is not configured");
  const payload = `${randomUUID()}.${Math.floor(now / 1000) + SESSION_LIFETIME_SECONDS}`;
  const signature = createHmac("sha256", secret)
    .update(`library-session:v1:${payload}`).digest("hex");
  return `${payload}.${signature}`;
}

export function verifyLibrarySession(token, secret, now = Date.now()) {
  if (!secret || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [id, expiry, signature] = parts;
  if (!UUID_PATTERN.test(id) || !/^\d{10}$/.test(expiry) ||
      Number(expiry) <= now / 1000 || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret)
    .update(`library-session:v1:${id}.${expiry}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
