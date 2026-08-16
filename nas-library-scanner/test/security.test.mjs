import assert from "node:assert/strict";
import test from "node:test";
import {
  createRequestSignature,
  verifyRequestSignature,
} from "../src/security.mjs";

test("akzeptiert nur frische HMAC-signierte Inventaranfragen", () => {
  const secret = "a".repeat(64);
  const timestamp = "1786300000";
  const rawBody = '{"refresh":true}';
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
      rawBody: '{"refresh":false}',
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
