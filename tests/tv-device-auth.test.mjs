import assert from "node:assert/strict";
import test from "node:test";

import {
  formatUserCode,
  generateDeviceCredentials,
  hashDeviceCredential,
  isValidDeviceToken,
  isValidUserCode,
  normalizeUserCode,
} from "../lib/tvDeviceAuth.mjs";

test("generates separate high-entropy device token and readable user code", () => {
  const credentials = generateDeviceCredentials();

  assert.equal(isValidDeviceToken(credentials.deviceToken), true);
  assert.equal(isValidUserCode(credentials.userCode), true);
  assert.match(credentials.userCode, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(credentials.deviceToken.includes(credentials.userCode), false);
});

test("normalizes manually entered device codes", () => {
  assert.equal(normalizeUserCode(" abcd-2345 "), "ABCD2345");
  assert.equal(formatUserCode("abcd 2345"), "ABCD-2345");
});

test("hashes credentials deterministically without storing the original", () => {
  const hash = hashDeviceCredential("ABCD2345");

  assert.equal(hash.length, 64);
  assert.equal(hash, hashDeviceCredential("ABCD2345"));
  assert.notEqual(hash, "ABCD2345");
});
