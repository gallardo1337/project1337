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

test("Admin-Changelog führt NAS-Analyse, Bereinigung, Favoriten und Kontomenü fort", async () => {
  const [dashboard, overviewStyles, experience, layout, v2Redirect, betaRedirect] = await Promise.all([
    readProjectFile("app/dashboard/page.jsx"),
    readProjectFile("app/dashboard/beta/admin-beta.css"),
    readProjectFile("app/beta/BetaExperience.jsx"),
    readProjectFile("app/dashboard/layout.jsx"),
    readProjectFile("app/dashboard/v2/page.jsx"),
    readProjectFile("app/dashboard/beta/page.jsx"),
  ]);

  assert.match(dashboard, /const CHANGELOG = \[\s*\{\s*version:\s*"2\.6\.1"/);
  assert.match(dashboard, /NAS-Qualitätsauswertung auf 4K und Nicht 4K/);
  assert.match(dashboard, /Abdeckung nach Hauptdarsteller über anklickbare Spaltenköpfe sortierbar/);
  assert.match(dashboard, /Unten abgeschnittene Kennzahlen in der Admin-Übersicht korrigiert/);
  assert.match(dashboard, /Thumbnails der aktuellen Filme in der Admin-Übersicht auf 16:9 umgestellt/);
  assert.match(dashboard, /Thumbnails im Filmarchiv vollständig auf 16:9 umgestellt/);
  assert.match(dashboard, /V2-Oberflächen unter \/ und \/dashboard konsolidiert/);
  assert.match(overviewStyles, /\.adminKpi > strong \{[^}]*overflow:\s*visible;/s);
  assert.match(overviewStyles, /\.adminKpi > strong \{[^}]*line-height:\s*1;/s);
  assert.match(
    overviewStyles,
    /\.adminBeta \.adminRecentMovie__cover \{[^}]*width:\s*100%;[^}]*aspect-ratio:\s*16 \/ 9;/s
  );
  assert.match(
    overviewStyles,
    /grid-template-columns:\s*27px 88px minmax\(150px, 1fr\)/
  );
  assert.match(
    overviewStyles,
    /\.adminBeta \.dashMovieIdentity__cover \{[^}]*width:\s*clamp\(72px, 8vw, 100px\);[^}]*aspect-ratio:\s*16 \/ 9;/s
  );
  assert.match(
    dashboard,
    /className="aspect-video w-28 shrink-0 rounded-xl border border-neutral-800 object-cover bg-neutral-900"/
  );
  assert.match(dashboard, /label:\s*"NAS-Analyse"/);
  assert.match(dashboard, /AdminNasLibrary/);
  assert.match(dashboard, /Git-Branch archive\/v1/);
  assert.match(dashboard, /version:\s*"2\.5\.3"/);
  assert.match(dashboard, /version:\s*"2\.5\.2"/);
  assert.match(dashboard, /horizontale und vertikale Fokusregler/);
  assert.match(dashboard, /Favoriten als geräteübergreifend gespeicherte Filmauswahl/);
  assert.match(dashboard, /Favoritenherzen von allen Filmkarten entfernt/);
  assert.match(experience, />Admin<\/button>/);
  assert.match(experience, /<Icon name="settings" \/>/);
  assert.match(experience, /aria-label="Kontomenü öffnen"/);
  assert.doesNotMatch(experience, /String\(loginUser \|\| "KH"\)\.slice\(0, 2\)/);
  assert.match(dashboard, /<small>Admin<\/small>/);
  assert.doesNotMatch(dashboard, /Klassisches Dashboard/);
  assert.doesNotMatch(dashboard, /Zum klassischen Dashboard/);
  assert.match(layout, /title:\s*"Admin \| Project1337"/);
  assert.match(layout, /import "\.\/beta\/admin-beta\.css"/);
  assert.match(v2Redirect, /redirect\("\/dashboard"\)/);
  assert.match(betaRedirect, /redirect\("\/dashboard"\)/);
});

test("V1- und Classic-Reste sind aus den aktiven Bundles entfernt", async () => {
  const [page, dashboard] = await Promise.all([
    readProjectFile("app/page.jsx"),
    readProjectFile("app/dashboard/page.jsx"),
  ]);

  assert.match(page, /onDashboard=\{\(\) => safeOpen\("\/dashboard"\)\}/);
  assert.doesNotMatch(page, /MovieDetailView|ActorHero|nfx--redesign|dashboard\/v2/);
  assert.match(dashboard, /export function DashboardExperience\(\)/);
  assert.doesNotMatch(dashboard, /ClassicSidebarContent|MovieThumbnailUploader|\{ beta/);

  for (const removedPath of [
    "styles.css",
    "app/beta/beta.module.css",
    "app/dashboard/MovieThumbnailUploader.jsx",
    "app/dashboard/v2/layout.jsx",
    "app/dashboard/beta/layout.jsx",
    "public/db.png",
    "public/palm.png",
  ]) {
    await assert.rejects(access(new URL(`../${removedPath}`, import.meta.url)));
  }
});

test("Studio-Bilder sind entfernt und die Darsteller-Dateiauswahl ist sauber aufgebaut", async () => {
  const [dashboard, actorImageUploader] = await Promise.all([
    readProjectFile("app/dashboard/page.jsx"),
    readProjectFile("app/dashboard/ActorImageUploader.jsx"),
  ]);

  assert.match(dashboard, /Bildverwaltung für Studios aus der Admin-Oberfläche entfernt/);
  assert.match(dashboard, /Dateiauswahl beim Anlegen von Haupt- und Nebendarstellern sauber ausgerichtet/);
  assert.doesNotMatch(dashboard, /newStudioImage/);
  assert.doesNotMatch(dashboard, /studioEditForm\.image_url/);
  assert.doesNotMatch(dashboard, /s\.image_url/);
  assert.match(dashboard, /\.from\("studios"\)\s*\.insert\(\{ name \}\)/s);
  assert.match(actorImageUploader, /actorImageUploader__picker/);
  assert.match(actorImageUploader, /fileInputRef\.current\?\.click\(\)/);
  assert.match(actorImageUploader, /selectedFileName \|\| "Keine Datei ausgewählt"/);
  assert.match(actorImageUploader, /aria-label="Darsteller-Foto auswählen"/);
});
