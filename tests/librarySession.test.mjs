import test from "node:test";
import assert from "node:assert/strict";
import { issueLibrarySession, verifyLibrarySession } from "../lib/librarySession.mjs";

const secret = "test-secret-for-session-verification";
const now = Date.UTC(2026, 10, 10);

test("new session is valid and expires after seven days", () => {
  const token = issueLibrarySession(secret, now);
  assert.equal(verifyLibrarySession(token, secret, now), true);
  assert.equal(verifyLibrarySession(token, secret, now + 7 * 86400000), false);
});

test("forged, edited and incorrectly signed sessions are rejected", () => {
  const token = issueLibrarySession(secret, now);
  assert.equal(verifyLibrarySession("ok", secret, now), false);
  assert.equal(verifyLibrarySession(token, "wrong-secret", now), false);
  const [id, expiry, signature] = token.split(".");
  assert.equal(verifyLibrarySession(`${id}.${Number(expiry) + 100}.${signature}`, secret, now), false);
  assert.equal(verifyLibrarySession(`${id}.${expiry}.${"0".repeat(64)}`, secret, now), false);
  assert.equal(verifyLibrarySession(token + ".extra", secret, now), false);
});
