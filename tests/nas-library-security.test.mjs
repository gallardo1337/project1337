import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function projectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("NAS-Analyse bleibt sitzungsgeschützt und hält Secrets auf dem Server", async () => {
  const [route, component, compose, scannerServer] = await Promise.all([
    projectFile("app/api/nas-library/route.js"),
    projectFile("app/dashboard/beta/AdminNasLibrary.jsx"),
    projectFile("nas-library-scanner/docker-compose.yml"),
    projectFile("nas-library-scanner/src/server.mjs"),
  ]);

  assert.match(route, /await hasLibrarySession\(\)/);
  assert.match(route, /NAS_LIBRARY_SCANNER_SECRET/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_NAS/);
  assert.match(route, /createHmac\("sha256"/);
  assert.match(route, /MAX_SCANNER_RESPONSE_BYTES/);
  assert.match(route, /\.range\(from, from \+ PAGE_SIZE - 1\)/);
  assert.match(component, /\/api\/nas-library/);
  assert.doesNotMatch(component, /NAS_LIBRARY_SCANNER_SECRET/);
  assert.match(compose, /:\/media:ro/);
  assert.match(compose, /read_only:\s*true/);
  assert.match(compose, /cap_drop:\s*\n\s*- ALL/);
  assert.match(scannerServer, /verifyRequestSignature/);
});
