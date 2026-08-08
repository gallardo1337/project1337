import assert from "node:assert/strict";
import test from "node:test";
import {
  createRequestSignature,
  isBlockedBrowserUrl,
  normalizeTargetUrl,
  verifyRequestSignature,
} from "../src/security.js";

test("erlaubt ausschließlich bekannte IAFD-Seiten", () => {
  assert.match(
    normalizeTargetUrl("https://iafd.com/title.rme/id=abc/year=2026"),
    /^https:\/\/www\.iafd\.com\/title\.rme/
  );
  assert.match(
    normalizeTargetUrl(
      "https://www.iafd.com/results.asp?searchtype=title&searchstring=test"
    ),
    /results\.asp/
  );
  assert.throws(() => normalizeTargetUrl("https://example.com/title.rme/id=abc"));
  assert.throws(() => normalizeTargetUrl("http://www.iafd.com/title.rme/id=abc"));
  assert.throws(() => normalizeTargetUrl("https://www.iafd.com/index.rme"));
});

test("prüft HMAC-Signatur und Ablaufzeit", () => {
  const secret = "a".repeat(64);
  const timestamp = "1786212000";
  const rawBody = '{"url":"https://www.iafd.com/title.rme/id=test"}';
  const signature = createRequestSignature(secret, timestamp, rawBody);
  assert.doesNotThrow(() =>
    verifyRequestSignature({
      secret,
      timestamp,
      signature,
      rawBody,
      nowMs: Number(timestamp) * 1000,
    })
  );
  assert.throws(() =>
    verifyRequestSignature({
      secret,
      timestamp,
      signature,
      rawBody: `${rawBody} `,
      nowMs: Number(timestamp) * 1000,
    })
  );
  assert.throws(() =>
    verifyRequestSignature({
      secret,
      timestamp,
      signature,
      rawBody,
      nowMs: Number(timestamp) * 1000 + 61000,
    })
  );
});

test("blockiert private Browserziele", () => {
  assert.equal(isBlockedBrowserUrl("http://127.0.0.1/admin"), true);
  assert.equal(isBlockedBrowserUrl("http://192.168.1.1/"), true);
  assert.equal(isBlockedBrowserUrl("http://nas.local/"), true);
  assert.equal(isBlockedBrowserUrl("https://www.iafd.com/favicon.ico"), false);
});
