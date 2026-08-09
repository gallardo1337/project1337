import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Favoriten werden rückwärtskompatibel in movie_metrics gespeichert", async () => {
  const migration = await readProjectFile(
    "supabase/migrations/20260809144349_add_movie_favorites.sql"
  );

  assert.match(
    migration,
    /add column if not exists is_favorite boolean not null default false/i
  );
});

test("Favoriten-API ist sitzungsgeschützt und akzeptiert nur Boolean-Werte", async () => {
  const route = await readProjectFile(
    "app/api/movie-metrics/[id]/favorite/route.js"
  );

  assert.match(route, /await hasLibrarySession\(\)/);
  assert.match(route, /typeof favorite !== "boolean"/);
  assert.match(route, /is_favorite: favorite/);
});

test("V2 verbindet Header, Favoritenansicht und Film-Schalter", async () => {
  const [page, experience] = await Promise.all([
    readProjectFile("app/page.jsx"),
    readProjectFile("app/beta/BetaExperience.jsx"),
  ]);

  assert.match(page, /viewMode === "favorites"/);
  assert.match(page, /onShowFavorites=\{handleShowFavorites\}/);
  assert.match(page, /onToggleFavorite=\{handleToggleFavorite\}/);
  assert.match(experience, /title="Favoriten"/);
  assert.match(experience, /className=\{styles\.movieCardFavorite\}/);
  assert.match(experience, /className=\{styles\.detailFavoriteButton\}/);
});

test("Admin-Changelog bleibt bei Version 2.5.1", async () => {
  const dashboard = await readProjectFile("app/dashboard/page.jsx");

  assert.match(dashboard, /version:\s*"2\.5\.1"/);
});
