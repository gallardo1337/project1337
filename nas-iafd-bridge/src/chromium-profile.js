import { rmSync } from "node:fs";
import { join } from "node:path";

const CHROMIUM_SINGLETON_FILES = [
  "SingletonCookie",
  "SingletonLock",
  "SingletonSocket",
];

export function clearStaleChromiumProfileLocks(browserDataDir) {
  for (const filename of CHROMIUM_SINGLETON_FILES) {
    rmSync(join(browserDataDir, filename), { force: true });
  }
}
