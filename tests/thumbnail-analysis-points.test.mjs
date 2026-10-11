import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ANALYSIS_END_RATIO,
  createThumbnailAnalysisPoints,
  DEFAULT_ANALYSIS_START_RATIO,
} from "../lib/thumbnailAnalysisPoints.mjs";

test("thumbnail scans never sample earlier than the selected start time", () => {
  const points = createThumbnailAnalysisPoints(1200, 480, () => 0.5);

  assert.equal(points.length, 30);
  assert.ok(points.every(({ point }) => point >= 0.4));
  assert.ok(points.every(({ point }) => point < ANALYSIS_END_RATIO));
  assert.deepEqual(
    [...new Set(points.map(({ bandIndex }) => bandIndex))],
    [0, 1, 2, 3, 4, 5]
  );
});

test("the default preserves the existing 20 percent start and rejects an empty range", () => {
  const defaults = createThumbnailAnalysisPoints(1000, undefined, () => 0.5);

  assert.equal(DEFAULT_ANALYSIS_START_RATIO, 0.2);
  assert.equal(defaults.length, 30);
  assert.ok(defaults.every(({ point }) => point >= DEFAULT_ANALYSIS_START_RATIO));
  assert.deepEqual(createThumbnailAnalysisPoints(1000, 950), []);
});

test("both thumbnail generators use the configurable time and current video position action", async () => {
  const studio = await readFile(
    new URL("../app/dashboard/beta/AdminThumbnailStudio.jsx", import.meta.url),
    "utf8"
  );

  assert.match(studio, /aria-label="Frühester Suchzeitpunkt"[\s\S]*?type="time"/);
  assert.match(studio, /Aktuelle Position übernehmen/);
  assert.equal(
    (studio.match(/createThumbnailAnalysisPoints\(duration, analysisStartTime\)/g) || [])
      .length,
    2
  );
});
