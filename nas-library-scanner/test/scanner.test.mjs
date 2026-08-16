import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { NasLibraryScanner } from "../src/scanner.mjs";

test("scannt rekursiv alle freigegebenen Videoformate und ignoriert Systemordner", async () => {
  const base = await mkdtemp(join(tmpdir(), "project1337-scanner-"));
  const libraryPath = join(base, "1337");
  const dataPath = join(base, "scan.json");
  await mkdir(join(libraryPath, "Anna_Asti", "4K"), { recursive: true });
  await mkdir(join(libraryPath, "Anna_Asti", "@eaDir"), { recursive: true });
  await writeFile(join(libraryPath, "Anna_Asti", "Film.mp4"), "mp4");
  await writeFile(join(libraryPath, "Anna_Asti", "4K", "Film.mkv"), "mkv");
  await writeFile(join(libraryPath, "Anna_Asti", "Notiz.txt"), "ignore");
  await writeFile(join(libraryPath, "Anna_Asti", "@eaDir", "Doppelt.mp4"), "ignore");

  const scanner = new NasLibraryScanner({
    libraryPath,
    libraryName: "1337",
    dataPath,
    videoExtensions: new Set(["mp4", "mkv"]),
    ignoredDirectories: new Set(["@eadir"]),
    maxFiles: 100,
    maxDepth: 8,
  });

  const fresh = await scanner.inventory({ refresh: true });
  assert.equal(fresh.cached, false);
  assert.equal(fresh.total_files, 2);
  assert.deepEqual(
    fresh.files.map((file) => file.path),
    ["Anna_Asti/4K/Film.mkv", "Anna_Asti/Film.mp4"]
  );

  const saved = JSON.parse(await readFile(dataPath, "utf8"));
  assert.equal(saved.total_files, 2);
  const cached = await scanner.inventory();
  assert.equal(cached.cached, true);
  assert.equal(cached.total_files, 2);
});
