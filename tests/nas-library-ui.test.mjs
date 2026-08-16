import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("NAS-Darstellerliste vermeidet doppelte Namen und zeigt lesbare Dateityp-Zähler", async () => {
  const [component, styles, dashboard] = await Promise.all([
    projectFile("app/dashboard/beta/AdminNasLibrary.jsx"),
    projectFile("app/dashboard/beta/AdminNasLibrary.module.css"),
    projectFile("app/dashboard/page.jsx"),
  ]);

  assert.match(component, /function normalizePerformerLabel\(value\)/);
  assert.match(
    component,
    /normalizePerformerLabel\(folder\)\s*!==\s*normalizePerformerLabel\(performer\.name\)/s
  );
  assert.match(component, /className=\{styles\.performerFormats\}/);
  assert.match(
    component,
    /\.map\(\(item\) => `\$\{item\.name\} \$\{formatNumber\(item\.count\)\}`\)\s*\.join\(" · "\)/s
  );
  assert.doesNotMatch(component, /<b>\{item\.name\}<\/b>/);
  assert.doesNotMatch(component, /<em>\{formatNumber\(item\.count\)\}<\/em>/);
  assert.match(
    styles,
    /\.performerFormats \{[^}]*font-size:\s*11px;[^}]*font-weight:\s*400;/s
  );
  assert.doesNotMatch(styles, /\.performerFormats span \{/);
  assert.match(
    dashboard,
    /Doppelte Darstellernamen in der NAS-Analyse entfernt und Dateityp-Zähler besser lesbar gemacht/
  );
});
