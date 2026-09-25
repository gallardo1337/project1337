import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Main Tags are an additive, disabled-by-default tag property", async () => {
  const migration = await readProjectFile(
    "supabase/migrations/20260925194011_add_main_tags.sql"
  );

  assert.match(
    migration,
    /add column if not exists is_main boolean not null default false/i
  );
  assert.match(migration, /comment on column public\.tags\.is_main/i);
});

test("beta admin can mark and unmark Main Tags", async () => {
  const dashboard = await readProjectFile("app/dashboard/page.jsx");

  assert.match(dashboard, /\.update\(\{ is_main: tag\.is_main !== true \}\)/);
  assert.match(dashboard, /Als Main markieren/);
  assert.match(dashboard, /aria-pressed=\{t\.is_main === true\}/);
  assert.match(dashboard, /Main Tag/);
});

test("tvOS library, search, actor details, and filter options prioritize Main Tags", async () => {
  const [payload, search, actorMovies, filters] = await Promise.all([
    readProjectFile("lib/tvLibraryPayload.mjs"),
    readProjectFile("app/api/tv/search/route.js"),
    readProjectFile("app/api/tv/actors/[id]/movies/route.js"),
    readProjectFile("app/api/tv/filters/route.js"),
  ]);

  assert.match(payload, /export function prioritizeTagIds/);
  assert.match(search, /prioritizeTagIds\(movie\.tag_ids, tagsResult\.data \|\| \[\]\)/);
  assert.match(actorMovies, /prioritizeTagIds\(movie\.tag_ids, tagsResult\.data \|\| \[\]\)/);
  assert.match(filters, /Number\(b\.is_main\) - Number\(a\.is_main\)/);
});

test("beta shows each movie's Main Tags in the five-film spotlight and film cards", async () => {
  const [homePage, experience] = await Promise.all([
    readProjectFile("app/page.jsx"),
    readProjectFile("app/beta/BetaExperience.jsx"),
  ]);

  assert.match(homePage, /mainTags:\s*mainTagNames/);
  assert.match(experience, /<MainTagList tags=\{featured\?\.mainTags\}/);
  assert.match(experience, /<MainTagList tags=\{movie\.mainTags\}/);
  assert.match(experience, /function MovieCard\(/);
  assert.match(experience, /function SimilarMovieCard\(/);
});

test("beta gives Main Tags a distinct pill style on cards and movie details", async () => {
  const [experience, styles] = await Promise.all([
    readProjectFile("app/beta/BetaExperience.jsx"),
    readProjectFile("app/beta/experience.module.css"),
  ]);

  assert.match(experience, /movie\.mainTags\?\.includes\(tag\)/);
  assert.match(experience, /styles\.detailTagMain/);
  assert.match(styles, /\.mainTagBadge::before/);
  assert.match(styles, /\.detailTags > \.detailTagMain/);
  assert.match(styles, /\.mainTagBadge\s*\{[\s\S]*?border-radius:\s*6px/);
  assert.match(styles, /\.detailTags > span::before/);
});

test("beta movie tiles show compact Main Tags, rating, and cast names", async () => {
  const [experience, styles] = await Promise.all([
    readProjectFile("app/beta/BetaExperience.jsx"),
    readProjectFile("app/beta/experience.module.css"),
  ]);

  assert.match(experience, /<Icon name="star" \/>[\s\S]*?formatRating\(movie\.rating\)/);
  assert.match(experience, /label="Hauptdarsteller" names=\{movie\.mainActorNames\}/);
  assert.match(experience, /label="Nebendarsteller" names=\{movie\.supportingActorNames\}/);
  assert.match(styles, /\.movieCard \.mainTagBadge\s*\{[\s\S]*?font-size:\s*8px/);
});
