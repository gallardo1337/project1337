import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { clearStaleChromiumProfileLocks } from "../src/chromium-profile.js";

test("entfernt nur verwaiste Chromium-Sperrdateien", () => {
  const profileDir = mkdtempSync(join(tmpdir(), "iafd-profile-"));

  try {
    for (const filename of [
      "SingletonCookie",
      "SingletonLock",
      "SingletonSocket",
    ]) {
      writeFileSync(join(profileDir, filename), "stale");
    }
    writeFileSync(join(profileDir, "Cookies"), "keep");

    clearStaleChromiumProfileLocks(profileDir);

    assert.equal(existsSync(join(profileDir, "SingletonCookie")), false);
    assert.equal(existsSync(join(profileDir, "SingletonLock")), false);
    assert.equal(existsSync(join(profileDir, "SingletonSocket")), false);
    assert.equal(existsSync(join(profileDir, "Cookies")), true);
  } finally {
    rmSync(profileDir, { recursive: true, force: true });
  }
});
