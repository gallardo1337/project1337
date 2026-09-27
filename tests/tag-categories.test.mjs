import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isCategorizedTag,
  prioritizeTagIds,
  sortTagsByCategory,
  tagCategoryLabel,
} from "../lib/tagCategories.mjs";

const readProjectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("tag categories sort as Color, Place, Finish, then uncategorized", () => {
  const tags = [
    { id: "none", name: "Drama", category: null },
    { id: "finish", name: "Creampie", category: "finish" },
    { id: "place", name: "Bedroom", category: "place" },
    { id: "color", name: "Blonde", category: "haircolor" },
  ];

  assert.deepEqual(
    sortTagsByCategory(tags).map((tag) => tag.id),
    ["color", "place", "finish", "none"]
  );
  assert.deepEqual(
    prioritizeTagIds(["none", "finish", "place", "color"], tags),
    ["color", "place", "finish", "none"]
  );
  assert.equal(tagCategoryLabel("haircolor"), "Color");
  assert.equal(isCategorizedTag({ category: "place" }), true);
  assert.equal(isCategorizedTag({ category: null }), false);
});

test("migration adds only the supported optional tag categories", async () => {
  const migration = await readProjectFile(
    "supabase/migrations/20260927182000_add_tag_categories.sql"
  );
  assert.match(migration, /add column if not exists category text/i);
  assert.match(migration, /'haircolor', 'place', 'finish'/i);
  assert.match(migration, /category is null or category in/i);
});

test("admin can categorize tags and uses the ordered category labels", async () => {
  const [dashboard, picker] = await Promise.all([
    readProjectFile("app/dashboard/page.jsx"),
    readProjectFile("app/dashboard/AdminMovieMetadataPicker.jsx"),
  ]);
  assert.match(dashboard, /\.update\(\{ category: category \|\| null \}\)/);
  assert.match(dashboard, /Tags kategorisieren/);
  assert.match(dashboard, /<option value="haircolor">Color<\/option>/);
  assert.match(dashboard, /<option value="place">Place<\/option>/);
  assert.match(dashboard, /<option value="finish">Finish<\/option>/);
  assert.match(picker, /sortTagsByCategory\(items\)/);
});

test("step 04 chooses hair color tags and step 06 omits them", async () => {
  const dashboard = await readProjectFile("app/dashboard/page.jsx");
  assert.match(dashboard, /filmWizardStep === 3[\s\S]*?category === "haircolor"/);
  assert.match(dashboard, /filmWizardStep === 5[\s\S]*?category !== "haircolor"/);
});

test("web and tvOS prioritize categorized tags and retain their category", async () => {
  const [home, experience, payload, filters] = await Promise.all([
    readProjectFile("app/page.jsx"),
    readProjectFile("app/beta/BetaExperience.jsx"),
    readProjectFile("lib/tvLibraryPayload.mjs"),
    readProjectFile("app/api/tv/filters/route.js"),
  ]);
  assert.match(home, /categorizedTags:/);
  assert.match(experience, /movie\.categorizedTags/);
  assert.match(payload, /prioritizeTagIds\(tagIds, tags\)/);
  assert.match(payload, /sortTagsByCategory\(/);
  assert.match(filters, /sortTagsByCategory/);
  assert.doesNotMatch(filters, /is_main/);
});

test("actor statistics use Color and Finish categories instead of fixed tag names", async () => {
  const [home, experience] = await Promise.all([
    readProjectFile("app/page.jsx"),
    readProjectFile("app/beta/BetaExperience.jsx"),
  ]);

  assert.match(home, /tagDetails,/);
  assert.match(home, /category: tag\.category \|\| null/);
  assert.match(experience, /tag\.category === "haircolor"/);
  assert.match(experience, /tag\.category === "finish"/);
  assert.doesNotMatch(experience, /HAIR_COLOR_TAGS|FINISH_TAGS/);
});
