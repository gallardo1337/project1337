import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
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

test("V2 verbindet Header, Favoritenansicht und Filmseiten-Schalter", async () => {
  const [page, experience] = await Promise.all([
    readProjectFile("app/page.jsx"),
    readProjectFile("app/beta/BetaExperience.jsx"),
  ]);

  assert.match(page, /viewMode === "favorites"/);
  assert.match(page, /onShowFavorites=\{handleShowFavorites\}/);
  assert.match(page, /onToggleFavorite=\{handleToggleFavorite\}/);
  assert.match(experience, /title="Favoriten"/);
  assert.doesNotMatch(experience, /styles\.movieCardFavorite/);
  assert.match(experience, /className=\{styles\.detailFavoriteButton\}/);
  assert.match(experience, /Öffne einen Film und markiere ihn über das Herz neben der Bewertung/);
});

test("V1 ist aus der aktiven Website entfernt", async () => {
  const [page, experience] = await Promise.all([
    readProjectFile("app/page.jsx"),
    readProjectFile("app/beta/BetaExperience.jsx"),
  ]);

  await assert.rejects(access(new URL("../app/v1/page.jsx", import.meta.url)));
  assert.doesNotMatch(page, /safeOpen\("\/v1"\)/);
  assert.doesNotMatch(experience, /onOpenArchive/);
  assert.doesNotMatch(experience, /v1 · Original ansehen/);
});

test("Admin-Changelog führt V1-Archivierung und Favoriten fort", async () => {
  const dashboard = await readProjectFile("app/dashboard/page.jsx");

  assert.match(dashboard, /const CHANGELOG = \[\s*\{\s*version:\s*"2\.5\.5"/);
  assert.match(dashboard, /Git-Branch archive\/v1/);
  assert.match(dashboard, /version:\s*"2\.5\.3"/);
  assert.match(dashboard, /version:\s*"2\.5\.2"/);
  assert.match(dashboard, /horizontale und vertikale Fokusregler/);
  assert.match(dashboard, /Favoriten als geräteübergreifend gespeicherte Filmauswahl/);
  assert.match(dashboard, /Favoritenherzen von allen Filmkarten entfernt/);
});
