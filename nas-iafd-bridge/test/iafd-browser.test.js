import assert from "node:assert/strict";
import test from "node:test";
import {
  challengeDetected,
  responseIsChallenge,
} from "../src/iafd-browser.js";

test("erkennt bekannte Cloudflare-Prüfseiten", () => {
  assert.equal(challengeDetected("Just a moment...", ""), true);
  assert.equal(
    challengeDetected("IAFD", "Performing security verification"),
    true
  );
  assert.equal(challengeDetected("Movie title", "Studio and cast"), false);
});

test("erkennt den offiziellen cf-mitigated Header", () => {
  assert.equal(
    responseIsChallenge({ headers: () => ({ "cf-mitigated": "challenge" }) }),
    true
  );
  assert.equal(responseIsChallenge({ headers: () => ({}) }), false);
  assert.equal(responseIsChallenge(null), false);
});
